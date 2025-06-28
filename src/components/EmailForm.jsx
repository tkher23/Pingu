import React, { useState, useEffect } from 'react';
import useProfile from '../hooks/useProfile';
import useCredits from '../hooks/useCredits';
import useGmailSender from '../hooks/useGmailSender';

const EmailForm = () => {
  // Profile and credits
  const { profile, getProfile, loading: profileLoading } = useProfile();
  const { credits, fetchCredits, loading: creditsLoading } = useCredits();
  const sendGmail = useGmailSender();

  // Form state
  const [recipientName, setRecipientName] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [linkedin, setLinkedin] = useState('');
  const [bio, setBio] = useState('');
  const [values, setValues] = useState('');
  const [interest, setInterest] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sendStatus, setSendStatus] = useState('');
  const [generating, setGenerating] = useState(false);

  // Load profile and credits on mount
  useEffect(() => {
    getProfile();
    fetchCredits();
  }, [getProfile, fetchCredits]);

  // Generate subject line
  const handleGenerateSubject = async () => {
    setGenerating(true);
    setSubject('Generating subject…');
    try {
      const { supabaseToken } = await chrome.storage.local.get('supabaseToken');
      const payload = {
        user_info: { intro: profile.intro || '' },
        company_of_interest: profile.company_interest || ''
      };
      const res = await fetch(
        `${process.env.BACKEND_URL || 'https://chrome-pingu-backend.onrender.com'}/api/generate-subject`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${supabaseToken}`
          },
          body: JSON.stringify(payload)
        }
      );
      const data = await res.json();
      setSubject(data.subject || 'No subject generated.');
      fetchCredits();
    } catch (err) {
      setSubject('Error generating subject.');
    } finally {
      setGenerating(false);
    }
  };

  // Generate email body
  const handleGenerateEmail = async () => {
    setGenerating(true);
    setBody('Crafting email…');
    try {
      const { supabaseToken } = await chrome.storage.local.get('supabaseToken');
      const internshipInterest = interest.trim() || profile.default_interest || '';
      const payload = {
        user_info: {
          name: profile.name || '',
          intro: profile.intro || '',
          persona_context: profile.persona_context || '',
          company_interest: profile.company_interest || '',
          role_type: profile.role_type || 'internship'
        },
        recipient_name: recipientName.trim(),
        linkedin,
        bio_page: bio,
        values_page: values,
        internship_interest: internshipInterest
      };
      const res = await fetch(
        `${process.env.BACKEND_URL || 'https://chrome-pingu-backend.onrender.com'}/api/process-single-profile`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${supabaseToken}`
          },
          body: JSON.stringify(payload)
        }
      );
      const data = await res.json();
      setBody(data.generated_email || 'No email generated.');
      fetchCredits();
    } catch (err) {
      setBody('Error generating email.');
    } finally {
      setGenerating(false);
    }
  };

  // Send email via Gmail
  const handleSendGmail = async () => {
    if (!recipientEmail || !subject || !body) {
      setSendStatus('Missing recipient email, subject, or body');
      return;
    }
    try {
      await sendGmail(recipientEmail, subject, body);
      setSendStatus('✅ Email sent!');
    } catch (err) {
      setSendStatus('❌ Send failed.');
    }
    setTimeout(() => setSendStatus(''), 3000);
  };

  return (
    <div>
      <h3>Email Generator</h3>
      <div>Credits: {creditsLoading ? 'Loading...' : credits ?? 'N/A'}</div>
      <div>
        <input
          placeholder="Recipient Name"
          value={recipientName}
          onChange={e => setRecipientName(e.target.value)}
        />
        <input
          placeholder="Recipient Email"
          value={recipientEmail}
          onChange={e => setRecipientEmail(e.target.value)}
        />
        <input
          placeholder="LinkedIn URL"
          value={linkedin}
          onChange={e => setLinkedin(e.target.value)}
        />
        <input
          placeholder="Bio Page"
          value={bio}
          onChange={e => setBio(e.target.value)}
        />
        <input
          placeholder="Values Page"
          value={values}
          onChange={e => setValues(e.target.value)}
        />
        <input
          placeholder="Internship Interest"
          value={interest}
          onChange={e => setInterest(e.target.value)}
        />
      </div>
      <div style={{ marginTop: 8 }}>
        <button onClick={handleGenerateSubject} disabled={generating}>
          Generate Subject
        </button>
        <input
          style={{ width: '100%' }}
          value={subject}
          readOnly
        />
        <button
          onClick={() => {
            navigator.clipboard.writeText(subject);
          }}
        >
          Copy Subject
        </button>
      </div>
      <div style={{ marginTop: 8 }}>
        <button onClick={handleGenerateEmail} disabled={generating}>
          Generate Email
        </button>
        <textarea
          style={{ width: '100%', minHeight: 100 }}
          value={body}
          readOnly
        />
        <button
          onClick={() => {
            navigator.clipboard.writeText(body);
          }}
        >
          Copy Email
        </button>
      </div>
      <div style={{ marginTop: 8 }}>
        <button onClick={handleSendGmail} disabled={generating}>
          Send with Gmail
        </button>
        <span>{sendStatus}</span>
      </div>
    </div>
  );
};

export default EmailForm;
