import React, { useState, useEffect } from 'react';
import { 
  Paper, 
  Button, 
  Text, 
  Loader, 
  Stack, 
  Group, 
  Textarea, 
  TextInput,
  Alert,
  Badge,
  Box,
  Notification
} from '@mantine/core';
import { API_BASE_URL } from '../utils/constants';
import useGmailSender from '../hooks/useGmailSender';

export default function AgenticMode({ credits, creditsLoading, creditsError, fetchCredits }) {
  const sendGmail = useGmailSender();
  
  const [isScrapingInProgress, setIsScrapingInProgress] = useState(false);
  const [scrapingStatus, setScrapingStatus] = useState('');
  const [generatedSubject, setGeneratedSubject] = useState('');
  const [generatedEmail, setGeneratedEmail] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [sendStatus, setSendStatus] = useState('');
  const [error, setError] = useState('');
  const [currentUrl, setCurrentUrl] = useState('');
  const [profileData, setProfileData] = useState(null);
  const [jobId, setJobId] = useState(null);
  const [showCompanyInfo, setShowCompanyInfo] = useState(false);
  const [companyInfo, setCompanyInfo] = useState('');
  const [showRecipientBio, setShowRecipientBio] = useState(false);
  const [recipientBio, setRecipientBio] = useState('');

  // Restore from localStorage on mount
  useEffect(() => {
    setRecipientEmail(localStorage.getItem('am_recipientEmail') || '');
    setGeneratedSubject(localStorage.getItem('am_generatedSubject') || '');
    setGeneratedEmail(localStorage.getItem('am_generatedEmail') || '');
    setCurrentUrl(localStorage.getItem('am_currentUrl') || '');
    setCompanyInfo(localStorage.getItem('am_companyInfo') || '');
    setShowCompanyInfo(localStorage.getItem('am_showCompanyInfo') === 'true');
    setRecipientBio(localStorage.getItem('am_recipientBio') || '');
    setShowRecipientBio(localStorage.getItem('am_showRecipientBio') === 'true');
    
    // Restore scraping state
    const savedJobId = localStorage.getItem('am_jobId');
    const savedIsScrapingInProgress = localStorage.getItem('am_isScrapingInProgress') === 'true';
    const savedScrapingStatus = localStorage.getItem('am_scrapingStatus') || '';
    
    if (savedJobId && savedIsScrapingInProgress) {
      setJobId(savedJobId);
      setIsScrapingInProgress(true);
      setScrapingStatus(savedScrapingStatus || 'Resuming scraping...');
      
      // Resume polling
      chrome.storage.local.get(['supabaseToken'], (result) => {
        if (result.supabaseToken) {
          pollForResults(savedJobId, result.supabaseToken, localStorage.getItem('am_companyInfo') || '', localStorage.getItem('am_recipientBio') || '');
        }
      });
    }
    
    // Don't restore profile data as it should be re-scraped
  }, []);

  // Persist form state to localStorage
  useEffect(() => { localStorage.setItem('am_recipientEmail', recipientEmail); }, [recipientEmail]);
  useEffect(() => { localStorage.setItem('am_generatedSubject', generatedSubject); }, [generatedSubject]);
  useEffect(() => { localStorage.setItem('am_generatedEmail', generatedEmail); }, [generatedEmail]);
  useEffect(() => { localStorage.setItem('am_currentUrl', currentUrl); }, [currentUrl]);
  useEffect(() => { localStorage.setItem('am_companyInfo', companyInfo); }, [companyInfo]);
  useEffect(() => { localStorage.setItem('am_showCompanyInfo', showCompanyInfo.toString()); }, [showCompanyInfo]);
  useEffect(() => { localStorage.setItem('am_recipientBio', recipientBio); }, [recipientBio]);
  useEffect(() => { localStorage.setItem('am_showRecipientBio', showRecipientBio.toString()); }, [showRecipientBio]);
  
  // Persist scraping state to localStorage
  useEffect(() => { 
    if (jobId) {
      localStorage.setItem('am_jobId', jobId); 
    } else {
      localStorage.removeItem('am_jobId');
    }
  }, [jobId]);
  useEffect(() => { localStorage.setItem('am_isScrapingInProgress', isScrapingInProgress.toString()); }, [isScrapingInProgress]);
  useEffect(() => { localStorage.setItem('am_scrapingStatus', scrapingStatus); }, [scrapingStatus]);

  const getCurrentTabUrl = () => {
    return new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        resolve(tabs[0]?.url || '');
      });
    });
  };

  const startLinkedInScrape = async () => {
    try {
      setError('');
      setIsScrapingInProgress(true);
      setScrapingStatus('Getting current tab URL...');
      
      // Get current tab URL
      const url = await getCurrentTabUrl();
      setCurrentUrl(url);
      
      if (!url.includes('linkedin.com/in/')) {
        throw new Error('Please navigate to a LinkedIn profile page first');
      }
      
      setScrapingStatus('Starting LinkedIn profile scrape...');
      
      // Get auth token
      const token = await new Promise((resolve) => {
        chrome.storage.local.get(['supabaseToken'], (result) => {
          resolve(result.supabaseToken);
        });
      });
      
      if (!token) {
        throw new Error('Please log in first');
      }
      
      // Trigger scraping job
      const response = await fetch(`${API_BASE_URL}/api/scrape-linkedin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          url
        })
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to start scraping');
      }
      
      const newJobId = result.job_id;
      setJobId(newJobId);
      setScrapingStatus('Scraping LinkedIn profile...');
      
      // Start polling for results
      pollForResults(newJobId, token, companyInfo, recipientBio);
      
    } catch (err) {
      setError(err.message);
      setIsScrapingInProgress(false);
      setScrapingStatus('');
      setJobId(null);
      
      // Clear scraping state from localStorage on error
      localStorage.removeItem('am_jobId');
      localStorage.removeItem('am_isScrapingInProgress');
      localStorage.removeItem('am_scrapingStatus');
    }
  };

  const pollForResults = async (jobId, token, companyInfo = '', recipientBio = '') => {
    const maxAttempts = 30; // 60 seconds max (2s intervals)
    let attempts = 0;
    
    const poll = async () => {
      try {
        attempts++;
        
        if (attempts > maxAttempts) {
          throw new Error('Scraping timeout. Please try again.');
        }
        
        const encodedCompanyInfo = encodeURIComponent(companyInfo);
        const encodedRecipientBio = encodeURIComponent(recipientBio);
        const response = await fetch(`${API_BASE_URL}/api/scrape-result/${jobId}?company_info=${encodedCompanyInfo}&recipient_bio=${encodedRecipientBio}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        const result = await response.json();
        
        if (!response.ok) {
          throw new Error(result.error || 'Failed to get results');
        }
        
        if (result.status === 'pending') {
          setScrapingStatus(`Scraping in progress... (${attempts}/${maxAttempts})`);
          setTimeout(poll, 2000); // Poll every 2 seconds
          return;
        }
        
        if (result.status === 'done') {
          setScrapingStatus('Generating personalized email...');
          
          // Set results
          setProfileData(result.profile);
          setGeneratedSubject(result.generated_subject);
          setGeneratedEmail(result.generated_email);
          
          // Auto-populate email if Apollo found one
          if (result.apollo_email && result.apollo_found) {
            setRecipientEmail(result.apollo_email);
          }
          
          setScrapingStatus('Complete!');
          setIsScrapingInProgress(false);
          setJobId(null); // Clear job ID
          
          // Clear scraping state from localStorage
          localStorage.removeItem('am_jobId');
          localStorage.removeItem('am_isScrapingInProgress');
          localStorage.removeItem('am_scrapingStatus');
          
          // Refresh credits
          if (fetchCredits) {
            fetchCredits();
          }
          
          setTimeout(() => {
            setScrapingStatus('');
          }, 2000);
        }
        
      } catch (err) {
        setError(err.message);
        setIsScrapingInProgress(false);
        setScrapingStatus('');
        setJobId(null);
        
        // Clear scraping state from localStorage on error
        localStorage.removeItem('am_jobId');
        localStorage.removeItem('am_isScrapingInProgress');
        localStorage.removeItem('am_scrapingStatus');
      }
    };
    
    poll();
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };

  const handleSendGmail = async () => {
    if (!recipientEmail || !generatedSubject || !generatedEmail) {
      setSendStatus('Missing recipient email, subject, or email body');
      return;
    }
    try {
      await sendGmail(recipientEmail, generatedSubject, generatedEmail);
      setSendStatus('✅ Email sent!');
      // Clear fields and localStorage after successful send
      setRecipientEmail('');
      setGeneratedSubject('');
      setGeneratedEmail('');
      setProfileData(null);
      setJobId(null);
      localStorage.removeItem('am_recipientEmail');
      localStorage.removeItem('am_generatedSubject');
      localStorage.removeItem('am_generatedEmail');
      localStorage.removeItem('am_currentUrl');
      localStorage.removeItem('am_jobId');
      localStorage.removeItem('am_isScrapingInProgress');
      localStorage.removeItem('am_scrapingStatus');
    } catch (err) {
      setSendStatus('❌ Send failed.');
    }
    setTimeout(() => setSendStatus(''), 3000);
  };

  const sendEmail = () => {
    // Integration with existing email sending functionality
    const subject = encodeURIComponent(generatedSubject);
    const body = encodeURIComponent(generatedEmail);
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&su=${subject}&body=${body}`;
    chrome.tabs.create({ url: gmailUrl });
  };

  const clearAll = () => {
    // Clear all state
    setRecipientEmail('');
    setGeneratedSubject('');
    setGeneratedEmail('');
    setProfileData(null);
    setCurrentUrl('');
    setJobId(null);
    setIsScrapingInProgress(false);
    setScrapingStatus('');
    setError('');
    setSendStatus('');
    
    // Clear localStorage
    localStorage.removeItem('am_recipientEmail');
    localStorage.removeItem('am_generatedSubject');
    localStorage.removeItem('am_generatedEmail');
    localStorage.removeItem('am_currentUrl');
    localStorage.removeItem('am_jobId');
    localStorage.removeItem('am_isScrapingInProgress');
    localStorage.removeItem('am_scrapingStatus');
    
    // Keep company info and recipient bio since they're optional and user might want to reuse
  };

  return (
    <Paper p="md" style={{ background: 'transparent', border: 'none', boxShadow: 'none' }}>
      <Stack spacing="md">
        {/* Header */}
        <Group position="apart" align="center">
          <Group spacing="xs">
            <Text size="lg" weight={700} color="#5fafde">🤖</Text>
            <Text weight={600} size="lg">Agentic Mode</Text>
            <Badge color="blue" size="sm" variant="light">AI-Powered</Badge>
          </Group>
        </Group>

        {/* Description */}
        <Text size="sm" color="dimmed">
          Automatically scrape the LinkedIn profile you're viewing and generate a personalized email using AI.
        </Text>

        {/* Current URL Display */}
        {currentUrl && (
          <Group spacing="xs">
            <Text size="lg" color="#0077b5">💼</Text>
            <Text size="xs" color="dimmed" style={{ wordBreak: 'break-all' }}>
              {currentUrl}
            </Text>
          </Group>
        )}

        {/* Scrape Button */}
        <Button
          onClick={startLinkedInScrape}
          disabled={isScrapingInProgress || credits < 1}
          loading={isScrapingInProgress}
          size="md"
          style={{
            background: isScrapingInProgress ? '#ccc' : '#0077b5',
            border: 'none',
            color: 'white'
          }}
        >
          {isScrapingInProgress ? 'Scraping...' : '� Scrape LinkedIn Profile'}
        </Button>

        {/* Company Info Section */}
        <Stack spacing="sm">
          <Button
            variant={showCompanyInfo ? "filled" : "light"}
            color="blue"
            size="sm"
            onClick={() => setShowCompanyInfo(!showCompanyInfo)}
            style={{ alignSelf: 'flex-start' }}
          >
            {showCompanyInfo ? '📄 Hide Company Info' : '📄 (Optional) Add Company Info'}
          </Button>
          
          {showCompanyInfo && (
            <Textarea
              label="Company Information"
              placeholder="Enter additional company details, values, recent news, or specific information you want to reference in your email..."
              value={companyInfo}
              onChange={(e) => setCompanyInfo(e.target.value)}
              minRows={3}
              maxRows={8}
              radius="md"
              size="sm"
              autosize
              styles={{ 
                input: { background: '#e6f3ff', color: '#000a14', border: '1px solid #000a14', boxShadow: 'none' }, 
                label: { color: '#000a14', fontWeight: 500 } 
              }}
              classNames={{ input: 'custom-input' }}
            />
          )}
        </Stack>

        {/* Recipient Bio Section */}
        <Stack spacing="sm">
          <Button
            variant={showRecipientBio ? "filled" : "light"}
            color="orange"
            size="sm"
            onClick={() => setShowRecipientBio(!showRecipientBio)}
            style={{ alignSelf: 'flex-start' }}
          >
            {showRecipientBio ? '👤 Hide Recipient Bio' : '👤 (Optional) Add Recipient Bio'}
          </Button>
          
          {showRecipientBio && (
            <Textarea
              label="Recipient Bio/Background"
              placeholder="Enter additional information about the recipient, their background, interests, recent achievements, or any personal details you want to reference..."
              value={recipientBio}
              onChange={(e) => setRecipientBio(e.target.value)}
              minRows={3}
              maxRows={8}
              radius="md"
              size="sm"
              autosize
              styles={{ 
                input: { background: '#fff4e6', color: '#000a14', border: '1px solid #000a14', boxShadow: 'none' }, 
                label: { color: '#000a14', fontWeight: 500 } 
              }}
              classNames={{ input: 'custom-input' }}
            />
          )}
        </Stack>

        {/* Recipient Email Input - Only show after scraping starts or data exists */}
        {(profileData || generatedEmail || isScrapingInProgress) && (
          <>
            <TextInput 
              label="Recipient Email" 
              placeholder="Enter the email address to send to..."
              value={recipientEmail} 
              onChange={(e) => setRecipientEmail(e.target.value)} 
              radius="md" 
              size="sm"
              styles={{ input: { background: '#e6f3ff', color: '#000a14', border: '1px solid #000a14', boxShadow: 'none' }, label: { color: '#000a14', fontWeight: 500 } }}
              classNames={{ input: 'custom-input' }}
            />
            
            {/* Apollo Email Status */}
            {profileData && profileData.apollo_found && (
              <Alert color="green" variant="light" radius="md" size="sm">
                📧 Email auto-filled using Apollo People Search
              </Alert>
            )}
          </>
        )}

        {/* Status */}
        {scrapingStatus && (
          <Group spacing="xs" align="center">
            <Loader size="xs" />
            <Text size="sm" color="blue">
              {scrapingStatus}
            </Text>
          </Group>
        )}

        {/* Error Alert */}
        {error && (
          <Alert color="red" variant="light">
            ⚠️ {error}
          </Alert>
        )}

        {/* Profile Data Preview */}
        {profileData && (
          <Box style={{ border: '1px solid #e9ecef', borderRadius: 8, padding: 12 }}>
            <Text weight={600} size="sm" mb="xs">Extracted Profile Data</Text>
            <Text size="xs" color="dimmed">
              <strong>Name:</strong> {profileData.name}<br />
              <strong>Headline:</strong> {profileData.headline}<br />
              <strong>Location:</strong> {profileData.location}<br />
              <strong>Experiences:</strong> {profileData.experiences?.length || 0} found<br />
              <strong>Education:</strong> {profileData.education?.length || 0} found
            </Text>
          </Box>
        )}

        {/* Results */}
        {generatedSubject && (
          <Stack spacing="xl">
            <TextInput 
              label="Subject" 
              value={generatedSubject} 
              onChange={(e) => setGeneratedSubject(e.target.value)} 
              radius="md" 
              size="sm"
              styles={{ input: { background: '#e6f3ff', color: '#000a14', border: '1px solid #000a14', boxShadow: 'none' }, label: { color: '#000a14', fontWeight: 500 } }}
              classNames={{ input: 'custom-input' }}
            />
            <Button
              onClick={() => copyToClipboard(generatedSubject)}
              radius="md"
              style={{ background: '#e6f3ff', color: '#000a14', border: '1px solid #000a14', fontWeight: 600, fontSize: 14 }}
            >
              Copy Subject
            </Button>
          </Stack>
        )}

        {generatedEmail && (
          <Stack spacing="xl">
            <Textarea 
              label="Email Body" 
              value={generatedEmail} 
              onChange={(e) => setGeneratedEmail(e.target.value)} 
              minRows={4} 
              radius="md" 
              size="sm"
              autosize
              maxRows={20}
              styles={{ input: { background: '#e6f3ff', color: '#000a14', border: '1px solid #000a14', boxShadow: 'none', overflowY: 'auto' }, label: { color: '#000a14', fontWeight: 500 } }}
              classNames={{ input: 'custom-input' }}
            />
            <Group spacing="md">
              <Button
                onClick={handleSendGmail}
                disabled={!recipientEmail || !generatedSubject || !generatedEmail}
                radius="md"
                color="teal"
                style={{ fontWeight: 600 }}
              >
                Send with Gmail
              </Button>
            </Group>
          </Stack>
        )}

        {/* Send Status */}
        {sendStatus && (
          <Notification color={sendStatus.includes('✅') ? 'teal' : 'red'}>
            {sendStatus}
          </Notification>
        )}

        {/* Fallback: Open Gmail Editor */}
        {generatedEmail && generatedSubject && (
          <Stack spacing="xs">
            <Text size="xs" color="dimmed" align="center">Or open in Gmail editor:</Text>
            <Button
              onClick={sendEmail}
              variant="subtle"
              size="xs"
              style={{ color: '#666' }}
            >
              📝 Open Gmail Editor
            </Button>
          </Stack>
        )}

        {/* Success Message */}
        {generatedEmail && generatedSubject && (
          <Alert color="green" variant="light">
            ✅ Email generated successfully! You can edit it above and click "Send" to open Gmail.
          </Alert>
        )}

        {/* Clear/Reset Button - Only show when there's content to clear */}
        {(generatedEmail || generatedSubject || profileData || recipientEmail) && (
          <Button
            onClick={clearAll}
            variant="subtle"
            size="sm"
            color="gray"
            style={{ alignSelf: 'center', marginTop: '1rem' }}
          >
            🗑️ Clear All & Start Over
          </Button>
        )}

        <style>{`.custom-input:focus { border: 1.5px solid #5fafde !important; box-shadow: 0 0 0 1.5px #5fafde !important; }`}</style>
      </Stack>
    </Paper>
  );
}
