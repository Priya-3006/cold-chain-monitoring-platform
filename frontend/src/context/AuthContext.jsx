import React, { createContext, useContext, useState, useEffect } from 'react';
import { authApi } from '../api/client.js';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('coldchain_token') || null);
  const [loading, setLoading] = useState(true);
  const [demoUsers, setDemoUsers] = useState([]);

  useEffect(() => {
    // Load demo users roster for quick switching
    authApi.getDemoUsers()
      .then(res => setDemoUsers(res.users || []))
      .catch(() => {});

    // Validate current token
    if (token) {
      authApi.getMe()
        .then(res => setUser(res.user))
        .catch(() => {
          localStorage.removeItem('coldchain_token');
          setToken(null);
          setUser(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [token]);

  const login = async (identifier, password) => {
    const res = await authApi.login(identifier, password);
    localStorage.setItem('coldchain_token', res.token);
    setToken(res.token);
    setUser(res.user);
    return res.user;
  };

  /**
   * One-click demo role switcher for reviewer evaluation
   */
  const quickSwitchRole = async (targetRole) => {
    const demoUser = demoUsers.find(u => u.role.toLowerCase() === targetRole.toLowerCase());
    if (demoUser) {
      return await login(demoUser.email, 'password123');
    }
    throw new Error(`Demo account for role '${targetRole}' not found.`);
  };

  const logout = () => {
    localStorage.removeItem('coldchain_token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      token,
      loading,
      demoUsers,
      login,
      quickSwitchRole,
      logout,
      isAuthenticated: Boolean(user)
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
