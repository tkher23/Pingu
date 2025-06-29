import React, { useState } from 'react';
import { Button, Group, TextInput, Textarea, Paper, Stack, CopyButton, Notification } from '@mantine/core';
import useProfile from '../hooks/useProfile';
import useCredits from '../hooks/useCredits';
import useGmailSender from '../hooks/useGmailSender';

const SimpleEmailForm = () => {
  const { profile } = useProfile();
  const { credits, loading: creditsLoading, fetchCredits } = useCredits();
  const sendGmail = useGmailSender();

  const [recipientName, setRecipientName] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [interest, setInterest] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [generating, setGenerating] = useState(false);
  const [sendStatus, setSendStatus] = useState('');

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
      fetchCredits();
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
    } catch (err) {
      setSendStatus('❌ Send failed.');
    }
    setTimeout(() => setSendStatus(''), 3000);
  };

  return (
    <Paper shadow="md" radius="md" p="lg" withBorder>
      <Stack spacing="md">
        <Group position="apart">
          <span style={{ fontWeight: 500 }}>Credits:</span>
          <span>{creditsLoading ? 'Loading...' : credits ?? 'N/A'}</span>
        </Group>
        <TextInput label="Recipient Name" value={recipientName} onChange={e => setRecipientName(e.target.value)} radius="md" size="md"/>
        <TextInput label="Recipient Email" value={recipientEmail} onChange={e => setRecipientEmail(e.target.value)} radius="md" size="md"/>
        <TextInput label="Internship Interest" value={interest} onChange={e => setInterest(e.target.value)} radius="md" size="md"/>
        <Group>
          <Button onClick={handleGenerate} loading={generating} color="blue" radius="md">Generate Simple Email</Button>
        </Group>
        <TextInput label="Subject" value={subject} readOnly radius="md" size="md"/>
        <CopyButton value={subject} timeout={1500}>
          {({ copied, copy }) => (
            <Button color={copied ? 'teal' : 'blue'} onClick={copy} radius="md">
              {copied ? 'Copied' : 'Copy Subject'}
            </Button>
          )}
        </CopyButton>
        <Textarea label="Email Body" value={body} readOnly minRows={4} radius="md" size="md"/>
        <CopyButton value={body} timeout={1500}>
          {({ copied, copy }) => (
            <Button color={copied ? 'teal' : 'blue'} onClick={copy} radius="md">
              {copied ? 'Copied' : 'Copy Email'}
            </Button>
          )}
        </CopyButton>
        <Group position="right">
          <Button onClick={handleSendGmail} loading={generating} color="teal" radius="md">Send with Gmail</Button>
        </Group>
        {sendStatus && <Notification color={sendStatus.includes('✅') ? 'teal' : 'red'}>{sendStatus}</Notification>}
      </Stack>
    </Paper>
  );
};

export default SimpleEmailForm;
