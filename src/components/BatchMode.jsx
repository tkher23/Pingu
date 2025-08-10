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
  Progress,
  ActionIcon,
  Modal,
  Checkbox
} from '@mantine/core';
import { API_BASE_URL } from '../utils/constants';
import useGmailSender from '../hooks/useGmailSender';

export default function BatchMode({ credits, creditsLoading, creditsError, fetchCredits }) {
  const sendGmail = useGmailSender();
  
  const [urls, setUrls] = useState(['']);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');
  const [results, setResults] = useState([]);
  const [currentEmailIndex, setCurrentEmailIndex] = useState(0);
  const [isSending, setIsSending] = useState(false);
  const [sendingProgress, setSendingProgress] = useState(0);
  const [error, setError] = useState('');
  const [jobId, setJobId] = useState(null);
  const [sendSuccess, setSendSuccess] = useState('');
  const [showCompanyInfo, setShowCompanyInfo] = useState(false);
  const [companyInfo, setCompanyInfo] = useState('');
  const [urlAdditionalInfo, setUrlAdditionalInfo] = useState({}); // Object to store additional info per URL index
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Restore from localStorage on mount
  useEffect(() => {
    const savedUrls = localStorage.getItem('bm_urls');
    const savedResults = localStorage.getItem('bm_results');
    const savedCurrentIndex = localStorage.getItem('bm_currentIndex');
    
    if (savedUrls) {
      setUrls(JSON.parse(savedUrls));
    }
    if (savedResults) {
      setResults(JSON.parse(savedResults));
    }
    if (savedCurrentIndex) {
      setCurrentEmailIndex(parseInt(savedCurrentIndex));
    }

    // Restore company info and additional info
    setCompanyInfo(localStorage.getItem('bm_companyInfo') || '');
    setShowCompanyInfo(localStorage.getItem('bm_showCompanyInfo') === 'true');
    const savedUrlAdditionalInfo = localStorage.getItem('bm_urlAdditionalInfo');
    if (savedUrlAdditionalInfo) {
      setUrlAdditionalInfo(JSON.parse(savedUrlAdditionalInfo));
    }

    // Restore processing state
    const savedJobId = localStorage.getItem('bm_jobId');
    const savedIsProcessing = localStorage.getItem('bm_isProcessing') === 'true';
    const savedProcessingStatus = localStorage.getItem('bm_processingStatus') || '';
    
    if (savedJobId && savedIsProcessing) {
      setJobId(savedJobId);
      setIsProcessing(true);
      setProcessingStatus(savedProcessingStatus || 'Resuming batch processing...');
      
      // Resume polling
      chrome.storage.local.get(['supabaseToken'], (result) => {
        if (result.supabaseToken) {
          pollForBatchResults(savedJobId, result.supabaseToken);
        }
      });
    }
  }, []);

  // Persist to localStorage
  useEffect(() => {
    localStorage.setItem('bm_urls', JSON.stringify(urls));
  }, [urls]);

  useEffect(() => {
    localStorage.setItem('bm_results', JSON.stringify(results));
  }, [results]);

  useEffect(() => {
    localStorage.setItem('bm_currentIndex', currentEmailIndex.toString());
  }, [currentEmailIndex]);

  // Persist processing state to localStorage
  useEffect(() => { 
    if (jobId) {
      localStorage.setItem('bm_jobId', jobId); 
    } else {
      localStorage.removeItem('bm_jobId');
    }
  }, [jobId]);
  useEffect(() => { localStorage.setItem('bm_isProcessing', isProcessing.toString()); }, [isProcessing]);
  useEffect(() => { localStorage.setItem('bm_processingStatus', processingStatus); }, [processingStatus]);
  useEffect(() => { localStorage.setItem('bm_companyInfo', companyInfo); }, [companyInfo]);
  useEffect(() => { localStorage.setItem('bm_showCompanyInfo', showCompanyInfo.toString()); }, [showCompanyInfo]);
  useEffect(() => { localStorage.setItem('bm_urlAdditionalInfo', JSON.stringify(urlAdditionalInfo)); }, [urlAdditionalInfo]);

  // Check for first-time onboarding
  useEffect(() => {
    if (!localStorage.getItem('hasSeenBatchOnboarding')) {
      setShowOnboarding(true);
    }
  }, []);

  const handleCloseOnboarding = () => {
    setShowOnboarding(false);
    localStorage.setItem('hasSeenBatchOnboarding', 'true');
  };

  const addUrlField = async () => {
    // Get current tab URL
    const currentUrl = await getCurrentTabUrl();
    if (currentUrl && currentUrl.includes('linkedin.com/in/')) {
      // Find the first empty URL field and populate it
      const emptyIndex = urls.findIndex(url => !url.trim());
      if (emptyIndex !== -1) {
        const newUrls = [...urls];
        newUrls[emptyIndex] = currentUrl;
        setUrls(newUrls);
        
        // Add a new empty field
        setUrls([...newUrls, '']);
      } else {
        // If no empty fields, add a new one with the URL and then another empty one
        const newUrls = [...urls, currentUrl];
        setUrls([...newUrls, '']);
      }
    } else {
      // If not on LinkedIn profile, just add an empty field for manual entry
      setUrls([...urls, '']);
    }
  };

  const getCurrentTabUrl = () => {
    return new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        resolve(tabs[0]?.url || '');
      });
    });
  };

  const removeUrlField = (index) => {
    if (urls.length > 1) {
      const newUrls = urls.filter((_, i) => i !== index);
      setUrls(newUrls);
      
      // Clean up additional info for removed URL and reindex
      const newAdditionalInfo = {};
      Object.keys(urlAdditionalInfo).forEach(key => {
        if (key.startsWith('show_')) {
          const keyIndex = parseInt(key.split('_')[1]);
          if (keyIndex < index) {
            newAdditionalInfo[key] = urlAdditionalInfo[key];
          } else if (keyIndex > index) {
            newAdditionalInfo[`show_${keyIndex - 1}`] = urlAdditionalInfo[key];
          }
        } else {
          const keyIndex = parseInt(key);
          if (keyIndex < index) {
            newAdditionalInfo[key] = urlAdditionalInfo[key];
          } else if (keyIndex > index) {
            newAdditionalInfo[keyIndex - 1] = urlAdditionalInfo[key];
          }
        }
      });
      setUrlAdditionalInfo(newAdditionalInfo);
    }
  };

  const updateUrl = (index, value) => {
    const newUrls = [...urls];
    newUrls[index] = value;
    setUrls(newUrls);
  };

  const updateUrlAdditionalInfo = (index, value) => {
    setUrlAdditionalInfo(prev => ({
      ...prev,
      [index]: value
    }));
  };

  const toggleUrlAdditionalInfo = (index) => {
    setUrlAdditionalInfo(prev => ({
      ...prev,
      [`show_${index}`]: !prev[`show_${index}`]
    }));
  };

  const startBatchProcessing = async () => {
    try {
      setError('');
      setIsProcessing(true);
      setProcessingStatus('Starting batch processing...');
      
      // Get auth token
      const token = await new Promise((resolve) => {
        chrome.storage.local.get(['supabaseToken'], (result) => {
          resolve(result.supabaseToken);
        });
      });
      
      if (!token) {
        throw new Error('Please log in first');
      }
      
      // Send all URLs to backend - let backend handle all validation
      const urlsWithInfo = urls
        .filter(url => url.trim()) // Only filter out completely empty URLs
        .map((url, index) => ({
          url: url.trim(),
          additional_info: urlAdditionalInfo[index] || '',
          company_info: companyInfo
        }));

      const response = await fetch(`${API_BASE_URL}/api/scrape-linkedin-batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ urls: urlsWithInfo })
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to start batch processing');
      }
      
      const newJobId = result.job_id;
      setJobId(newJobId);
      setProcessingStatus(`Processing ${result.url_count || urlsWithInfo.length} LinkedIn profiles...`);
      
      // Start polling for results
      pollForBatchResults(newJobId, token);
      
    } catch (err) {
      setError(err.message);
      setIsProcessing(false);
      setProcessingStatus('');
      setJobId(null);
      
      // Clear processing state from localStorage on error
      localStorage.removeItem('bm_jobId');
      localStorage.removeItem('bm_isProcessing');
      localStorage.removeItem('bm_processingStatus');
    }
  };

  const pollForBatchResults = async (jobId, token) => {
    const poll = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/scrape-batch-result/${jobId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        const result = await response.json();
        
        if (!response.ok) {
          throw new Error(result.error || 'Failed to get results');
        }
        
        if (result.status === 'pending') {
          // Update status with backend-provided information
          const statusMessage = `Processing... (${result.checks_remaining || 0} checks remaining, ${result.elapsed_minutes || 0}/${result.timeout_minutes || 10} min)`;
          setProcessingStatus(statusMessage);
          setTimeout(poll, 2000);
          return;
        }
        
        if (result.status === 'done') {
          setProcessingStatus('Complete!');
          const profilesWithSendFlag = result.profiles.map(profile => ({
            ...profile,
            shouldSend: true, // Initially all emails are selected for sending
            // Auto-populate email if Apollo found one
            recipient_email: profile.apollo_email && profile.apollo_found ? profile.apollo_email : ''
          }));
          setResults(profilesWithSendFlag);
          setCurrentEmailIndex(0);
          setIsProcessing(false);
          setJobId(null); // Clear job ID
          
          // Clear processing state from localStorage
          localStorage.removeItem('bm_jobId');
          localStorage.removeItem('bm_isProcessing');
          localStorage.removeItem('bm_processingStatus');
          
          // Refresh credits
          if (fetchCredits) {
            fetchCredits();
          }
          
          setTimeout(() => {
            setProcessingStatus('');
          }, 2000);
        }
        
      } catch (err) {
        setError(err.message);
        setIsProcessing(false);
        setProcessingStatus('');
        setJobId(null);
        
        // Clear processing state from localStorage on error
        localStorage.removeItem('bm_jobId');
        localStorage.removeItem('bm_isProcessing');
        localStorage.removeItem('bm_processingStatus');
      }
    };
    
    poll();
  };

  const navigateEmail = (direction) => {
    if (direction === 'next' && currentEmailIndex < results.length - 1) {
      setCurrentEmailIndex(currentEmailIndex + 1);
    } else if (direction === 'prev' && currentEmailIndex > 0) {
      setCurrentEmailIndex(currentEmailIndex - 1);
    }
  };

  const updateCurrentEmail = (field, value) => {
    const newResults = [...results];
    newResults[currentEmailIndex] = {
      ...newResults[currentEmailIndex],
      [field]: value
    };
    setResults(newResults);
  };

  const getSelectedEmailsCount = () => {
    return results.filter(email => 
      email.shouldSend && 
      email.recipient_email && 
      email.generated_subject && 
      email.generated_email
    ).length;
  };

  const sendAllEmails = async () => {
    const selectedEmails = results.filter(email => email.shouldSend);
    if (selectedEmails.length === 0) return;
    
    // Check if all selected emails have recipient emails
    const missingEmails = selectedEmails.filter(email => !email.recipient_email || !email.recipient_email.trim());
    if (missingEmails.length > 0) {
      setError(`Please enter recipient email addresses for all selected emails. ${missingEmails.length} email(s) missing recipient addresses.`);
      setTimeout(() => setError(''), 5000);
      return;
    }
    
    setError('');
    setSendSuccess('');
    setIsSending(true);
    setSendingProgress(0);
    let successCount = 0;
    let processedCount = 0;
    const sentEmailUrls = []; // Track which emails were successfully sent
    
    for (let i = 0; i < selectedEmails.length; i++) {
      const email = selectedEmails[i];
      const recipientEmail = email.recipient_email;
      
      if (!recipientEmail || !email.generated_subject || !email.generated_email) {
        console.warn(`Skipping email ${i + 1}: Missing required fields`);
        processedCount++;
        setSendingProgress((processedCount / selectedEmails.length) * 100);
        continue;
      }
      
      try {
        await sendGmail(recipientEmail, email.generated_subject, email.generated_email);
        successCount++;
        sentEmailUrls.push(email.url); // Track this email as sent
      } catch (err) {
        console.error(`Failed to send email ${i + 1}:`, err);
      }
      
      processedCount++;
      setSendingProgress((processedCount / selectedEmails.length) * 100);
      
      // Small delay between sends to avoid rate limiting
      if (i < selectedEmails.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    setIsSending(false);
    setSendingProgress(0);
    
    // Remove sent emails from results, keep unsent ones
    const remainingEmails = results.filter(email => !sentEmailUrls.includes(email.url));
    setResults(remainingEmails);
    
    // Reset current index if needed
    if (remainingEmails.length === 0) {
      setCurrentEmailIndex(0);
      // Clear everything if no emails remain
      setUrls(['']);
      setCompanyInfo('');
      setShowCompanyInfo(false);
      setUrlAdditionalInfo({});
      localStorage.removeItem('bm_urls');
      localStorage.removeItem('bm_results');
      localStorage.removeItem('bm_currentIndex');
      localStorage.removeItem('bm_companyInfo');
      localStorage.removeItem('bm_showCompanyInfo');
      localStorage.removeItem('bm_urlAdditionalInfo');
      // Clear processing state as well
      localStorage.removeItem('bm_jobId');
      localStorage.removeItem('bm_isProcessing');
      localStorage.removeItem('bm_processingStatus');
      setSendSuccess(`✅ All ${successCount} emails sent successfully!`);
    } else {
      // Adjust current index if it's out of bounds
      if (currentEmailIndex >= remainingEmails.length) {
        setCurrentEmailIndex(0);
      }
      setSendSuccess(`📧 Sent ${successCount} out of ${selectedEmails.length} selected emails. ${remainingEmails.length} emails remaining.`);
    }
    
    // Clear success message after a few seconds
    setTimeout(() => setSendSuccess(''), 5000);
  };

  const clearAllRemaining = () => {
    setResults([]);
    setCurrentEmailIndex(0);
    setUrls(['']);
    setCompanyInfo('');
    setShowCompanyInfo(false);
    setUrlAdditionalInfo({});
    localStorage.removeItem('bm_urls');
    localStorage.removeItem('bm_results');
    localStorage.removeItem('bm_currentIndex');
    localStorage.removeItem('bm_companyInfo');
    localStorage.removeItem('bm_showCompanyInfo');
    localStorage.removeItem('bm_urlAdditionalInfo');
    setSendSuccess('');
    setError('');
  };

  const currentEmail = results[currentEmailIndex];

  return (
    <>
      {/* Removed welcome modal - users can figure out batch mode intuitively */}
      <Paper p="md" style={{ background: 'transparent', border: 'none', boxShadow: 'none' }}>
      <Stack spacing="md">
        {/* Header */}
        <Group position="apart" align="center">
          <Group spacing="xs">
            <Text size="lg" weight={700} color="#5fafde">📦</Text>
            <Text weight={600} size="lg">Advanced Mode</Text>
            <Badge color="purple" size="sm" variant="light">Bulk Processing</Badge>
          </Group>
        </Group>

        {/* Description */}
        <Text size="sm" color="dimmed">
          Process multiple LinkedIn profiles at once. Navigate to each LinkedIn profile and click "Add Current Tab URL" to capture them quickly, or manually enter URLs in the fields below.
        </Text>

        {/* URL Input Section */}
        {!results.length && (
          <Stack spacing="sm">
            {/* Add LinkedIn Button - First */}
            <Button
              variant="light"
              onClick={addUrlField}
              size="md"
              style={{
                background: '#0077b5',
                border: 'none',
                color: 'white'
              }}
            >
              ➕ Add Current LinkedIn Profile
            </Button>

            {/* Company Info Section - Second */}
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
                  placeholder="Enter company details, values, recent news, or specific information to reference in all emails..."
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

            {/* Process Button - Third */}
            {urls.some(url => url.trim()) && (
              <Button
                onClick={startBatchProcessing}
                disabled={isProcessing}
                loading={isProcessing}
                size="md"
                style={{
                  background: isProcessing ? '#ccc' : '#7c3aed',
                  border: 'none',
                  color: 'white'
                }}
              >
                {isProcessing ? 'Processing...' : `🚀 Process LinkedIn Profiles`}
              </Button>
            )}

            {/* LinkedIn URLs Section - Fourth */}
            {urls.some(url => url.trim()) && (
              <>
                <Group position="apart">
                  <Text weight={600} size="sm">LinkedIn Profile URLs</Text>
                  <Text size="xs" color="dimmed">{urls.length} URLs</Text>
                </Group>
                
                {urls.map((url, index) => (
                  <Stack key={index} spacing="xs">
                    <Group spacing="xs" align="flex-end">
                      <TextInput
                        placeholder="https://linkedin.com/in/profile-name"
                        value={url}
                        onChange={(e) => updateUrl(index, e.target.value)}
                        style={{ flex: 1 }}
                        size="sm"
                        styles={{ input: { background: '#e6f3ff', color: '#000a14', border: '1px solid #000a14' } }}
                      />
                      {urls.length > 1 && (
                        <Button
                          color="red" 
                          onClick={() => removeUrlField(index)}
                          size="xs"
                          variant="light"
                          style={{ minWidth: 30, padding: '4px 8px' }}
                        >
                          ✕
                        </Button>
                      )}
                    </Group>
                    
                    {/* Additional Info for this URL */}
                    <Stack spacing="xs" ml="sm">
                      <Button
                        variant={urlAdditionalInfo[`show_${index}`] ? "filled" : "light"}
                        color="orange"
                        size="xs"
                        onClick={() => toggleUrlAdditionalInfo(index)}
                        style={{ alignSelf: 'flex-start' }}
                      >
                        {urlAdditionalInfo[`show_${index}`] ? '👤 Hide Additional Info' : '👤 (Optional) Add Additional Info'}
                      </Button>
                      
                      {urlAdditionalInfo[`show_${index}`] && (
                        <Textarea
                          placeholder="Enter specific information about this recipient (background, interests, recent achievements, etc.)..."
                          value={urlAdditionalInfo[index] || ''}
                          onChange={(e) => updateUrlAdditionalInfo(index, e.target.value)}
                          minRows={2}
                          maxRows={6}
                          radius="md"
                          size="xs"
                          autosize
                          styles={{ 
                            input: { background: '#fff4e6', color: '#000a14', border: '1px solid #000a14', boxShadow: 'none', fontSize: '12px' }, 
                          }}
                          classNames={{ input: 'custom-input' }}
                        />
                      )}
                    </Stack>
                  </Stack>
                ))}
              </>
            )}
          </Stack>
        )}

        {/* Status */}
        {processingStatus && (
          <Group spacing="xs" align="center">
            <Loader size="xs" />
            <Text size="sm" color="blue">
              {processingStatus}
            </Text>
          </Group>
        )}

        {/* Error Alert */}
        {error && (
          <Alert color="red" variant="light">
            ⚠️ {error}
          </Alert>
        )}

        {/* Success Message */}
        {sendSuccess && (
          <Alert color="green" variant="light">
            {sendSuccess}
          </Alert>
        )}

        {/* Results Section */}
        {results.length > 0 && (
          <Stack spacing="md">
            {/* Navigation Header */}
            <Group position="apart" align="center">
              <Group spacing="xs">
                <Text weight={600}>Results: {results.length} profiles processed</Text>
                <Badge color="green" variant="light">
                  {currentEmailIndex + 1} / {results.length}
                </Badge>
              </Group>
              
              <Group spacing="xs">
                <Button
                  onClick={() => navigateEmail('prev')}
                  disabled={currentEmailIndex === 0}
                  variant="light"
                  size="xs"
                  style={{ minWidth: 30 }}
                >
                  ◀
                </Button>
                <Button
                  onClick={() => navigateEmail('next')}
                  disabled={currentEmailIndex === results.length - 1}
                  variant="light"
                  size="xs"
                  style={{ minWidth: 30 }}
                >
                  ▶
                </Button>
              </Group>
            </Group>

            {/* Current Email Display */}
            {currentEmail && (
              <Stack spacing="xl">
                {/* Profile Info */}
                <Box style={{ border: '1px solid #e9ecef', borderRadius: 8, padding: 12 }}>
                  <Text weight={600} size="sm" mb="xs">Profile: {currentEmail.profile?.name || 'Unknown'}</Text>
                  <Text size="xs" color="dimmed">
                    <strong>Position:</strong> {currentEmail.profile?.headline || 'N/A'}<br />
                    <strong>URL:</strong> {currentEmail.url || 'N/A'}
                  </Text>
                </Box>

                {/* Recipient Email */}
                <TextInput 
                  label="Recipient Email" 
                  placeholder="Enter email address..."
                  value={currentEmail.recipient_email || ''} 
                  onChange={(e) => updateCurrentEmail('recipient_email', e.target.value)} 
                  radius="md" 
                  size="sm"
                  styles={{ input: { background: '#e6f3ff', color: '#000a14', border: '1px solid #000a14', boxShadow: 'none' }, label: { color: '#000a14', fontWeight: 500 } }}
                  classNames={{ input: 'custom-input' }}
                />
                
                {/* Apollo Email Status */}
                {currentEmail.apollo_found && (
                  <Alert color="green" variant="light" radius="md" size="sm">
                    📧 Email auto-filled using Apollo People Search
                  </Alert>
                )}

                {/* Subject */}
                <TextInput 
                  label="Subject" 
                  value={currentEmail.generated_subject || ''} 
                  onChange={(e) => updateCurrentEmail('generated_subject', e.target.value)} 
                  radius="md" 
                  size="sm"
                  styles={{ input: { background: '#e6f3ff', color: '#000a14', border: '1px solid #000a14', boxShadow: 'none' }, label: { color: '#000a14', fontWeight: 500 } }}
                  classNames={{ input: 'custom-input' }}
                />

                {/* Email Body */}
                <Textarea 
                  label="Email Body" 
                  value={currentEmail.generated_email || ''} 
                  onChange={(e) => updateCurrentEmail('generated_email', e.target.value)} 
                  minRows={4} 
                  radius="md" 
                  size="sm"
                  autosize
                  maxRows={20}
                  styles={{ input: { background: '#e6f3ff', color: '#000a14', border: '1px solid #000a14', boxShadow: 'none', overflowY: 'auto' }, label: { color: '#000a14', fontWeight: 500 } }}
                  classNames={{ input: 'custom-input' }}
                />

                {/* Send Email Checkbox */}
                <Checkbox
                  label="Include this email in batch sending"
                  checked={currentEmail.shouldSend || false}
                  onChange={(event) => updateCurrentEmail('shouldSend', event.currentTarget.checked)}
                  size="sm"
                  styles={{ label: { color: '#000a14', fontWeight: 500 } }}
                />
              </Stack>
            )}

            {/* Send All Button */}
            <Stack spacing="sm">
              {isSending && (
                <Box>
                  <Text size="sm" mb="xs">Sending emails... {Math.round(sendingProgress)}%</Text>
                  <Progress value={sendingProgress} color="teal" />
                </Box>
              )}
              
              <Button
                onClick={sendAllEmails}
                disabled={isSending || getSelectedEmailsCount() === 0}
                loading={isSending}
                size="lg"
                color="teal"
                style={{ fontWeight: 600 }}
              >
                📧 Send ({getSelectedEmailsCount()}) Selected Emails
              </Button>
              
              <Button
                onClick={clearAllRemaining}
                variant="subtle"
                size="sm"
                color="red"
              >
                �️ Clear All Remaining Emails
              </Button>
            </Stack>
          </Stack>
        )}

        <style>{`.custom-input:focus { border: 1.5px solid #5fafde !important; box-shadow: 0 0 0 1.5px #5fafde !important; }`}</style>
      </Stack>
    </Paper>
    </>
  );
}
