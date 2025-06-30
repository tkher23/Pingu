import React from 'react';
import { Tabs, Paper, Box, Button, TextInput, Group } from '@mantine/core';
import SimpleEmailForm from './SimpleEmailForm';
import AdvancedEmailForm from './AdvancedEmailForm';
import Settings from './Settings';
import useLogin from '../hooks/useLogin';
import useCredits from '../hooks/useCredits';

export default function MainUI() {
  const { logout } = useLogin();
  const { credits, fetchCredits, loading: creditsLoading, error: creditsError } = useCredits();

  React.useEffect(() => { fetchCredits(); }, [fetchCredits]);

  return (
    <Box style={{ minWidth: 360, maxWidth: 440, margin: '0 auto', minHeight: '100vh', position: 'relative', padding: 0, background: 'var(--mantine-color-dark-8)' }}>
      <Paper p="xl" radius="md" shadow="md" style={{ marginTop: 32, background: 'var(--mantine-color-dark-6)', border: '1px solid var(--mantine-color-dark-4)', boxShadow: '0 2px 12px rgba(0,0,0,0.18)' }}>
        <Group position="apart" mb="lg">
          <TextInput
            label="Credits"
            value={creditsLoading ? 'Loading...' : creditsError ? 'Error' : credits ?? '—'}
            readOnly
            radius="md"
            size="sm"
            styles={{
              input: { background: 'var(--mantine-color-dark-7)', color: 'var(--mantine-color-green-4)', fontWeight: 700, width: 90 },
              label: { color: 'var(--mantine-color-gray-3)', fontWeight: 500 }
            }}
          />
          <Button
            onClick={logout}
            color="red"
            size="md"
            radius="xl"
            style={{ fontWeight: 700, boxShadow: '0 2px 8px rgba(0,0,0,0.15)', background: 'var(--mantine-color-red-6)', color: 'white', letterSpacing: 0.5, padding: '0 28px' }}
          >
            Log out
          </Button>
        </Group>
        <Tabs defaultValue="simple" variant="pills" radius="md" color="blue" keepMounted={false}>
          <Tabs.List mb="lg" style={{ justifyContent: 'center', gap: 8, background: 'transparent' }}>
            <Tabs.Tab value="simple" style={{ fontWeight: 500, fontSize: 15, color: 'var(--mantine-color-gray-2)' }}>Simple Email</Tabs.Tab>
            <Tabs.Tab value="advanced" style={{ fontWeight: 500, fontSize: 15, color: 'var(--mantine-color-gray-2)' }}>Advanced Email</Tabs.Tab>
            <Tabs.Tab value="settings" style={{ fontWeight: 500, fontSize: 15, color: 'var(--mantine-color-gray-2)' }}>Settings</Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value="simple" pt="md" style={{ background: 'var(--mantine-color-dark-6)', borderRadius: 12, padding: 0 }}>
            <SimpleEmailForm />
          </Tabs.Panel>
          <Tabs.Panel value="advanced" pt="md" style={{ background: 'var(--mantine-color-dark-6)', borderRadius: 12, padding: 0 }}>
            <AdvancedEmailForm />
          </Tabs.Panel>
          <Tabs.Panel value="settings" pt="md" style={{ background: 'var(--mantine-color-dark-6)', borderRadius: 12, padding: 0 }}>
            <Settings />
          </Tabs.Panel>
        </Tabs>
      </Paper>
    </Box>
  );
}
