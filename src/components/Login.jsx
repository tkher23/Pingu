import React from 'react';
import { Button, Stack, Text, Notification } from '@mantine/core';
import useLogin from '../hooks/useLogin';

const Login = ({ onLogin }) => {
  const { loggedIn, loading, error, startLogin } = useLogin();

  React.useEffect(() => {
    if (loggedIn && onLogin) onLogin();
  }, [loggedIn, onLogin]);

  return (
    <div style={{ minHeight: '100vh', minWidth: 360, maxWidth: 440, margin: '0 auto', background: '#e6f3ff', color: '#000a14', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', fontFamily: 'inherit' }}>
      <Stack spacing="md" align="center">
        <img src="/login-image.png" alt="Pingu mascot" style={{ width: 120, height: 120, marginTop: 18, marginBottom: 0, display: 'block', borderRadius: 16, boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }} />
        <Text size="lg" align="center" style={{ fontWeight: 600, marginBottom: 8, marginTop: 8 }}>
          Welcome aboard, Pingu reporting for email duty!
        </Text>
        <Button onClick={startLogin} loading={loading} size="md" style={{ width: 220 }}>
          Login with Google
        </Button>
        {error && <Notification color="red">{error.message}</Notification>}
      </Stack>
    </div>
  );
};

export default Login;
