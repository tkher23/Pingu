import React, { useState } from 'react';
import { Tabs, Paper, Box, Button, TextInput, Group } from '@mantine/core';
import SimpleEmailForm from './SimpleEmailForm';
import AdvancedEmailForm from './AdvancedEmailForm';
import Settings from './Settings';
import useLogin from '../hooks/useLogin';
import useCredits from '../hooks/useCredits';

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
  const { credits, fetchCredits, loading: creditsLoading, error: creditsError } = useCredits();
  const [hovered, setHovered] = useState(false);

  React.useEffect(() => { fetchCredits(); }, [fetchCredits]);

  return (
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
        <Tabs defaultValue="simple" variant="pills" radius="md" color="blue" keepMounted={false}>
          <Tabs.List mb="lg" style={{ justifyContent: 'center', gap: 8, background: 'transparent', minHeight: 0, height: 32, padding: 0, display: 'flex', flexWrap: 'nowrap', flexDirection: 'row', alignItems: 'center' }}>
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
              value="settings"
              style={{ ...blueButtonStyle, ...(hovered === 'settings' ? blueButtonHover : {}), fontWeight: 500, fontSize: 13, minHeight: 0, height: 28, padding: '0 14px', borderRadius: 8, flex: 1, maxWidth: 140, whiteSpace: 'nowrap' }}
              onMouseEnter={() => setHovered('settings')}
              onMouseLeave={() => setHovered(false)}
            >
              Settings
            </Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value="simple" pt={0} style={{ background: 'transparent', borderRadius: 0, padding: 0 }}>
            <SimpleEmailForm />
          </Tabs.Panel>
          <Tabs.Panel value="advanced" pt={0} style={{ background: 'transparent', borderRadius: 0, padding: 0 }}>
            <AdvancedEmailForm />
          </Tabs.Panel>
          <Tabs.Panel value="settings" pt={0} style={{ background: 'transparent', borderRadius: 0, padding: 0 }}>
            <Settings />
          </Tabs.Panel>
        </Tabs>
      </Paper>
    </Box>
  );
}
