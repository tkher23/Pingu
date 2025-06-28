import { useCallback } from 'react';

// Sends an email using the Gmail API and the stored gmailToken from chrome.storage.local
const useGmailSender = () => {
  // sendGmail: (toEmail, subject, body) => Promise<void>
  const sendGmail = useCallback(async (toEmail, subject, body) => {
    const { gmailToken } = await chrome.storage.local.get("gmailToken");
    if (!gmailToken) throw new Error("No Gmail token found. Please log in.");

    const message = [
      `To: ${toEmail}`,
      `Subject: ${subject}`,
      '',
      body
    ].join('\n');

    const rawBase64 = btoa(unescape(encodeURIComponent(message)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${gmailToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ raw: rawBase64 })
    });

    if (!res.ok) {
      let errMsg = "Failed to send Gmail";
      try {
        const err = await res.json();
        errMsg = err.error?.message || errMsg;
      } catch {}
      throw new Error(errMsg);
    }
  }, []);

  return sendGmail;
};

export default useGmailSender;
