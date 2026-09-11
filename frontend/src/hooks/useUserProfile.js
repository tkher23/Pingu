import { useState, useEffect, useCallback } from 'react';
import { BACKEND_URL } from '../utils/constants';

// Fetches user plan/subscription info from the backend API
const useUserProfile = () => {
  const [userProfile, setUserProfile] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch user profile (plan/credits)
  const fetchUserProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { supabaseToken } = await chrome.storage.local.get('supabaseToken');
      if (!supabaseToken) throw new Error('No user token');
      const res = await fetch(`${BACKEND_URL}/api/user-profile`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${supabaseToken}` }
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error('Failed to fetch user profile: ' + errText);
      }
      const data = await res.json();
      setUserProfile(data);
      return data;
    } catch (err) {
      setError(err.message || err);
      setUserProfile({});
      return {};
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUserProfile();
  }, [fetchUserProfile]);

  return { userProfile, fetchUserProfile, loading, error };
};

export default useUserProfile;
