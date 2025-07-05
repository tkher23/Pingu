import React, { useState, useEffect } from 'react';
import { Button, TextInput, Group, Textarea, CopyButton, Notification, Stack, Modal, Text } from '@mantine/core';
import useProfile from '../hooks/useProfile';
import useGmailSender from '../hooks/useGmailSender';
import useLogin from '../hooks/useLogin';

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

const AdvancedEmailForm = ({ credits, creditsLoading, creditsError, fetchCredits }) => {
  // Profile and credits
  const { profile, getProfile, loading: profileLoading, error: profileError } = useProfile();
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

  const [hoveredGenerateEmail, setHoveredGenerateEmail] = useState(false);
  const [hoveredCopySubject, setHoveredCopySubject] = useState(false);
  const [hoveredCopyBody, setHoveredCopyBody] = useState(false);

  const [showOnboarding, setShowOnboarding] = useState(false);

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

  useEffect(() => {
    if (!localStorage.getItem('hasSeenAdvancedOnboarding')) {
      setShowOnboarding(true);
    }
  }, []);

  const handleCloseOnboarding = () => {
    setShowOnboarding(false);
    localStorage.setItem('hasSeenAdvancedOnboarding', 'true');
  };

  // If Internship Interest is empty after profile loads, set it to default_interest
  useEffect(() => {
    if (profile && profile.default_interest && !interest) {
      setInterest(profile.default_interest);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  // Persist form state to localStorage
  useEffect(() => { localStorage.setItem('ae_recipientName', recipientName); }, [recipientName]);
  useEffect(() => { localStorage.setItem('ae_recipientEmail', recipientEmail); }, [recipientEmail]);
  useEffect(() => { localStorage.setItem('ae_linkedin', linkedin); }, [linkedin]);
  useEffect(() => { localStorage.setItem('ae_bio', bio); }, [bio]);
  useEffect(() => { localStorage.setItem('ae_values', values); }, [values]);
  useEffect(() => { localStorage.setItem('ae_interest', interest); }, [interest]);
  useEffect(() => { localStorage.setItem('ae_subject', subject); }, [subject]);
  useEffect(() => { localStorage.setItem('ae_body', body); }, [body]);

  // Load profile on mount
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
    } catch (err) {
      setSubject('Error generating subject.');
    }
  };

  // Generate email body
  const handleGenerateEmail = async () => {
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
    } catch (err) {
      setBody('Error generating email.');
    }
  };

  // New handler for Generate button
  const handleGenerateAll = async () => {
    setGenerating(true);
    await handleGenerateSubject();
    await handleGenerateEmail();
    if (fetchCredits) fetchCredits();
    setGenerating(false);
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
    <>
      <Modal
        opened={showOnboarding}
        onClose={handleCloseOnboarding}
        title="Advanced Email Tab"
        centered
        overlayProps={{ backgroundOpacity: 0.55, blur: 2 }}
      >
        <Text size="md" mb="md">
          Here you can provide detailed information like LinkedIn, company values, and a bio page to generate even more personalized emails. The more info you provide, the better Pingu can tailor your message!
        </Text>
        <Button onClick={handleCloseOnboarding} fullWidth color="blue" radius="md">Got it!</Button>
      </Modal>
      <form style={{ background: '#e6f3ff', borderRadius: 12, padding: 0, color: '#000a14', fontFamily: 'inherit' }}>
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
        <TextInput label="LinkedIn Information" value={linkedin} onChange={e => setLinkedin(e.target.value)} radius="md" size="sm"
          styles={{ input: { background: '#e6f3ff', color: '#000a14', border: '1px solid #000a14', boxShadow: 'none' }, label: { color: '#000a14', fontWeight: 500 } }}
          classNames={{ input: 'custom-input' }}
          mb={8}
        />
        <TextInput label="Bio Page" value={bio} onChange={e => setBio(e.target.value)} radius="md" size="sm"
          styles={{ input: { background: '#e6f3ff', color: '#000a14', border: '1px solid #000a14', boxShadow: 'none' }, label: { color: '#000a14', fontWeight: 500 } }}
          classNames={{ input: 'custom-input' }}
          mb={8}
        />
        <TextInput label="Company Description Page" value={values} onChange={e => setValues(e.target.value)} radius="md" size="sm"
          styles={{ input: { background: '#e6f3ff', color: '#000a14', border: '1px solid #000a14', boxShadow: 'none' }, label: { color: '#000a14', fontWeight: 500 } }}
          classNames={{ input: 'custom-input' }}
          mb={8}
        />
        <TextInput label="Career Interest" value={interest} onChange={e => setInterest(e.target.value)} radius="md" size="sm"
          styles={{ input: { background: '#e6f3ff', color: '#000a14', border: '1px solid #000a14', boxShadow: 'none' }, label: { color: '#000a14', fontWeight: 500 } }}
          classNames={{ input: 'custom-input' }}
          mb={8}
        />
        <Stack spacing="xl">
          <Group spacing="md" grow align="flex-end">
            <Button
              onClick={handleGenerateAll}
              loading={generating}
              radius="md"
              style={{ ...blueButtonStyle, ...(hoveredGenerateEmail ? blueButtonHover : {}) }}
              onMouseEnter={() => setHoveredGenerateEmail(true)}
              onMouseLeave={() => setHoveredGenerateEmail(false)}
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
            autosize
            maxRows={20}
            styles={{ input: { background: '#e6f3ff', color: '#000a14', border: '1px solid #000a14', boxShadow: 'none', overflowY: 'auto' }, label: { color: '#000a14', fontWeight: 500 } }}
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
    </>
  );
};

export default AdvancedEmailForm;
