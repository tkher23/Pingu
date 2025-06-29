import React from 'react';
import { Tabs, Paper, Box } from '@mantine/core';
import SimpleEmailForm from './SimpleEmailForm';
import EmailForm from './EmailForm';
import Settings from './Settings';
import useLogin from '../hooks/useLogin';
import useProfile from '../hooks/useProfile';
import useCredits from '../hooks/useCredits';

export default function MainUI() {
  const { logout } = useLogin();
  const { profile, loading: profileLoading } = useProfile();
  const { credits, loading: creditsLoading } = useCredits();

  return (
    <Box style={{ minWidth: 340, maxWidth: 400, margin: '0 auto' }}>
      <Paper p="md" radius="md" shadow="xs">
        <Tabs defaultValue="simple" variant="outline" radius="md">
          <Tabs.List mb="md">
            <Tabs.Tab value="simple">Simple Email</Tabs.Tab>
            <Tabs.Tab value="advanced">Advanced Email</Tabs.Tab>
            <Tabs.Tab value="settings">Settings</Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value="simple" pt="md">
            <SimpleEmailForm />
          </Tabs.Panel>
          <Tabs.Panel value="advanced" pt="md">
            <EmailForm />
          </Tabs.Panel>
          <Tabs.Panel value="settings" pt="md">
            <Settings />
          </Tabs.Panel>
        </Tabs>
      </Paper>
    </Box>
  );
}
