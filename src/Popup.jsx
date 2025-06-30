import React from 'react';
import ReactDOM from 'react-dom/client';
import { MantineProvider } from '@mantine/core';
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';

import useLogin from './hooks/useLogin';
import Login from './components/Login';
import MainUI from './components/MainUI';

const Popup = () => {
  const { loggedIn } = useLogin();
  // Listen for logout event to force re-render
  const [logoutTick, setLogoutTick] = React.useState(0);
  React.useEffect(() => {
    const handler = () => setLogoutTick(t => t + 1);
    window.addEventListener('pingu-logout', handler);
    return () => window.removeEventListener('pingu-logout', handler);
  }, []);
  return loggedIn ? <MainUI /> : <Login />;
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <MantineProvider
    withGlobalStyles
    withNormalizeCSS
    theme={{
      colorScheme: 'dark', // 🔥 Enables dark mode
      fontFamily: 'Inter, sans-serif',
      primaryColor: 'blue',
      defaultRadius: 'md',
    }}
  >
    <Popup />
  </MantineProvider>
);
