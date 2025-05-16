import { authenticatedFetch } from './authService';

// TODO: Вынести в переменные окружения (.env)
const API_BASE_URL = 'http://chatverse.local:8888/api/v1';

/**
 * Fetches chat history with another user.
 * @param {string} roomId - The ID of the chat room (e.g., "1_2").
 * @returns {Promise<Array>} A promise that resolves to an array of message objects.
 */
export const fetchChatHistory = async (roomId) => {
  if (!roomId) {
    console.error("fetchChatHistory: roomId is required");
    return [];
  }
  try {
    const response = await authenticatedFetch(`${API_BASE_URL}/chat/messages/${roomId}`, {
      method: 'GET',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: `Error fetching history: ${response.status}` }));
      throw new Error(errorData.message || `Error fetching history: ${response.status}`);
    }
    const historyData = await response.json(); 
    // Если бэкенд возвращает PageResponseChatMessageResponse_ с полем 'content' для сообщений:
    // if (historyData && Array.isArray(historyData.content)) {
    //   return historyData.content;
    // }
    // Если бэкенд возвращает просто массив:
    return Array.isArray(historyData) ? historyData : [];
  } catch (error) {
    console.error('Failed to fetch chat history:', error);
    throw error;
  }
};

export const sendMessage = async (recipientId, content) => {
  if (!recipientId || !content) {
    throw new Error("Recipient ID and content are required to send a message.");
  }
  try {
    const response = await authenticatedFetch(`${API_BASE_URL}/chat/messages`, {
      method: 'POST',
      body: JSON.stringify({ recipientId: Number(recipientId), content }), // Ensure recipientId is a number
    });
    if (!response.ok) {
      // Attempt to parse error response if available
        const errorData = await response.json().catch(() => ({ message: `Error sending message: ${response.status}` }));
        throw new Error(errorData.message || `Error sending message: ${response.status}`);
    }
    // Если ответ успешный (200, 201, 204), возвращаем true.
    // API docs указывают, что успешный ответ 200 не содержит тела.
    return true;
  } catch (error) {
    console.error('Failed to send message:', error);
    throw error; // Пробрасываем ошибку дальше
  }
};