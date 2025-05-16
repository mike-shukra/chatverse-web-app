import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import '@chatscope/chat-ui-kit-styles/dist/default/styles.min.css';
import App from './App.jsx'
import { AuthProvider } from './contexts/AuthContext.jsx'; // Добавляем импорт AuthProvider
import { WebSocketProvider } from './contexts/WebSocketContext.jsx'; // Добавляем импорт WebSocketProvider

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <WebSocketProvider>
        <App />
      </WebSocketProvider>
    </AuthProvider>
  </StrictMode>
)
