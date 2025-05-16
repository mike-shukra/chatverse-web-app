import React, { useState } from 'react';
import './LoginScreen.css';
import { loginWithAuthCode, sendAuthCodeRequest } from '../services/authService'; 

function LoginScreen({ onLogin }) {
    const [phoneNumber, setPhoneNumber] = useState('');
    const [authCode, setAuthCode] = useState('');
    const [isCodeSent, setIsCodeSent] = useState(false); // Новый стейт для отслеживания этапа
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    console.log(`LoginScreen: handleSubmit. Stage: ${!isCodeSent ? 'sendCode' : 'loginWithCode'}. Phone: ${phoneNumber}`);

    setIsLoading(true);
    setError('');

    if (!isCodeSent) {
        // Этап 1: Отправка кода
        if (!phoneNumber) {
          setError('Пожалуйста, введите номер телефона.');
          setIsLoading(false);
          return;
        }
        try {
          console.log("LoginScreen: Attempting to send auth code to", phoneNumber);
          await sendAuthCodeRequest(phoneNumber);
          setIsCodeSent(true); // Переключаемся на этап ввода кода
          setError(''); // Очищаем предыдущие ошибки
          console.log("LoginScreen: Auth code request successful.");
          // Можно добавить сообщение об успехе, если нужно
        } catch (err) {
          console.error("Send code error:", err);
          setError(err.message || 'Не удалось отправить код. Пожалуйста, проверьте номер телефона.');
        } finally {
          setIsLoading(false);
        }
      } else {
        // Этап 2: Вход с кодом
        if (!authCode) {
          setError('Пожалуйста, введите код авторизации.');
          setIsLoading(false);
          return;
        }
        try {
          console.log("LoginScreen: Attempting to login with phone and code.");
          const userData = await loginWithAuthCode(phoneNumber, authCode);
          console.log("LoginScreen: Login successful. UserData:", userData);
          onLogin(userData);
        } catch (err) {
          console.error("Login with code error:", err);
          setError(err.message || 'Не удалось войти. Пожалуйста, проверьте код.');
        } finally {
          setIsLoading(false);
        }
      }
  };

  return (
    <div className="login-screen">
      <form onSubmit={handleSubmit} className="login-form">
        <h2>{!isCodeSent ? 'Получить код' : 'Ввести код'}</h2>
        <div className="form-group">
          <label htmlFor="phoneNumber">Номер телефона:</label>
          <input
            type="text"
            id="phoneNumber"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            required
            disabled={isLoading || isCodeSent} // Блокируем после отправки кода
          />
        </div>

        {isCodeSent && (
          <div className="form-group">
            <label htmlFor="authCode">Код авторизации:</label>
            <input
              type="text" // Можно оставить text или сменить на number, если код всегда числовой
              id="authCode"
              value={authCode}
              onChange={(e) => setAuthCode(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>
        )}

        {error && <p className="error-message" style={{color: 'red'}}>{error}</p>}
        <button type="submit" className="login-button" disabled={isLoading}>
          {isLoading ? 'Загрузка...' : (!isCodeSent ? 'Отправить код' : 'Войти')}
        </button>
        {isCodeSent && (
          <button
            type="button"
            className="change-phone-button" // Добавьте стили для этой кнопки, если нужно
            onClick={() => {
              setIsCodeSent(false);
              setAuthCode('');
              setError('');
            }}
            disabled={isLoading}
            style={{marginTop: '10px', background: 'grey'}} // Пример простых стилей
          >
            Изменить номер
          </button>
        )}
      </form>
    </div>
  );
}

export default LoginScreen;