import { useState } from 'react';

const BACKEND_URL = 'https://chrome-pingu-backend.onrender.com';

/**
 * Custom hook for handling Stripe upgrade checkout session.
 * Usage: const { upgrade, loading, error } = useStripeUpgrade();
 * Call upgrade('basic') or upgrade('advanced') to trigger upgrade.
 */
export default function useStripeUpgrade() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const upgrade = async (plan) => {
    setLoading(true);
    setError(null);
    try {
      const token = await chrome.storage.local.get('supabaseToken');
      const res = await fetch(`${BACKEND_URL}/api/create-checkout-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token.supabaseToken}`
        },
        body: JSON.stringify({
          plan,
          success_url: 'https://pingu-login.vercel.app/stripe-success.html',
          cancel_url: 'https://pingu-login.vercel.app/stripe-cancel.html'
        })
      });
      const data = await res.json();
      if (res.ok && data?.url) {
        if (chrome && chrome.tabs) {
          chrome.tabs.create({ url: data.url });
        } else {
          window.open(data.url, '_blank');
        }
      } else {
        setError(data?.error || 'Could not start checkout.');
      }
    } catch (e) {
      setError('Network error.');
    } finally {
      setLoading(false);
    }
  };

  return { upgrade, loading, error, setError };
}
