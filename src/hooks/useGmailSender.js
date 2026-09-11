import { useCallback } from 'react';

// Sends an email using the Gmail API and the stored gmailToken from chrome.storage.local
const useGmailSender = () => {
  // sendGmail: (toEmail, subject, body) => Promise<void>
  const sendGmail = useCallback(async (toEmail, subject, body) => {
    const { gmailToken } = await chrome.storage.local.get("gmailToken");
    if (!gmailToken) throw new Error("No Gmail token found. Please log in.");

    // Fetch user's Gmail signature
    let signature = '';
    try {
      const sendAsRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/settings/sendAs', {
        headers: { Authorization: `Bearer ${gmailToken}` }
      });
      const sendAsData = await sendAsRes.json();
      const primarySendAs = sendAsData.sendAs?.find(sa => sa.isPrimary);
      signature = primarySendAs?.signature || '';
    } catch {}

    // Always send as HTML to preserve line breaks and formatting
    const contentType = 'text/html; charset=UTF-8';
    
    // Convert line breaks to HTML and combine with signature
    const htmlBody = body.replace(/\n/g, '<br>');
    const isHtml = signature && /<[a-z][\s\S]*>/i.test(signature);
    const fullBody = isHtml ? `${htmlBody}<br><br>${signature}` : `${htmlBody}<br><br>${signature.replace(/\n/g, '<br>')}`;

    // Proper RFC 5322 message formatting
    const message = [
      `From: me`,
      `To: ${toEmail}`,
      `Subject: ${subject}`,
      `MIME-Version: 1.0`,
      `Content-Type: ${contentType}`,
      '',
      fullBody
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
