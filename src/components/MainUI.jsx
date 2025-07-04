import React, { useState, useEffect } from 'react';
import { Tabs, Paper, Box, Button, TextInput, Group, Badge, Loader, Notification, Stack, Text } from '@mantine/core';
import SimpleEmailForm from './SimpleEmailForm';
import AdvancedEmailForm from './AdvancedEmailForm';
import Settings from './Settings';
import SubscriptionsOnboardingPanel from './SubscriptionsOnboardingPanel';
import useLogin from '../hooks/useLogin';
import useCredits from '../hooks/useCredits';
import useProfile from '../hooks/useProfile';
import useStripeUpgrade from '../hooks/useStripeUpgrade';
import useUserProfile from '../hooks/useUserProfile';

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

export default function MainUI() {
  const { logout } = useLogin();
  const { credits, planType, trialEndDate, fetchCredits, loading: creditsLoading, error: creditsError } = useCredits();
  const [hovered, setHovered] = useState(false);
  const [daysLeft, setDaysLeft] = useState(null);
  const { profile, loading: profileLoading, error: profileError } = useProfile();
  const { upgrade: stripeUpgrade, loading: stripeLoading, error: stripeError, setError: setStripeError } = useStripeUpgrade();
  const { userProfile, fetchUserProfile, loading: userProfileLoading, error: userProfileError } = useUserProfile();
  const { plan_type, trial_end_date, subscription_updated_at } = userProfile || {};
  const [loadingPlan, setLoadingPlan] = useState(null); // 'basic' | 'advanced' | null
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    fetchCredits();
  }, [fetchCredits]);

  useEffect(() => {
    if (planType === 'trial' && trialEndDate) {
      const today = new Date();
      const end = new Date(trialEndDate);
      const diff = Math.ceil((end - today) / (1000 * 60 * 60 * 24));
      setDaysLeft(diff >= 0 ? diff : 0);
    } else {
      setDaysLeft(null);
    }
  }, [planType, trialEndDate]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchUserProfile();
        fetchCredits && fetchCredits();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [fetchUserProfile, fetchCredits]);

  useEffect(() => {
    // Show welcome popup after login (first mount)
    setShowWelcome(true);
  }, []);

  // Helper: trial days left
  let trialDaysLeft = null;
  if (profile && profile.plan_type === 'trial' && profile.trial_end_date) {
    const end = new Date(profile.trial_end_date);
    const now = new Date();
    const diff = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
    trialDaysLeft = diff > 0 ? diff : 0;
  }

  // Helper: plan label (for profile)
  const planLabel = profileLoading ? 'Loading...' : profileError ? 'Error' : (profile?.plan_type === 'basic' ? 'Basic' : profile?.plan_type === 'advanced' ? 'Advanced' : profile?.plan_type === 'trial' ? 'Free Trial' : '—');

  // Helper: plan label (for userProfile)
  const userPlanLabel = userProfileLoading
    ? 'Loading...'
    : plan_type === undefined && userProfileError
      ? '—'
      : userProfileError
        ? 'Error'
        : plan_type === 'basic'
          ? 'Basic'
          : plan_type === 'advanced'
            ? 'Advanced'
            : plan_type === 'trial'
              ? 'Free Trial'
              : '—';

  return (
    <>
      {/* Welcome Popup */}
      {showWelcome && (
        <Paper p="md" radius="md" shadow="sm" style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 1000, maxWidth: 380, background: '#f8fafc', border: '1px solid #b3d6f2' }}>
          <Text size="md" weight={600} mb={4} style={{ color: '#1a2636' }}>
            Welcome to Pingu, your email assistant!
          </Text>
          <Text size="sm" color="dimmed" mb={8}>
            Pingu understands you and your email recipient's background to craft the best cold email! Use your available credits to generate & send emails. Upgrade your plan to unlock more features and credits. You can manage your subscription and see your current plan in the Subscriptions tab. If you have any questions, check the Settings tab.
          </Text>
          <Button size="xs" color="blue" variant="light" onClick={() => setShowWelcome(false)} style={{ float: 'right', marginTop: 4 }}>
            Close
          </Button>
        </Paper>
      )}
      <Box style={{ minWidth: 360, maxWidth: 440, margin: '0 auto', minHeight: '100vh', position: 'relative', padding: 0, background: '#e6f3ff', color: '#000a14', fontFamily: 'inherit' }}>
        <Paper p="xl" radius="md" shadow="md" style={{ background: '#e6f3ff', border: '1px solid #b3d6f2', boxShadow: '0 2px 12px rgba(0,0,0,0.08)', color: '#000a14' }}>
          <Group position="apart" mb="lg" align="flex-start" style={{ width: '100%' }}>
            <TextInput
              label="Credits"
              value={creditsLoading ? 'Loading...' : creditsError ? 'Error' : credits ?? '—'}
              readOnly
              radius="md"
              size="sm"
              styles={{
                input: { background: '#e6f3ff', color: '#000a14', fontWeight: 700, width: 90 },
                label: { color: '#000a14', fontWeight: 500 }
              }}
            />
            <div style={{ flex: 1 }} />
            <Button
              onClick={logout}
              color="red"
              size="md"
              radius="xl"
              style={{ fontWeight: 700, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', background: 'var(--mantine-color-red-6)', color: 'white', letterSpacing: 0.5, padding: '0 28px', alignSelf: 'flex-start' }}
            >
              Log out
            </Button>
          </Group>
          <Tabs
            defaultValue="simple"
            variant="pills"
            radius="md"
            color="blue"
            keepMounted={false}
          >
            <div style={{ overflowX: 'auto', whiteSpace: 'nowrap', width: '100%', marginBottom: 24 }}>
              <Tabs.List
                mb="lg"
                style={{
                  justifyContent: 'flex-start',
                  gap: 8,
                  background: 'transparent',
                  minHeight: 0,
                  height: 32,
                  padding: 0,
                  display: 'flex',
                  flexWrap: 'nowrap',
                  flexDirection: 'row',
                  alignItems: 'center',
                  whiteSpace: 'nowrap',
                  scrollbarWidth: 'thin',
                  msOverflowStyle: 'auto',
                  WebkitOverflowScrolling: 'touch',
                  maxWidth: '100%',
                }}
              >
                <Tabs.Tab
                  value="simple"
                  style={{ ...blueButtonStyle, ...(hovered === 'simple' ? blueButtonHover : {}), fontWeight: 500, fontSize: 13, minHeight: 0, height: 28, padding: '0 14px', borderRadius: 8, flex: 1, maxWidth: 140, whiteSpace: 'nowrap' }}
                  onMouseEnter={() => setHovered('simple')}
                  onMouseLeave={() => setHovered(false)}
                >
                  Simple Email
                </Tabs.Tab>
                <Tabs.Tab
                  value="advanced"
                  style={{ ...blueButtonStyle, ...(hovered === 'advanced' ? blueButtonHover : {}), fontWeight: 500, fontSize: 13, minHeight: 0, height: 28, padding: '0 14px', borderRadius: 8, flex: 1, maxWidth: 140, whiteSpace: 'nowrap' }}
                  onMouseEnter={() => setHovered('advanced')}
                  onMouseLeave={() => setHovered(false)}
                >
                  Advanced Email
                </Tabs.Tab>
                <Tabs.Tab
                  value="subscriptions"
                  style={{ ...blueButtonStyle, ...(hovered === 'subscriptions' ? blueButtonHover : {}), fontWeight: 500, fontSize: 13, minHeight: 0, height: 28, padding: '0 14px', borderRadius: 8, flex: 1, maxWidth: 140, whiteSpace: 'nowrap' }}
                  onMouseEnter={() => setHovered('subscriptions')}
                  onMouseLeave={() => setHovered(false)}
                >
                  Subscriptions
                </Tabs.Tab>
                <Tabs.Tab
                  value="settings"
                  style={{ ...blueButtonStyle, ...(hovered === 'settings' ? blueButtonHover : {}), fontWeight: 500, fontSize: 13, minHeight: 0, height: 28, padding: '0 14px', borderRadius: 8, flex: 1, maxWidth: 140, whiteSpace: 'nowrap' }}
                  onMouseEnter={() => setHovered('settings')}
                  onMouseLeave={() => setHovered(false)}
                >
                  Settings
                </Tabs.Tab>
              </Tabs.List>
            </div>
            <Tabs.Panel value="simple" pt={0} style={{ background: 'transparent', borderRadius: 0, padding: 0 }}>
              <SimpleEmailForm 
                credits={credits}
                creditsLoading={creditsLoading}
                creditsError={creditsError}
                fetchCredits={fetchCredits}
              />
            </Tabs.Panel>
            <Tabs.Panel value="advanced" pt={0} style={{ background: 'transparent', borderRadius: 0, padding: 0 }}>
              <AdvancedEmailForm 
                credits={credits}
                creditsLoading={creditsLoading}
                creditsError={creditsError}
                fetchCredits={fetchCredits}
              />
            </Tabs.Panel>
            <Tabs.Panel value="subscriptions" pt={0} style={{ background: 'transparent', borderRadius: 0, padding: 0 }}>
              <SubscriptionsOnboardingPanel />
              <Box p="md">
                <Group position="apart" align="center" mb={8}>
                  <Text weight={600} size="md">Current Plan:</Text>
                  {userProfileLoading ? (
                    <Loader size="sm" />
                  ) : (
                    <Badge color={
                      plan_type === 'advanced' ? 'blue' :
                      plan_type === 'basic' ? 'cyan' :
                      plan_type === 'trial' ? 'gray' : 'gray'
                    } size="lg" radius="sm">
                      {userPlanLabel}
                    </Badge>
                  )}
                </Group>
                <Group position="apart" align="center" mb={8}>
                  <Text weight={500} size="sm">Plan Ends:</Text>
                  <Text weight={700} size="sm">
                    {userProfileLoading ? <Loader size="xs" /> :
                      plan_type === undefined && userProfileError ? '—' :
                      (plan_type === 'trial' && trial_end_date) ? new Date(trial_end_date).toLocaleDateString() :
                      ((plan_type === 'basic' || plan_type === 'advanced') && subscription_updated_at) ? new Date(subscription_updated_at).toLocaleDateString() :
                      '—'}
                  </Text>
                </Group>
                {/* Upgrade Options */}
                {(plan_type === 'trial' || plan_type === undefined || plan_type === null) && (
                  <Stack spacing={8} mt={12}>
                    <Button
                      size="md"
                      radius="md"
                      color="cyan"
                      variant="outline"
                      loading={loadingPlan === 'basic'}
                      onClick={async () => {
                        setLoadingPlan('basic');
                        await stripeUpgrade('basic');
                        setLoadingPlan(null);
                        fetchUserProfile(); // Refresh user profile after upgrade
                      }}
                      style={{ fontWeight: 600, minWidth: 180 }}
                    >
                      Upgrade to Basic ($3/mo)
                    </Button>
                    <Button
                      size="md"
                      radius="md"
                      color="blue"
                      variant="outline"
                      loading={loadingPlan === 'advanced'}
                      onClick={async () => {
                        setLoadingPlan('advanced');
                        await stripeUpgrade('advanced');
                        setLoadingPlan(null);
                        fetchUserProfile(); // Refresh user profile after upgrade
                      }}
                      style={{ fontWeight: 600, minWidth: 180 }}
                    >
                      Upgrade to Advanced ($12/mo)
                    </Button>
                  </Stack>
                )}
                {plan_type === 'basic' && (
                  <Stack spacing={8} mt={12}>
                    <Button
                      size="md"
                      radius="md"
                      color="blue"
                      variant="outline"
                      loading={loadingPlan === 'advanced'}
                      onClick={async () => {
                        setLoadingPlan('advanced');
                        await stripeUpgrade('advanced');
                        setLoadingPlan(null);
                        fetchUserProfile(); // Refresh user profile after upgrade
                      }}
                      style={{ fontWeight: 600, minWidth: 180 }}
                    >
                      Upgrade to Advanced ($12/mo)
                    </Button>
                  </Stack>
                )}
                {plan_type === 'advanced' && (
                  <Text mt={16} color="green" weight={600} align="center">You are on the highest plan.</Text>
                )}
                {stripeError && <Notification color="red" mt={8} onClose={() => setStripeError(null)}>{stripeError}</Notification>}
              </Box>
            </Tabs.Panel>
            <Tabs.Panel value="settings" pt={0} style={{ background: 'transparent', borderRadius: 0, padding: 0 }}>
              <Settings />
            </Tabs.Panel>
          </Tabs>
        </Paper>
      </Box>
    </>
  );
}
