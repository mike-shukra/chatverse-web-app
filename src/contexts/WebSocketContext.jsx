import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { useAuth } from './AuthContext';

const WebSocketContext = createContext(null);

export const useWebSocket = () => useContext(WebSocketContext);

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://chatverse.local:8888';
const WEBSOCKET_URL = `${API_BASE_URL.replace(/^http/, 'ws')}/ws`; // Заменяем http/https на ws/wss

export const WebSocketProvider = ({ children }) => {
  const stompClientRef = useRef(null); // Используем useRef для хранения экземпляра клиента
  const [isConnected, setIsConnected] = useState(false);
  const { currentUser, token, isAuthenticated, isLoading: isAuthLoading, logout } = useAuth(); // Добавляем logout

  const connect = useCallback(() => {
    if (!token) {
      console.log(`WebSocketContext: Connect skipped. Reason: No token.`);
      return;
    }
    if (stompClientRef.current && stompClientRef.current.active) {
      console.log(`WebSocketContext: Connect skipped. Reason: STOMP client already active.`);
      return;
    }
    if (stompClientRef.current) {
      console.log('WebSocketContext: Deactivating previous STOMP client instance before creating a new one.');
      stompClientRef.current.deactivate();
    }

    console.log('WebSocketContext: Attempting to connect with token:', token ? token.substring(0,10) + "..." : "null");
    const client = new Client({
      webSocketFactory: () => new SockJS(WEBSOCKET_URL.replace(/^ws/, 'http')),
      connectHeaders: {
        'Authorization': `Bearer ${token}`,
      },
      debug: (str) => {
        // Логируем только входящие и исходящие фреймы, чтобы не засорять консоль
        if (str.startsWith('>>>') || str.startsWith('<<<')) {
           console.log('WebSocketContext STOMP DEBUG: ', str);
        }
        // console.log('WebSocketContext STOMP DEBUG: ', str); // Раскомментировать для полного дебага
      },
      reconnectDelay: 5000, // Стандартное значение для переподключения
      heartbeatIncoming: 30000,
      heartbeatOutgoing: 20000,
      onConnect: () => {
        console.log('WebSocketContext: STOMP Connected to broker.'); // Уточненное сообщение
        setIsConnected(true);
      },
      onDisconnect: () => {
        console.log('WebSocketContext: STOMP Disconnected from broker.');
        setIsConnected(false);
      },
      onStompError: (frame) => {
        const errorMessage = frame.headers['message'];
        console.error('WebSocketContext: STOMP Broker reported error: ' + errorMessage, 'Details:', frame.body);
        setIsConnected(false);
        // Обработка ошибок аутентификации
        if (errorMessage && (errorMessage.toLowerCase().includes('authentication') || errorMessage.toLowerCase().includes('invalid token'))) {
            console.error("WebSocketContext: STOMP Authentication error. Logging out user.");
            // logout(); // Вызываем logout из AuthContext
            // Примечание: автоматический logout может быть слишком агрессивным.
            // Возможно, лучше показать пользователю сообщение и предложить перелогиниться.
        }
      },
      onWebSocketError: (error) => {
        console.error('WebSocketContext: WebSocket error event:', error);
        setIsConnected(false);
      },
      // Дополнительный обработчик для явного закрытия WebSocket
      onWebSocketClose: (event) => {
        console.log('WebSocketContext: WebSocket connection closed.', event);
        setIsConnected(false);
      }
    });

    client.activate();
    stompClientRef.current = client; // Зависимости useCallback уже были оптимизированы
  }, [token]); // Зависимость только от токена

  const disconnect = useCallback(() => {
    if (stompClientRef.current) {
      stompClientRef.current.deactivate();
      console.log('WebSocketContext: STOMP client deactivated.');
      stompClientRef.current = null;
    }
    setIsConnected(false);
  }, []); // Нет зависимостей

  useEffect(() => {
    console.log(`WebSocketContext Effect: isAuthLoading=${isAuthLoading}, isAuthenticated=${isAuthenticated}, currentUser=${!!currentUser}, token=${!!token}`);
    if (!isAuthLoading && isAuthenticated && currentUser && token) {
      connect();
    } else {
      console.log(`WebSocketContext Effect: Conditions not met for connection OR explicitly disconnecting. isAuthLoading=${isAuthLoading}, isAuthenticated=${isAuthenticated}`);
      disconnect();
    }
    return () => {
      console.log("WebSocketContext: Cleanup in useEffect - disconnecting.");
      disconnect();
    };
  }, [isAuthLoading, isAuthenticated, currentUser, token, connect, disconnect]);

  const subscribe = useCallback((destination, callback) => {
    if (stompClientRef.current && stompClientRef.current.active && isConnected) {
      return stompClientRef.current.subscribe(destination, (message) => {
        console.log(`WebSocketContext: Received raw message for ${destination}:`, message); // <-- Добавлено логирование сырого сообщения
        try {
          const parsedBody = JSON.parse(message.body);
          callback(parsedBody);
        } catch (e) {
          console.error("WebSocketContext: Failed to parse message body or callback error", e, message.body);
          callback(message.body); // Fallback to raw body
        }
      });
    } else {
      console.warn(`WebSocketContext: Cannot subscribe to ${destination}. Client active: ${stompClientRef.current?.active}, Connected: ${isConnected}`);
      // Возвращаем объект с методом unsubscribe, чтобы избежать ошибок при попытке отписаться
      return { unsubscribe: () => console.warn(`WebSocketContext: Tried to unsubscribe from a non-existent or inactive subscription to ${destination}.`) };
    }
  }, [isConnected]); // Dependency is needed because isConnected is used inside

  /**
   * Отправляет STOMP сообщение на сервер.
   * @param {string} destination - Адрес назначения, например, "/app/chat.sendMessage".
   * @param {object} bodyObject - Объект, который будет преобразован в JSON и отправлен как тело сообщения.
   */
  const send = useCallback((destination, bodyObject) => {
    if (!stompClientRef.current || !stompClientRef.current.active || !isConnected) {
      console.warn(`WebSocketContext: Cannot send message. Client not active or not connected. Destination: ${destination}`);
      return;
    }

    try {
      stompClientRef.current.publish({
        destination: destination,
        body: JSON.stringify(bodyObject),
      });
      console.log(`WebSocketContext: Sent message to ${destination}`, bodyObject);
    } catch (error) {
      console.error(`WebSocketContext: Error publishing message to ${destination}`, error);
     }
  }, [isConnected]); // Dependency is needed because isConnected is used inside

  return (
    <WebSocketContext.Provider value={{ isConnected, connect, disconnect, subscribe, send }}>
      {children}
    </WebSocketContext.Provider>
  );
};
