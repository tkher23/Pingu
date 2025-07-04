import React, { useState, useEffect } from 'react';
import { Button, Group, TextInput, Textarea, Stack, CopyButton, Notification } from '@mantine/core';
import useProfile from '../hooks/useProfile';
import useGmailSender from '../hooks/useGmailSender';

const blueButtonStyle = {
  background: '#e6f3ff',
  color: '#000a14',
  border: '1px solid #000a14',
  fontWeight: 600,
  fontSize: 14,
  transition: 'background 0.15s, color 0.15s, border 0.15s',
};
const blueButtonHover = {
  background: '#5fafde',
  color: 'white',
  border: 'none',
};

const SimpleEmailForm = ({ credits, creditsLoading, creditsError, fetchCredits }) => {
  const { profile, getProfile, error: profileError } = useProfile();
  const sendGmail = useGmailSender();

  const [recipientName, setRecipientName] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [interest, setInterest] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [generating, setGenerating] = useState(false);
  const [sendStatus, setSendStatus] = useState('');
  const [hoveredGenerate, setHoveredGenerate] = useState(false);
  const [hoveredCopySubject, setHoveredCopySubject] = useState(false);
  const [hoveredCopyBody, setHoveredCopyBody] = useState(false);

  useEffect(() => {
    getProfile();
  }, [getProfile]);

  // Restore from localStorage on mount
  useEffect(() => {
    setRecipientName(localStorage.getItem('se_recipientName') || '');
    setRecipientEmail(localStorage.getItem('se_recipientEmail') || '');
    setInterest(localStorage.getItem('se_interest') || '');
    setSubject(localStorage.getItem('se_subject') || '');
    setBody(localStorage.getItem('se_body') || '');
  }, []);

  // If Internship Interest is empty after profile loads, set it to default_interest
  useEffect(() => {
    if (profile && profile.default_interest && !interest) {
      setInterest(profile.default_interest);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  // Persist to localStorage on change
  useEffect(() => { localStorage.setItem('se_recipientName', recipientName); }, [recipientName]);
  useEffect(() => { localStorage.setItem('se_recipientEmail', recipientEmail); }, [recipientEmail]);
  useEffect(() => { localStorage.setItem('se_interest', interest); }, [interest]);
  useEffect(() => { localStorage.setItem('se_subject', subject); }, [subject]);
  useEffect(() => { localStorage.setItem('se_body', body); }, [body]);

  const handleGenerate = async () => {
    setGenerating(true);
    setBody('Generating...');
    setSubject('Generating...');
    try {
      const { supabaseToken } = await chrome.storage.local.get('supabaseToken');
      const payload = {
        user_info: {
          name: profile.name || '',
          intro: profile.intro || '',
          company_interest: profile.company_interest || ''
        },
        recipient_name: recipientName.trim(),
        internship_interest: interest.trim()
      };
      const subjectPayload = {
        user_info: { intro: profile.intro || '' },
        company_of_interest: profile.company_interest || ''
      };
      const emailRes = await fetch(
        `${process.env.BACKEND_URL || 'https://chrome-pingu-backend.onrender.com'}/api/simple-email`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${supabaseToken}`
          },
          body: JSON.stringify(payload)
        }
      );
      const emailData = await emailRes.json();
      setBody(emailData.generated_email || 'No email generated.');
      const subjectRes = await fetch(
        `${process.env.BACKEND_URL || 'https://chrome-pingu-backend.onrender.com'}/api/generate-subject`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${supabaseToken}`
          },
          body: JSON.stringify(subjectPayload)
        }
      );
      const subjectData = await subjectRes.json();
      setSubject(subjectData.subject || 'No subject generated.');
      if (fetchCredits) fetchCredits(); // Use prop
    } catch (err) {
      setBody('Error generating email.');
      setSubject('Error generating subject.');
    } finally {
      setGenerating(false);
    }
  };

  const handleSendGmail = async () => {
    if (!recipientEmail || !subject || !body) {
      setSendStatus('Missing recipient email, subject, or body');
      return;
    }
    try {
      await sendGmail(recipientEmail, subject, body);
      setSendStatus('✅ Email sent!');
      // Clear all fields and localStorage after send
      setRecipientName('');
      setRecipientEmail('');
      setInterest('');
      setSubject('');
      setBody('');
      localStorage.removeItem('se_recipientName');
      localStorage.removeItem('se_recipientEmail');
      localStorage.removeItem('se_interest');
      localStorage.removeItem('se_subject');
      localStorage.removeItem('se_body');
    } catch (err) {
      setSendStatus('❌ Send failed.');
    }
    setTimeout(() => setSendStatus(''), 3000);
  };

  return (
    <form style={{ background: '#e6f3ff', borderRadius: 12, padding: 0, color: '#000a14', fontFamily: 'inherit' }}>
      <Stack spacing="xl">
        {(profileError || creditsError) && (
          <Notification color="red" title="Error" mb="md">
            {profileError && <div>Profile: {profileError.toString()}</div>}
            {creditsError && <div>Credits: {creditsError.toString()}</div>}
          </Notification>
        )}
        <TextInput label="Recipient Name" value={recipientName} onChange={e => setRecipientName(e.target.value)} radius="md" size="sm"
          styles={{ input: { background: '#e6f3ff', color: '#000a14', border: '1px solid #000a14', boxShadow: 'none' }, label: { color: '#000a14', fontWeight: 500 } }}
          classNames={{ input: 'custom-input' }}
          mb={8}
        />
        <TextInput label="Recipient Email" value={recipientEmail} onChange={e => setRecipientEmail(e.target.value)} radius="md" size="sm"
          styles={{ input: { background: '#e6f3ff', color: '#000a14', border: '1px solid #000a14', boxShadow: 'none' }, label: { color: '#000a14', fontWeight: 500 } }}
          classNames={{ input: 'custom-input' }}
          mb={8}
        />
        <TextInput label="Career Interest" value={interest} onChange={e => setInterest(e.target.value)} radius="md" size="sm"
          styles={{ input: { background: '#e6f3ff', color: '#000a14', border: '1px solid #000a14', boxShadow: 'none' }, label: { color: '#000a14', fontWeight: 500 } }}
          classNames={{ input: 'custom-input' }}
          mb={8}
        />
        <Group spacing="md" grow align="flex-end">
          <Button
            onClick={handleGenerate}
            loading={generating}
            radius="md"
            style={{ ...blueButtonStyle, ...(hoveredGenerate ? blueButtonHover : {}) }}
            onMouseEnter={() => setHoveredGenerate(true)}
            onMouseLeave={() => setHoveredGenerate(false)}
          >
            Generate
          </Button>
        </Group>
        <TextInput label="Subject" value={subject} onChange={e => setSubject(e.target.value)} radius="md" size="sm"
          styles={{ input: { background: '#e6f3ff', color: '#000a14', border: '1px solid #000a14', boxShadow: 'none' }, label: { color: '#000a14', fontWeight: 500 } }}
          classNames={{ input: 'custom-input' }}
        />
        <CopyButton value={subject} timeout={1500}>
          {({ copied, copy }) => (
            <Button
              style={{ ...blueButtonStyle, ...(hoveredCopySubject ? blueButtonHover : {}) }}
              onClick={copy}
              radius="md"
              onMouseEnter={() => setHoveredCopySubject(true)}
              onMouseLeave={() => setHoveredCopySubject(false)}
            >
              {copied ? 'Copied' : 'Copy'}
            </Button>
          )}
        </CopyButton>
        <Textarea label="Email Body" value={body} onChange={e => setBody(e.target.value)} minRows={4} radius="md" size="sm"
          styles={{ input: { background: '#e6f3ff', color: '#000a14', border: '1px solid #000a14', boxShadow: 'none' }, label: { color: '#000a14', fontWeight: 500 } }}
          classNames={{ input: 'custom-input' }}
        />
        <CopyButton value={body} timeout={1500}>
          {({ copied, copy }) => (
            <Button
              style={{ ...blueButtonStyle, ...(hoveredCopyBody ? blueButtonHover : {}) }}
              onClick={copy}
              radius="md"
              onMouseEnter={() => setHoveredCopyBody(true)}
              onMouseLeave={() => setHoveredCopyBody(false)}
            >
              {copied ? 'Copied' : 'Copy'}
            </Button>
          )}
        </CopyButton>
        <Group position="right">
          <Button onClick={handleSendGmail} loading={generating} radius="md" color="teal" style={{ fontWeight: 600 }}>Send with Gmail</Button>
        </Group>
        {sendStatus && <Notification color={sendStatus.includes('✅') ? 'teal' : 'red'}>{sendStatus}</Notification>}
      </Stack>
      <style>{`.custom-input:focus { border: 1.5px solid #5fafde !important; box-shadow: 0 0 0 1.5px #5fafde !important; }`}</style>
    </form>
  );
};

export default SimpleEmailForm;
