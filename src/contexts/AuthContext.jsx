import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { fetchCurrentUser } from '../services/authService';
import { isAuthenticated, saveTokens, removeTokens, getAccessToken } from '../utils/tokenService';

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [token, setToken] = useState(getAccessToken()); // Initialize token from storage
  const [isLoading, setIsLoading] = useState(true); // To track initial auth check

  const loadUser = useCallback(async () => {
    console.log("AuthContext: loadUser initiated. isAuthenticated():", isAuthenticated());
    if (isAuthenticated()) { // Checks if a token exists and is potentially valid
      const currentToken = getAccessToken();
      setToken(currentToken); // Ensure token state is up-to-date
      try {
        console.log("AuthContext: Attempting to fetch current user...");
        const userData = await fetchCurrentUser();
        console.log("AuthContext: User data fetched:", userData);
        setCurrentUser(userData);
      } catch (error) {
        console.error("AuthContext: Failed to fetch current user", error);
        // If fetching user fails (e.g., token expired), clear auth state
        removeTokens();
        setToken(null);
        setCurrentUser(null);
      }
    } else {
      console.log("AuthContext: No token found or user not authenticated, clearing user state.");
      setCurrentUser(null);
      setToken(null);
    }
    setIsLoading(false);
    console.log("AuthContext: loadUser finished. isLoading set to false.");
  }, []);

  useEffect(() => {
    console.log("AuthContext: Initial useEffect to loadUser.");
    loadUser();
  }, [loadUser]);

  const login = useCallback(async (userData, accessToken, refreshToken) => {
    console.log("AuthContext: login called with userData:", userData);
    saveTokens(accessToken, refreshToken); // Save tokens to localStorage
    setToken(accessToken);
    setCurrentUser(userData);
    console.log("AuthContext: User logged in, state updated.");
    // No need to call fetchCurrentUser here if login endpoint already returns user data
  }, []);

  const logout = useCallback(() => {
    console.log("AuthContext: logout called.");
    removeTokens();
    setToken(null);
    setCurrentUser(null);
    console.log("AuthContext: User logged out, state cleared.");
    // Any other cleanup, e.g., disconnect WebSocket if managed here (though WebSocketContext handles its own)
  }, []);

  const value = {
    currentUser,
    token,
    isAuthenticated: !!currentUser && !!token, 
    isLoading,
    login,
    logout,
    reloadUser: loadUser // Expose a way to manually reload user if needed
  };

  // Don't render children until initial auth check is complete
  // or provide a loading state if preferred for the entire app
  // if (isLoading) {
  //   return <div>Loading authentication...</div>;
  // }

  // console.log("AuthContext: Rendering Provider. isLoading:", isLoading, "isAuthenticated:", !!currentUser && !!token);
  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};