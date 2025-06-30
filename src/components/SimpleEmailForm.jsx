import React, { useState, useEffect } from 'react';
import { Button, Group, TextInput, Textarea, Paper, Stack, CopyButton, Notification } from '@mantine/core';
import useProfile from '../hooks/useProfile';
import useGmailSender from '../hooks/useGmailSender';
import useCredits from '../hooks/useCredits';

const SimpleEmailForm = () => {
  const { profile, getProfile, error: profileError } = useProfile();
  const sendGmail = useGmailSender();
  const { fetchCredits } = useCredits();

  const [recipientName, setRecipientName] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [interest, setInterest] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [generating, setGenerating] = useState(false);
  const [sendStatus, setSendStatus] = useState('');

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
      fetchCredits(); // Update credits immediately
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
    <Paper shadow="md" radius="md" p="lg" withBorder style={{ background: 'var(--mantine-color-dark-6)', border: '1px solid var(--mantine-color-dark-4)' }}>
      <Stack spacing="xl">
        {(profileError) && (
          <Notification color="red" title="Error" mb="md">
            {profileError && <div>Profile: {profileError.toString()}</div>}
          </Notification>
        )}
        <TextInput label="Recipient Name" value={recipientName} onChange={e => setRecipientName(e.target.value)} radius="md" size="md"
          styles={{
            input: { background: 'var(--mantine-color-dark-7)', color: 'var(--mantine-color-gray-1)' },
            label: { color: 'var(--mantine-color-gray-2)', fontWeight: 500 }
          }}
        />
        <TextInput label="Recipient Email" value={recipientEmail} onChange={e => setRecipientEmail(e.target.value)} radius="md" size="md"
          styles={{
            input: { background: 'var(--mantine-color-dark-7)', color: 'var(--mantine-color-gray-1)' },
            label: { color: 'var(--mantine-color-gray-2)', fontWeight: 500 }
          }}
        />
        <TextInput label="Internship Interest" value={interest} onChange={e => setInterest(e.target.value)} radius="md" size="md"
          styles={{
            input: { background: 'var(--mantine-color-dark-7)', color: 'var(--mantine-color-gray-1)' },
            label: { color: 'var(--mantine-color-gray-2)', fontWeight: 500 }
          }}
        />
        <Group spacing="md" grow align="flex-end">
          <Button onClick={handleGenerate} loading={generating} radius="md" color="blue" style={{ minWidth: 120, fontWeight: 600 }}>Generate</Button>
        </Group>
        <TextInput label="Subject" value={subject} readOnly radius="md" size="md"
          styles={{ input: { background: 'var(--mantine-color-dark-7)', color: 'var(--mantine-color-gray-1)' }, label: { color: 'var(--mantine-color-gray-2)', fontWeight: 500 } }}
        />
        <CopyButton value={subject} timeout={1500}>
          {({ copied, copy }) => (
            <Button color={copied ? 'teal' : 'blue'} onClick={copy} radius="md" style={{ minWidth: 90, fontWeight: 600 }}>
              {copied ? 'Copied' : 'Copy'}
            </Button>
          )}
        </CopyButton>
        <Textarea label="Email Body" value={body} readOnly minRows={4} radius="md" size="md"
          styles={{ input: { background: 'var(--mantine-color-dark-7)', color: 'var(--mantine-color-gray-1)' }, label: { color: 'var(--mantine-color-gray-2)', fontWeight: 500 } }}
        />
        <CopyButton value={body} timeout={1500}>
          {({ copied, copy }) => (
            <Button color={copied ? 'teal' : 'blue'} onClick={copy} radius="md" style={{ minWidth: 90, fontWeight: 600 }}>
              {copied ? 'Copied' : 'Copy'}
            </Button>
          )}
        </CopyButton>
        <Group position="right">
          <Button onClick={handleSendGmail} loading={generating} radius="md" color="teal" style={{ fontWeight: 600 }}>Send with Gmail</Button>
        </Group>
        {sendStatus && <Notification color={sendStatus.includes('✅') ? 'teal' : 'red'}>{sendStatus}</Notification>}
      </Stack>
    </Paper>
  );
};

export default SimpleEmailForm;
