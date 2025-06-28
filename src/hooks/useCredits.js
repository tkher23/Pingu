import { useState, useCallback } from 'react';
import { BACKEND_URL } from '../utils/constants';

// Fetches user credits from the backend API using userToken from chrome.storage
const useCredits = () => {
  const [credits, setCredits] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchCredits = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { supabaseToken } = await chrome.storage.local.get('supabaseToken');
      if (!supabaseToken) throw new Error('No user token');
      const res = await fetch(`${BACKEND_URL}/api/get-credits`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${supabaseToken}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setCredits(data.credits);
        return data.credits;
      } else {
        setCredits(null);
        throw new Error('Error loading credits');
      }
    } catch (err) {
      setError(err);
      setCredits(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { credits, fetchCredits, loading, error };
};

export default useCredits;
