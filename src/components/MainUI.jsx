import React from 'react';
import useLogin from '../hooks/useLogin';
import useProfile from '../hooks/useProfile';
import useCredits from '../hooks/useCredits';
import EmailForm from './EmailForm';

const MainUI = () => {
  const { logout } = useLogin();
  const { profile, loading: profileLoading } = useProfile();
  const { credits, loading: creditsLoading } = useCredits();

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <b>{profileLoading ? 'Loading...' : profile.name || 'User'}</b>
        </div>
        <button onClick={logout}>Logout</button>
      </div>
      <div style={{ margin: '8px 0' }}>
        Credits: {creditsLoading ? 'Loading...' : credits ?? 'N/A'}
      </div>
      <EmailForm />
    </div>
  );
};

export default MainUI;
