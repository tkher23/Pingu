// Entry point for the popup UI
import React from 'react';
import useLogin from './hooks/useLogin';
import Login from './components/Login';
import MainUI from './components/MainUI';

const Popup = () => {
  const { loggedIn } = useLogin();
  return loggedIn ? <MainUI /> : <Login />;
};

export default Popup;
