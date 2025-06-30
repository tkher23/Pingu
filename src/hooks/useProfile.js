import { useState, useEffect, useCallback } from 'react';
import { BACKEND_URL } from '../utils/constants';

// Fetches and saves user profile using the backend API and userToken from chrome.storage
const useProfile = () => {
  const [profile, setProfile] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch profile
  const getProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { supabaseToken } = await chrome.storage.local.get('supabaseToken');
      if (!supabaseToken) throw new Error('No user token');
      console.debug('[useProfile] Fetching profile with token:', supabaseToken);
      const res = await fetch(`${BACKEND_URL}/api/user-settings`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${supabaseToken}` }
      });
      if (!res.ok) {
        const errText = await res.text();
        console.error('[useProfile] Failed to fetch user settings:', errText);
        throw new Error('Failed to fetch user settings: ' + errText);
      }
      const data = await res.json();
      setProfile(data);
      return data;
    } catch (err) {
      setError(err.message || err);
      setProfile({});
      console.error('[useProfile] Error:', err);
      return {};
    } finally {
      setLoading(false);
    }
  }, []);

  // Save profile
  const saveProfile = useCallback(async (profileObj) => {
    setLoading(true);
    setError(null);
    try {
      const { supabaseToken } = await chrome.storage.local.get('supabaseToken');
      if (!supabaseToken) throw new Error('No user token');
      console.debug('[useProfile] Saving profile with token:', supabaseToken, profileObj);
      const res = await fetch(`${BACKEND_URL}/api/user-settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseToken}`
        },
        body: JSON.stringify(profileObj)
      });
      if (!res.ok) {
        const errText = await res.text();
        console.error('[useProfile] Failed to save user settings:', errText);
        throw new Error('Failed to save user settings: ' + errText);
      }
      setProfile(profileObj);
    } catch (err) {
      setError(err.message || err);
      console.error('[useProfile] Error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  return { profile, getProfile, saveProfile, loading, error };
};

export default useProfile;
