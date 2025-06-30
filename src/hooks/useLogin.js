import React, { useState, useCallback } from 'react';
import { LOGIN_URL } from '../utils/constants';

// Handles login flow for the extension
const useLogin = () => {
  const [loggedIn, setLoggedIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Check login state on demand
  const checkLogin = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { supabaseToken } = await chrome.storage.local.get('supabaseToken');
      setLoggedIn(!!supabaseToken);
      return !!supabaseToken;
    } catch (err) {
      setError(err);
      setLoggedIn(false);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  // Start login flow
  const startLogin = useCallback(() => {
    setLoading(true);
    setError(null);
    chrome.storage.local.remove('supabaseToken', () => {
      const port = chrome.runtime.connect();
      port.postMessage({ type: 'login' });
      setLoading(false);
    });
  }, []);

  // Listen for login completion
  React.useEffect(() => {
    const handler = (message) => {
      if (message.type === 'loginComplete') {
        setLoggedIn(true);
      }
    };
    chrome.runtime.onMessage.addListener(handler);
    checkLogin();
    return () => chrome.runtime.onMessage.removeListener(handler);
  }, [checkLogin]);

  // Logout
  const logout = useCallback(async () => {
    await chrome.storage.local.remove('supabaseToken');
    setLoggedIn(false);
    // Notify listeners (e.g., Popup.jsx) that logout occurred
    window.dispatchEvent(new Event('pingu-logout'));
  }, []);

  return { loggedIn, loading, error, startLogin, logout, checkLogin };
};

export default useLogin;
