import React, { useState, useEffect } from 'react';
import { Button, Group, TextInput, Textarea, Stack, CopyButton, Notification, Switch, Paper, Text, Modal } from '@mantine/core';
import useProfile from '../hooks/useProfile';
import useGmailSender from '../hooks/useGmailSender';
import { API_BASE_URL } from '../utils/constants';

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

  // Add toggle state for multiple recipients
  const [isMultipleRecipients, setIsMultipleRecipients] = useState(false);
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
  const [hoveredSend, setHoveredSend] = useState(false);

  // Add onboarding state
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem('hasSeenSimpleEmailOnboarding')) {
      setShowOnboarding(true);
    }
  }, []);

  const handleCloseOnboarding = () => {
    setShowOnboarding(false);
    localStorage.setItem('hasSeenSimpleEmailOnboarding', 'true');
  };

  useEffect(() => {
    getProfile();
  }, [getProfile]);

  // Restore from localStorage on mount (except interest - wait for profile)
  useEffect(() => {
    setRecipientName(localStorage.getItem('se_recipientName') || '');
    setRecipientEmail(localStorage.getItem('se_recipientEmail') || '');
    setSubject(localStorage.getItem('se_subject') || '');
    setBody(localStorage.getItem('se_body') || '');
    // Don't load interest from localStorage initially - wait for profile to set default
  }, []);

  // Populate default interest from settings when profile loads
  useEffect(() => {
    if (profile && profile.default_interest) {
      // Always use the default interest from settings when profile loads
      setInterest(profile.default_interest);
    } else if (!profile || !profile.default_interest) {
      // If no default interest in profile, load from localStorage as fallback
      const savedInterest = localStorage.getItem('se_interest');
      if (savedInterest) {
        setInterest(savedInterest);
      }
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
        recipient_emails: recipientEmail.trim(), // Add recipient emails for credit calculation
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
    try {
      const { supabaseToken } = await chrome.storage.local.get('supabaseToken');
      
      if (isMultipleRecipients) {
        // Send raw data to backend - let backend handle all validation and logic
        setSendStatus('📧 Processing multiple recipients...');
        
        const response = await fetch(`${API_BASE_URL}/api/send-email-smart`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseToken}`
          },
          body: JSON.stringify({
            recipient_emails: recipientEmail,
            recipient_name: recipientName,
            subject: subject,
            body: body,
            sender_name: profile?.name || '',
            sender_email: profile?.email || ''
          })
        });

        const result = await response.json();
        setSendStatus(result.success ? `✅ ${result.message}` : `❌ ${result.error}`);
        
        // Clear fields on success and refresh credits
        if (result.success) {
          if (fetchCredits) fetchCredits();
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
        }
      } else {
        // Handle single email with direct Gmail API
        await sendGmail(recipientEmail, subject, body);
        setSendStatus('✅ Email sent!');
        
        // Clear fields on success
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
      }
    } catch (err) {
      console.error('Send error:', err);
      setSendStatus('❌ Send failed: ' + err.message);
    }
    setTimeout(() => setSendStatus(''), 3000);
  };

  return (
    <>
      <Modal
        opened={showOnboarding}
        onClose={handleCloseOnboarding}
        title="Simple Email"
        centered
        overlayProps={{ backgroundOpacity: 0.55, blur: 2 }}
      >
        <Text size="md" mb="md">
          Welcome to Simple Email! Generate personalized emails quickly and send them to one or multiple recipients. 
          <strong> Credits: 1 credit per recipient.</strong> Toggle between single and multiple recipient modes using the switch below.
        </Text>
        <Button onClick={handleCloseOnboarding} fullWidth color="blue" radius="md">Got it!</Button>
      </Modal>
      
      <form style={{ background: '#e6f3ff', borderRadius: 12, padding: 0, color: '#000a14', fontFamily: 'inherit' }}>
        <Stack spacing="xl">
          {(profileError || creditsError) && (
            <Notification color="red" title="Error" mb="md">
              {profileError && <div>Profile: {profileError.toString()}</div>}
              {creditsError && <div>Credits: {creditsError.toString()}</div>}
            </Notification>
          )}

          {/* Multiple Recipients Toggle */}
        <Paper withBorder p="md" radius="md" style={{ background: '#ffffff', border: '1px solid #000a14' }}>
          <Group position="apart" align="center">
            <div>
              <Text weight={500} size="sm" color="#000a14">
                Email Mode
              </Text>
              <Text size="xs" color="#666">
                {isMultipleRecipients ? 'Send to multiple recipients (comma-separated emails)' : 'Send to single recipient'}
              </Text>
            </div>
            <Switch
              checked={isMultipleRecipients}
              onChange={(event) => setIsMultipleRecipients(event.currentTarget.checked)}
              color="blue"
              size="md"
            />
          </Group>
        </Paper>

        {!isMultipleRecipients && (
          <TextInput label="Recipient Name" value={recipientName} onChange={e => setRecipientName(e.target.value)} radius="md" size="sm"
            styles={{ input: { background: '#e6f3ff', color: '#000a14', border: '1px solid #000a14', boxShadow: 'none' }, label: { color: '#000a14', fontWeight: 500 } }}
            classNames={{ input: 'custom-input' }}
            mb={8}
          />
        )}
        <TextInput 
          label={isMultipleRecipients ? "Recipient Emails (comma-separated)" : "Recipient Email"} 
          value={recipientEmail} 
          onChange={e => setRecipientEmail(e.target.value)} 
          radius="md" 
          size="sm"
          placeholder={isMultipleRecipients ? "email1@example.com, email2@example.com" : "recipient@example.com"}
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
        <Textarea
          label="Email Body"
          value={body}
          onChange={e => setBody(e.target.value)}
          minRows={4}
          autosize
          maxRows={20}
          radius="md"
          size="sm"
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
          <Button 
            onClick={handleSendGmail} 
            loading={generating} 
            radius="md" 
            style={{ 
              backgroundColor: hoveredSend ? '#1971c2' : '#228be6',
              color: 'white',
              fontWeight: 600,
              border: 'none',
              transition: 'background-color 0.2s ease'
            }}
            onMouseEnter={() => setHoveredSend(true)}
            onMouseLeave={() => setHoveredSend(false)}
          >
            {isMultipleRecipients ? 'Send to Multiple Recipients' : 'Send with Gmail'}
          </Button>
        </Group>
        {sendStatus && <Notification color={sendStatus.includes('✅') ? 'teal' : 'red'}>{sendStatus}</Notification>}
      </Stack>
      <style>{`.custom-input:focus { border: 1.5px solid #5fafde !important; box-shadow: 0 0 0 1.5px #5fafde !important; }`}</style>
    </form>
    </>
  );
};

export default SimpleEmailForm;
