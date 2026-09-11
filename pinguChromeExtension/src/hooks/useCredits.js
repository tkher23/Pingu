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
      console.debug('[useCredits] Fetching credits with token:', supabaseToken);
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
        const errText = await res.text();
        setCredits(null);
        console.error('[useCredits] Error loading credits:', errText);
        throw new Error('Error loading credits: ' + errText);
      }
    } catch (err) {
      setError(err.message || err);
      setCredits(null);
      console.error('[useCredits] Error:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { credits, fetchCredits, loading, error };
};

export default useCredits;
