import React, { useState, useEffect } from 'react';
import { Button, TextInput, Group, Textarea, CopyButton, Notification, Paper, Title, Stack, Divider, Box } from '@mantine/core';
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
    <Paper shadow="md" radius="md" p="lg" withBorder>
      <Stack spacing="md">
        <Title order={3} align="center" color="blue.7">Email Generator</Title>
        <Group position="apart">
          <Box fw={500}>Credits:</Box>
          <Box>{creditsLoading ? 'Loading...' : credits ?? 'N/A'}</Box>
        </Group>
        <Divider my="xs" label="Recipient Info" labelPosition="center"/>
        <Group grow>
          <TextInput label="Recipient Name" value={recipientName} onChange={e => setRecipientName(e.target.value)} radius="md" size="md"/>
          <TextInput label="Recipient Email" value={recipientEmail} onChange={e => setRecipientEmail(e.target.value)} radius="md" size="md"/>
        </Group>
        <TextInput label="LinkedIn URL" value={linkedin} onChange={e => setLinkedin(e.target.value)} radius="md" size="md"/>
        <TextInput label="Bio Page" value={bio} onChange={e => setBio(e.target.value)} radius="md" size="md"/>
        <TextInput label="Values Page" value={values} onChange={e => setValues(e.target.value)} radius="md" size="md"/>
        <TextInput label="Internship Interest" value={interest} onChange={e => setInterest(e.target.value)} radius="md" size="md"/>
        <Divider my="xs" label="Subject" labelPosition="center"/>
        <Group>
          <Button onClick={handleGenerateSubject} loading={generating} color="blue" radius="md">Generate Subject</Button>
          <TextInput value={subject} readOnly style={{ flex: 1 }} radius="md" size="md"/>
          <CopyButton value={subject} timeout={1500}>
            {({ copied, copy }) => (
              <Button color={copied ? 'teal' : 'blue'} onClick={copy} radius="md">
                {copied ? 'Copied' : 'Copy Subject'}
              </Button>
            )}
          </CopyButton>
        </Group>
        <Divider my="xs" label="Email Body" labelPosition="center"/>
        <Group align="flex-start">
          <Button onClick={handleGenerateEmail} loading={generating} color="blue" radius="md">Generate Email</Button>
          <Textarea value={body} readOnly minRows={4} style={{ flex: 1 }} radius="md" size="md"/>
          <CopyButton value={body} timeout={1500}>
            {({ copied, copy }) => (
              <Button color={copied ? 'teal' : 'blue'} onClick={copy} radius="md">
                {copied ? 'Copied' : 'Copy Email'}
              </Button>
            )}
          </CopyButton>
        </Group>
        <Divider my="xs"/>
        <Group position="right">
          <Button onClick={handleSendGmail} loading={generating} color="teal" radius="md">Send with Gmail</Button>
        </Group>
        {sendStatus && <Notification color={sendStatus.includes('✅') ? 'teal' : 'red'}>{sendStatus}</Notification>}
      </Stack>
    </Paper>
  );
};

export default EmailForm;
