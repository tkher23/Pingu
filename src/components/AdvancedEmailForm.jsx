import React, { useState, useEffect } from 'react';
import { Button, TextInput, Group, Textarea, CopyButton, Notification, Paper, Stack, Divider, Box } from '@mantine/core';
import useProfile from '../hooks/useProfile';
import useCredits from '../hooks/useCredits';
import useGmailSender from '../hooks/useGmailSender';
import useLogin from '../hooks/useLogin';

const AdvancedEmailForm = () => {
  // Profile and credits
  const { profile, getProfile, loading: profileLoading, error: profileError } = useProfile();
  const { credits, fetchCredits, loading: creditsLoading, error: creditsError } = useCredits();
  const sendGmail = useGmailSender();
  const { logout } = useLogin();

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

  // Restore from localStorage on mount
  useEffect(() => {
    setRecipientName(localStorage.getItem('ae_recipientName') || '');
    setRecipientEmail(localStorage.getItem('ae_recipientEmail') || '');
    setLinkedin(localStorage.getItem('ae_linkedin') || '');
    setBio(localStorage.getItem('ae_bio') || '');
    setValues(localStorage.getItem('ae_values') || '');
    setInterest(localStorage.getItem('ae_interest') || '');
    setSubject(localStorage.getItem('ae_subject') || '');
    setBody(localStorage.getItem('ae_body') || '');
  }, []);

  // Persist form state to localStorage
  useEffect(() => { localStorage.setItem('ae_recipientName', recipientName); }, [recipientName]);
  useEffect(() => { localStorage.setItem('ae_recipientEmail', recipientEmail); }, [recipientEmail]);
  useEffect(() => { localStorage.setItem('ae_linkedin', linkedin); }, [linkedin]);
  useEffect(() => { localStorage.setItem('ae_bio', bio); }, [bio]);
  useEffect(() => { localStorage.setItem('ae_values', values); }, [values]);
  useEffect(() => { localStorage.setItem('ae_interest', interest); }, [interest]);
  useEffect(() => { localStorage.setItem('ae_subject', subject); }, [subject]);
  useEffect(() => { localStorage.setItem('ae_body', body); }, [body]);

  // Load profile and credits on mount
  useEffect(() => {
    getProfile();
    fetchCredits();
  }, [getProfile, fetchCredits]);

  useEffect(() => {
    getProfile();
  }, [getProfile]);

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
      fetchCredits(); // Update credits immediately
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
      fetchCredits(); // Update credits immediately
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
      // Clear all fields and localStorage after send
      setRecipientName('');
      setRecipientEmail('');
      setLinkedin('');
      setBio('');
      setValues('');
      setInterest('');
      setSubject('');
      setBody('');
      localStorage.removeItem('ae_recipientName');
      localStorage.removeItem('ae_recipientEmail');
      localStorage.removeItem('ae_linkedin');
      localStorage.removeItem('ae_bio');
      localStorage.removeItem('ae_values');
      localStorage.removeItem('ae_interest');
      localStorage.removeItem('ae_subject');
      localStorage.removeItem('ae_body');
    } catch (err) {
      setSendStatus('❌ Send failed.');
    }
    setTimeout(() => setSendStatus(''), 3000);
  };

  return (
    <Paper shadow="md" radius="md" p="lg" withBorder style={{ background: 'var(--mantine-color-dark-6)', border: '1px solid var(--mantine-color-dark-4)' }}>
      <Stack spacing="xl">
        {(profileError || creditsError) && (
          <Notification color="red" title="Error" mb="md">
            {profileError && <div>Profile: {profileError.toString()}</div>}
            {creditsError && <div>Credits: {creditsError.toString()}</div>}
          </Notification>
        )}
        <Group grow spacing="md" align="flex-end">
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
        </Group>
        <TextInput label="LinkedIn URL" value={linkedin} onChange={e => setLinkedin(e.target.value)} radius="md" size="md"
          styles={{
            input: { background: 'var(--mantine-color-dark-7)', color: 'var(--mantine-color-gray-1)' },
            label: { color: 'var(--mantine-color-gray-2)', fontWeight: 500 }
          }}
        />
        <TextInput label="Bio Page" value={bio} onChange={e => setBio(e.target.value)} radius="md" size="md"
          styles={{
            input: { background: 'var(--mantine-color-dark-7)', color: 'var(--mantine-color-gray-1)' },
            label: { color: 'var(--mantine-color-gray-2)', fontWeight: 500 }
          }}
        />
        <TextInput label="Values Page" value={values} onChange={e => setValues(e.target.value)} radius="md" size="md"
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
        <Divider my="md" label={<span style={{ color: 'var(--mantine-color-gray-4)', fontWeight: 500 }}>Subject</span>} labelPosition="center"/>
        <Group spacing="md" grow align="flex-end">
          <Button onClick={handleGenerateSubject} loading={generating} radius="md" color="blue" style={{ minWidth: 120, fontWeight: 600 }}>Generate</Button>
          <TextInput value={subject} readOnly radius="md" size="md"
            styles={{ input: { background: 'var(--mantine-color-dark-7)', color: 'var(--mantine-color-gray-1)' } }}
          />
          <CopyButton value={subject} timeout={1500}>
            {({ copied, copy }) => (
              <Button color={copied ? 'teal' : 'blue'} onClick={copy} radius="md" style={{ minWidth: 90, fontWeight: 600 }}>
                {copied ? 'Copied' : 'Copy'}
              </Button>
            )}
          </CopyButton>
        </Group>
        <Divider my="md" label={<span style={{ color: 'var(--mantine-color-gray-4)', fontWeight: 500 }}>Email Body</span>} labelPosition="center"/>
        <Group align="flex-end" spacing="md" grow>
          <Button onClick={handleGenerateEmail} loading={generating} radius="md" color="blue" style={{ minWidth: 120, fontWeight: 600 }}>Generate</Button>
          <Textarea value={body} readOnly minRows={4} radius="md" size="md"
            styles={{ input: { background: 'var(--mantine-color-dark-7)', color: 'var(--mantine-color-gray-1)' } }}
          />
          <CopyButton value={body} timeout={1500}>
            {({ copied, copy }) => (
              <Button color={copied ? 'teal' : 'blue'} onClick={copy} radius="md" style={{ minWidth: 90, fontWeight: 600 }}>
                {copied ? 'Copied' : 'Copy'}
              </Button>
            )}
          </CopyButton>
        </Group>
        <Divider my="md"/>
        <Group position="right">
          <Button onClick={handleSendGmail} loading={generating} radius="md" color="teal" style={{ fontWeight: 600 }}>Send with Gmail</Button>
        </Group>
        {sendStatus && <Notification color={sendStatus.includes('✅') ? 'teal' : 'red'}>{sendStatus}</Notification>}
      </Stack>
    </Paper>
  );
};

export default AdvancedEmailForm;
