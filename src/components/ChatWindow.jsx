import React, { useState, useEffect, useRef } from 'react';
import {
  MainContainer,
  ChatContainer,
  MessageList,
  Message,
  MessageInput,
  ConversationHeader,
  Avatar, // Optional
} from '@chatscope/chat-ui-kit-react';
import '@chatscope/chat-ui-kit-styles/dist/default/styles.min.css';
import { fetchChatHistory, sendMessage as sendMessageApi } from '../services/messageService';
// import './ChatWindow.css'; // Можно создать для кастомных стилей
import { useWebSocket } from '../contexts/WebSocketContext';

function ChatWindow({ currentUser, recipientUser }) {
  const [messages, setMessages] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [isSending, setIsSending] = useState(false);
  const messageListRef = useRef(null);
  const { subscribe, send: sendWebSocketMessage, isConnected: isWebSocketConnected } = useWebSocket();

  // Загрузка истории чата
  useEffect(() => {
    if (currentUser && recipientUser?.id) {
      console.log(`ChatWindow: useEffect for history load. CurrentUser: ${currentUser.id}, RecipientUser: ${recipientUser.id}`);
      const loadHistory = async () => {
        setIsLoadingHistory(true);
        setMessages([]); // Clear previous messages
        try {
          // Формируем roomId, сортируя ID для консистентности
          const ids = [currentUser.id, recipientUser.id].sort((a, b) => a - b);
          const roomId = ids.join('_');

          const history = await fetchChatHistory(roomId);
          console.log(`ChatWindow: Fetched history for roomId ${roomId}:`, history);
          const formattedMessages = history
            .map(msg => ({
              id: msg.messageId, // Используем messageId из ответа сервера
              message: msg.content,
              sentTime: msg.timestamp, // Store raw timestamp for sorting
              displayTime: new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              sender: msg.senderId === currentUser.id ? (currentUser.username || `User ${currentUser.id}`) : (recipientUser.username || `User ${recipientUser.id}`),
              direction: msg.senderId === currentUser.id ? 'outgoing' : 'incoming',
              position: 'single',
            }))
            .sort((a, b) => new Date(a.sentTime) - new Date(b.sentTime)); // Sort by timestamp
          // console.log('ChatWindow: Formatted messages to set:', formattedMessages);
          setMessages(formattedMessages);
        } catch (error) {
          console.error("Error loading chat history:", error);
          // TODO: Display error to user
        } finally {
          setIsLoadingHistory(false);
        }
      };
      loadHistory();
    } else {
      setMessages([]); // Clear messages if no recipient
      console.log("ChatWindow: No currentUser or recipientUser, clearing messages.");
    }
  }, [currentUser, recipientUser]);

  // Подписка на WebSocket сообщения
  useEffect(() => {
    if (!currentUser || !recipientUser?.id || !isWebSocketConnected || !subscribe) {
      return;
      // console.log(`ChatWindow: WebSocket subscription prerequisites not met. isWebSocketConnected: ${isWebSocketConnected}, subscribe: ${!!subscribe}`);
    }

    // Пользователь подписывается на свою "личную" очередь сообщений.
    // Бэкенд должен знать ID пользователя (из Principal) и отправлять сообщения сюда.
    const userSpecificDestination = `/user/${currentUser.id}/queue/messages`;
    const ids = [currentUser.id, recipientUser.id].sort((a, b) => a - b);
    const topicDestination = `/topic/messages/${ids.join('_')}`;
    console.log(`ChatWindow: Subscribing to ${userSpecificDestination} for user ${currentUser.id}`);

    const subscription = subscribe(userSpecificDestination, (receivedMessage) => {
      console.log('ChatWindow: WebSocket message received (parsed):', receivedMessage); // <-- РАСКОММЕНТИРОВАНО и уточнено

      // Проверяем, относится ли сообщение к текущему открытому чату
      const isMessageForCurrentChat = // Переименовано для ясности
        (String(receivedMessage.senderId) === String(currentUser.id) && String(receivedMessage.recipientId) === String(recipientUser.id)) ||
        (String(receivedMessage.senderId) === String(recipientUser.id) && String(receivedMessage.recipientId) === String(currentUser.id));

      if (isMessageForCurrentChat) {
        // Проверяем, не дубликат ли это (по messageId от сервера) перед добавлением в UI
        if (!messages.some(m => m.id === receivedMessage.messageId)) {
          console.log('ChatWindow: Adding new message from WebSocket to UI:', receivedMessage);
          const newMessageForUi = {
            id: receivedMessage.messageId,
            message: receivedMessage.content,
            sentTime: receivedMessage.timestamp,
            displayTime: new Date(receivedMessage.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            sender: String(receivedMessage.senderId) === String(currentUser.id) ? (currentUser.username || `User ${currentUser.id}`) : (recipientUser.username || `User ${recipientUser.id}`),
            direction: String(receivedMessage.senderId) === String(currentUser.id) ? 'outgoing' : 'incoming',
            position: 'single',
          };
          setMessages(prevMessages => [...prevMessages, newMessageForUi].sort((a, b) => new Date(a.sentTime) - new Date(b.sentTime)));
        } else { // Лог для дубликатов
          // console.log('ChatWindow: Duplicate message received via WebSocket, ignoring.', receivedMessage.messageId);
        }
      }
    });

    // Diagnostic: Subscribe to the public topic
    console.log(`ChatWindow: DIAGNOSTIC Subscribing to ${topicDestination}`);
    const topicSubscription = subscribe(topicDestination, (receivedMessage) => {
      console.log(`ChatWindow: DIAGNOSTIC Message received on TOPIC (${topicDestination}):`, receivedMessage);

      // Повторяем ту же логику, что и для userSpecificDestination
      const isMessageForCurrentChat =
        (String(receivedMessage.senderId) === String(currentUser.id) && String(receivedMessage.recipientId) === String(recipientUser.id)) ||
        (String(receivedMessage.senderId) === String(recipientUser.id) && String(receivedMessage.recipientId) === String(currentUser.id));

      if (isMessageForCurrentChat) {
        if (!messages.some(m => m.id === receivedMessage.messageId)) {
          const newMessageForUi = {
            id: receivedMessage.messageId,
            message: receivedMessage.content,
            sentTime: receivedMessage.timestamp,
            displayTime: new Date(receivedMessage.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            sender: String(receivedMessage.senderId) === String(currentUser.id) ? (currentUser.username || `User ${currentUser.id}`) : (recipientUser.username || `User ${recipientUser.id}`),
            direction: String(receivedMessage.senderId) === String(currentUser.id) ? 'outgoing' : 'incoming',
            position: 'single',
          };
          setMessages(prevMessages => [...prevMessages, newMessageForUi].sort((a, b) => new Date(a.sentTime) - new Date(b.sentTime)));
        }
      }
    });

    return () => {
      if (subscription && subscription.unsubscribe) {
        subscription.unsubscribe();
        console.log(`ChatWindow: Unsubscribed from ${userSpecificDestination}`);
      }
      if (topicSubscription && topicSubscription.unsubscribe) {
        topicSubscription.unsubscribe();
        console.log(`ChatWindow: DIAGNOSTIC Unsubscribed from ${topicDestination}`);
      }
    };
  }, [currentUser, recipientUser, isWebSocketConnected, subscribe]); // Adjusted dependencies slightly for roomId generation

  useEffect(() => {
    // Scroll to bottom when new messages are added
    if (messageListRef.current) {
        messageListRef.current.scrollToBottom('smooth');
    }
  }, [messages]);

  const handleSend = async (text) => {
    if (!text.trim() || !currentUser || !recipientUser?.id || isSending) return;
    console.log(`ChatWindow: handleSend called. Text: "${text}", isWebSocketConnected: ${isWebSocketConnected}`);

    setIsSending(true);
    setInputValue("");

    try {
      if (isWebSocketConnected && sendWebSocketMessage) {
        const messageBody = {
          recipientId: Number(recipientUser.id),
          content: text,
          // tempIdFrontend: tempId // Можно убрать, если не нужен для дедупликации
        };
        console.log(`ChatWindow: Sending message via WebSocket. Destination: /app/chat.sendMessage, Body:`, messageBody);
        sendWebSocketMessage(
          '/app/chat.sendMessage',
          messageBody
        );
      } else {
        console.error("ChatWindow: WebSocket not connected. Message not sent via WebSocket.");
        throw new Error("WebSocket не подключен. Сообщение не отправлено.");
      }
    } catch (error) {
      console.error("Failed to send message via WebSocket:", error);
      // Можно показать ошибку пользователю
    } finally {
      setIsSending(false);
    }
  };

  if (!currentUser || !recipientUser) {
    // console.log("ChatWindow: No currentUser or recipientUser, showing placeholder.");
    return <div style={{padding: "20px"}}>Выберите пользователя для начала чата.</div>;
  }

  return (
    //console.log('Current messages state in render:', messages);
    <div style={{ height: '100%', position: 'relative', display: 'flex', flexDirection: 'column' }}>
      <ConversationHeader>
        {/* <Avatar src={recipientUser.avatarUrl} name={recipientUser.username} /> */}
        <ConversationHeader.Content userName={recipientUser.username || `User ${recipientUser.id}`} />
      </ConversationHeader>
      <MessageList ref={messageListRef} loading={isLoadingHistory} style={{flexGrow: 1}}>
        {messages.map((msg) => (
          // console.log('Rendering message:', msg), // Отладочный лог, можно удалить или закомментировать
          <Message key={msg.id} model={{ ...msg, sentTime: msg.displayTime }} />
        ))}
      </MessageList>
      <MessageInput
        placeholder="Введите сообщение..."
        value={inputValue}
        onSend={handleSend}
        onChange={setInputValue}
        sendButton={true}
        attachButton={false}
        sendDisabled={isSending || isLoadingHistory}
      />
    </div>
  );
}

export default ChatWindow;