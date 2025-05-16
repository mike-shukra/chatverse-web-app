import { saveTokens, getAccessToken, getRefreshToken, removeTokens } from '../utils/tokenService';

// TODO: Вынести в переменные окружения (.env)
const API_BASE_URL = 'http://chatverse.local:8888/api/v1'; // Замените на ваш реальный URL бэкенда

// --- Утилита для аутентифицированных запросов с авто-обновлением токена ---
let isCurrentlyRefreshingToken = false;
let tokenRefreshPromise = null;

export const authenticatedFetch = async (url, options = {}) => {
  const performRequest = async (accessTokenForRequest) => {
    const headers = {
      'Content-Type': 'application/json', // По умолчанию, может быть переопределено
      ...options.headers,
    };
    if (accessTokenForRequest) {
      headers['Authorization'] = `Bearer ${accessTokenForRequest}`;
    }
    return fetch(url, { ...options, headers }); // Используем глобальный fetch
  };

  let currentAccessToken = getAccessToken();
  let response = await performRequest(currentAccessToken);

  if (response.status === 401) {
    if (!isCurrentlyRefreshingToken) {
      isCurrentlyRefreshingToken = true;
      tokenRefreshPromise = refreshToken() // Используем существующую функцию refreshToken
        .finally(() => {
          isCurrentlyRefreshingToken = false;
          // Не сбрасываем tokenRefreshPromise здесь, чтобы последующие вызовы могли получить результат
        });
    }

    try {
      const newAccessToken = await tokenRefreshPromise;
      if (newAccessToken) {
        response = await performRequest(newAccessToken); // Повторяем запрос с новым токеном
      } else {
        // refreshToken вернул null (например, нет refresh token) или не смог обновить.
        // Токены должны быть удалены функцией refreshToken или здесь.
        removeTokens(); // Убедимся, что токены удалены
      }
    } catch (refreshError) {
      // Ошибка при обновлении токена. refreshToken должен был удалить токены.
      console.error('AuthenticatedFetch: Ошибка при обновлении токена:', refreshError);
      // Можно пробросить ошибку дальше или вернуть исходный ответ response (401)
      // Проброс ошибки более информативен.
      throw refreshError;
    }
  }
  return response;
};

export const loginWithAuthCode = async (phoneNumber, authCode) => {
  try {
    const response = await fetch(`${API_BASE_URL}/users/check-auth-code`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ phone: phoneNumber, code: authCode }),
    });

    const data = await response.json();

    if (!response.ok) {
      // Если бэкенд возвращает ошибки в структурированном виде, используйте их
      // Например: throw new Error(data.message || `Ошибка ${response.status}`);
      throw new Error(data.error?.message || data.message || `Ошибка ${response.status}`);
    }

    // Фактический ответ сервера: { refreshToken, accessToken, userId, userExists }
    // Проверяем наличие accessToken и userId для успешной аутентификации
    if (data.accessToken && typeof data.userId !== 'undefined') {
      saveTokens(data.accessToken, data.refreshToken);
      // Возвращаем объект с информацией о пользователе, полученной от сервера.
      // App.jsx сможет использовать currentUser.id
      // Для получения полного профиля (username и т.д.) может потребоваться отдельный запрос /users/me
      return { id: data.userId, exists: data.userExists, username: data.username /* если сервер его возвращает */ };
    } else {
      // Можно уточнить сообщение об ошибке, если нужно
      throw new Error('Ответ сервера не содержит необходимых данных (accessToken или userId).');
    }

  } catch (error) {
    console.error('Login failed:', error);
    throw error; // Перебрасываем ошибку, чтобы компонент мог ее обработать
  }
};

export const sendAuthCodeRequest = async (phoneNumber) => {
  try {
    const response = await fetch(`${API_BASE_URL}/users/send-auth-code`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ phone: phoneNumber }), // 'phone' согласно SendAuthCodeRequest
    });

    const data = await response.json();

    if (!response.ok) {
      // Ожидаем ErrorResponse при ошибке
      throw new Error(data.message || `Ошибка ${response.status} при отправке кода`);
    }

    // Ожидаем SuccessResponse ({ "success": true }) при успехе (статус 201)
    return data; // Обычно это { success: true }

  } catch (error) {
    console.error('Send auth code failed:', error);
    throw error;
  }
};

export const fetchCurrentUser = async () => {
  try {
    const response = await authenticatedFetch(`${API_BASE_URL}/users/me`, {
      method: 'GET',
    });

    if (response.status === 401 || response.status === 403) {
      // Если после попытки обновления токена все еще 401/403,
      // значит, сессия действительно недействительна.
      // authenticatedFetch или refreshToken должны были позаботиться об удалении токенов.
      removeTokens(); // Дополнительная очистка на всякий случай
      return null;
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: `Ошибка ${response.status} при получении данных пользователя` }));
      throw new Error(errorData.message || `Ошибка ${response.status}`);
    }

    return await response.json(); // Ожидаем UserProfileResponse
  } catch (error) {
    // Эта ошибка может быть как от самого запроса /me, так и от неудачной попытки обновления токена.
    console.error('Fetch current user failed (возможно, после попытки обновления токена):', error);
    // Если ошибка связана с обновлением токена, токены уже должны быть удалены.
    return null;
  }
};

  export const refreshToken = async () => {
    const currentRefreshToken = getRefreshToken();
    if (!currentRefreshToken) {
      console.log('No refresh token available');
      return null; // или throw new Error('No refresh token');
    }
  
    try {
      const response = await fetch(`${API_BASE_URL}/users/refresh-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken: currentRefreshToken }), // Согласно TokenRefreshRequest
      });
  
      const data = await response.json(); // Ожидаем TokenResponse { accessToken, refreshToken }
  
      if (!response.ok) {
        removeTokens(); // Если refresh-токен невалиден, удаляем оба токена
        throw new Error(data.message || `Ошибка ${response.status} при обновлении токена`);
      }
  
      saveTokens(data.accessToken, data.refreshToken); // Сохраняем новые токены
      return data.accessToken; // Возвращаем новый access-токен
    } catch (error) {
      console.error('Refresh token failed:', error);
      removeTokens(); // В случае любой ошибки при обновлении, лучше разлогинить пользователя
      throw error; // Перебрасываем ошибку, чтобы ее можно было обработать выше
    }
  };