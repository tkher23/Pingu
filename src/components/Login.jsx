import React from 'react';
import { Button, Group, Text, Notification } from '@mantine/core';
import useLogin from '../hooks/useLogin';

const Login = ({ onLogin }) => {
  const { loggedIn, loading, error, startLogin } = useLogin();

  React.useEffect(() => {
    if (loggedIn && onLogin) onLogin();
  }, [loggedIn, onLogin]);

  return (
    <Group direction="column" spacing="md" position="center" style={{ minHeight: 200 }}>
      <Text size="xl" weight={700}>Sign in to Pingu</Text>
      <Button onClick={startLogin} loading={loading} size="md">
        Login with Google
      </Button>
      {error && <Notification color="red">{error.message}</Notification>}
    </Group>
  );
};

export default Login;
