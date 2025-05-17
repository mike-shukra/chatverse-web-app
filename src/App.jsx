import { useState, useEffect } from 'react'
import './App.css'
import LoginScreen from './components/LoginScreen'; // Импортируем наш новый компонент
import { isAuthenticated, removeTokens } from './utils/tokenService'; // Для проверки токена и выхода
import { fetchCurrentUser } from './services/authService'; // Импортируем новый сервис
import {
  fetchContacts,
  fetchPendingRequests,
  sendContactRequest,
  updateContactRequestStatus,
  removeContact
} from './services/contactService'; // Импортируем сервис контактов
import ChatWindow from './components/ChatWindow'; // Импортируем компонент чата

function App() {
  const [currentUser, setCurrentUser] = useState(null); // null означает, что пользователь не вошел
  const [isLoading, setIsLoading] = useState(true); // Для начальной проверки токена
  const [recipientUser, setRecipientUser] = useState(null); // С кем мы общаемся
  const [contacts, setContacts] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [newContactIdInput, setNewContactIdInput] = useState('');
  const [error, setError] = useState(''); // Для общих ошибок UI

  useEffect(() => {
    // Попытка "восстановить" сессию, если токен есть
    const loadUser = async () => {
      console.log("App.jsx: Initial loadUser effect. isAuthenticated():", isAuthenticated());
      if (isAuthenticated()) {
        try {
          console.log("App.jsx: Attempting to fetch current user...");
          const userData = await fetchCurrentUser();
          console.log("App.jsx: User data fetched:", userData);
          setCurrentUser(userData); // userData может быть null, если токен невалиден
        } catch (error) {
          // Ошибка уже обработана в fetchCurrentUser, здесь можно ничего не делать
          // или добавить специфичную логику для App
          console.error("Error loading user in App.jsx", error);
        }
      }
      setIsLoading(false);
    };

    loadUser();
  }, []);

  const loadContactsAndRequests = async () => {
    if (!currentUser) return;
    console.log("App.jsx: loadContactsAndRequests called for user:", currentUser.id);
    try {
      setError('');
      const [contactsData, pendingRequestsData] = await Promise.all([
        fetchContacts(),
        fetchPendingRequests('INCOMING') // Загружаем входящие запросы
      ]);
      setContacts(contactsData || []);
      console.log("App.jsx: Contacts loaded:", contactsData);
      setPendingRequests(pendingRequestsData || []);
    } catch (err) {
      console.error("Failed to load contacts or requests:", err);
      setError(err.message || "Не удалось загрузить данные контактов.");
    }
  };

  useEffect(() => {
    
    console.log("App.jsx: currentUser changed:", currentUser);
    if (currentUser) {
      loadContactsAndRequests();
      // Сбрасываем текущего собеседника при смене пользователя или если его нет в новых контактах
      setRecipientUser(null);
    } else {
      setContacts([]);
      console.log("App.jsx: User logged out or not loaded, clearing contacts and pending requests.");
      setPendingRequests([]);
      setRecipientUser(null);
      setError('');
    }
  }, [currentUser]);

  const handleSelectRecipient = (contact) => {
    // ContactResponseDto имеет userId, username. ChatWindow ожидает id, username.
    console.log("App.jsx: handleSelectRecipient called with contact:", contact);
    setRecipientUser({
      id: contact.userId,
      username: contact.username,
      name: contact.name, // Дополнительная информация, если нужна
      // ... другие поля из contact, если ChatWindow их использует
    });
  };

  const handleSendContactRequest = async () => {
    if (!newContactIdInput.trim()) return;
    console.log("App.jsx: handleSendContactRequest called for ID:", newContactIdInput);
    try {
      setError('');
      await sendContactRequest(newContactIdInput);
      setNewContactIdInput('');
      alert('Запрос на добавление в контакты отправлен!');
      // Можно обновить список исходящих запросов, если он отображается
      loadContactsAndRequests(); // Обновляем данные, т.к. статус мог измениться или появился новый исходящий запрос
    } catch (err) {
      console.error("Failed to send contact request:", err);
      setError(err.message || "Не удалось отправить запрос.");
    }
  };

  const handleUpdateRequestStatus = async (requesterId, status) => {
    console.log(`App.jsx: handleUpdateRequestStatus called for requesterId: ${requesterId}, status: ${status}`);
    try {
      setError('');
      await updateContactRequestStatus(requesterId, status);
      loadContactsAndRequests(); // Обновить списки после действия
    } catch (err) {
      console.error(`Failed to ${status.toLowerCase()} contact request:`, err);
      setError(err.message || `Не удалось ${status === 'ACCEPTED' ? 'принять' : 'отклонить'} запрос.`);
    }
  };

  const handleRemoveContact = async (contactUserId) => {
    if (!window.confirm(`Вы уверены, что хотите удалить контакт User ${contactUserId}?`)) return;
    console.log("App.jsx: handleRemoveContact called for contactUserId:", contactUserId);
    try {
      setError('');
      await removeContact(contactUserId);
      if (recipientUser && recipientUser.id === contactUserId) {
        setRecipientUser(null); // Сбросить чат, если удалили текущего собеседника
      }
      loadContactsAndRequests(); // Обновить список контактов
    } catch (err) {
      console.error("Failed to remove contact:", err);
      setError(err.message || "Не удалось удалить контакт.");
    }
  };

  const handleLogin = (userData) => {
    setCurrentUser(userData); // userData - это объект пользователя от API
    console.log(`App.jsx: handleLogin - ${userData.username || 'User'} has logged in.`, userData);
  };

  const handleLogout = () => {
    console.log("App.jsx: handleLogout called.");
    setCurrentUser(null);
    removeTokens(); // Удаляем токены при выходе
    console.log('App.jsx: User logged out, tokens removed.');
  };

  if (isLoading) {
    // Можно отобразить полноценный компонент загрузки
    console.log("App.jsx: Initial loading state active.");
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Загрузка...</div>;
  }

  return (
    <>
      {!currentUser ? (
        <LoginScreen onLogin={handleLogin} />
      ) : (
        <div className="app-container">
          <div className="sidebar">
            <h3>ChatVerse</h3>
            <p>Вы вошли как: <br/><strong>{currentUser.username || `User ${currentUser.id}`}</strong></p>
            
            {error && <p style={{color: 'red'}}>{error}</p>}

            <div className="sidebar-section">
              <h4>Добавить контакт</h4>
              <div className="add-contact-form">
                <input
                  type="text"
                  className="add-contact-input"
                  placeholder="ID пользователя"
                  value={newContactIdInput}
                  onChange={(e) => setNewContactIdInput(e.target.value)}
                />
                <button onClick={handleSendContactRequest}>Отправить</button>
              </div>
            </div>

            <div className="sidebar-scrollable-area">
              {pendingRequests.length > 0 && (
                <div className="sidebar-section">
                  <h4>Входящие запросы</h4>
                  {pendingRequests.filter(req => req.direction === 'INCOMING' || !req.direction /* API может не возвращать direction */).map(req => (
                    <div key={req.contactEntityId || req.otherUserId} className="pending-request-item">
                      <span>{req.otherUserUsername || req.otherUserName || `User ${req.otherUserId}`}</span>
                      <div>
                        <button onClick={() => handleUpdateRequestStatus(req.otherUserId, 'ACCEPTED')}>Принять</button>
                        <button onClick={() => handleUpdateRequestStatus(req.otherUserId, 'DECLINED')}>Отклонить</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="sidebar-section">
                <h4>Контакты</h4>
                {contacts.length === 0 && <p>У вас пока нет контактов.</p>}
                {contacts.map(contact => (
                  <div key={contact.userId} className={`contact-item ${recipientUser?.id === contact.userId ? 'active' : ''}`} onClick={() => handleSelectRecipient(contact)}>
                    <span>{contact.username || contact.name || `User ${contact.userId}`} {contact.online && <span className="online-indicator">(в сети)</span>}</span>
                    <button className="remove-contact-btn" onClick={(e) => { e.stopPropagation(); handleRemoveContact(contact.userId); }}>X</button>
                  </div>
                ))}
              </div>
            </div>
            <button onClick={handleLogout} className="sidebar-logout-button">Выйти</button>
          </div>
          <div className="chat-area">
            {recipientUser ? (
              <ChatWindow currentUser={currentUser} recipientUser={recipientUser} />
            ) : (
              <div style={{ padding: '20px', textAlign: 'center' }}>Выберите пользователя для начала чата. (Пока не реализовано)</div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
export default App;