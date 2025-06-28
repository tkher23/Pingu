import React from 'react';
import useLogin from '../hooks/useLogin';

const Login = ({ onLogin }) => {
  const { loggedIn, loading, error, startLogin } = useLogin();

  React.useEffect(() => {
    if (loggedIn && onLogin) onLogin();
  }, [loggedIn, onLogin]);

  return (
    <div>
      <h3>Login</h3>
      <button onClick={startLogin} disabled={loading}>
        {loading ? 'Logging in...' : 'Login with Google'}
      </button>
      {error && <div style={{ color: 'red' }}>{error.message}</div>}
    </div>
  );
};

export default Login;
