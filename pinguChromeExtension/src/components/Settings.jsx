import React, { useState, useEffect } from 'react';
import { Text, TextInput, Textarea, Button, Group, Notification, Modal } from '@mantine/core';
import useProfile from '../hooks/useProfile';

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

const Settings = () => {
  const { profile, loading, saveProfile, error, getProfile } = useProfile();
  const [form, setForm] = React.useState(profile || {});
  const [savedMsg, setSavedMsg] = React.useState('');
  const [hovered, setHovered] = React.useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem('hasSeenSettingsOnboarding')) {
      setShowOnboarding(true);
    }
  }, []);

  const handleCloseOnboarding = () => {
    setShowOnboarding(false);
    localStorage.setItem('hasSeenSettingsOnboarding', 'true');
  };

  React.useEffect(() => {
    getProfile();
  }, [getProfile]);

  React.useEffect(() => {
    setForm(profile || {});
  }, [profile]);

  const handleChange = (field) => (e) => {
    setForm({ ...form, [field]: e.target.value });
  };
  
  const handleSave = () => {
    saveProfile(form);
    setSavedMsg('Saved!');
    setTimeout(() => setSavedMsg(''), 2000);
  };

  return (
    <>
      <Modal
        opened={showOnboarding}
        onClose={handleCloseOnboarding}
        title="Settings Tab"
        centered
        overlayProps={{ backgroundOpacity: 0.55, blur: 2 }}
      >
        <Text size="md" mb="md">
          Add your background, interests, and personal context here. Pingu will learn you and craft emails that reflect your career interests and background.
        </Text>
        <Button onClick={handleCloseOnboarding} fullWidth color="blue" radius="md">Got it!</Button>
      </Modal>
      <form style={{ background: '#e6f3ff', borderRadius: 12, padding: 0, color: '#000a14', fontFamily: 'inherit' }}>
        {error && (
          <Notification color="red" title="Profile Error" mb="md">
            {error.toString()}
          </Notification>
        )}
        <TextInput label="Your Name" value={form.name || ''} onChange={handleChange('name')} mb="sm"
          placeholder="John Doe"
          styles={{ input: { background: '#e6f3ff', color: '#000a14', border: '1px solid #000a14', boxShadow: 'none' }, label: { color: '#000a14', fontWeight: 500 }, root: { },  }}
          classNames={{ input: 'custom-input' }}
        />
        <Textarea label="Brief Intro" value={form.intro || ''} onChange={handleChange('intro')} mb="sm"
          placeholder="I'm a fourth-year UC Berkeley Data Science undergraduate student"
          styles={{ input: { background: '#e6f3ff', color: '#000a14', border: '1px solid #000a14', boxShadow: 'none' }, label: { color: '#000a14', fontWeight: 500 } }}
          classNames={{ input: 'custom-input' }}
        />
        <TextInput label="Default Career Interest" value={form.default_interest || ''} onChange={handleChange('default_interest')} mb="sm"
          placeholder="Data Analytics"
          styles={{ input: { background: '#e6f3ff', color: '#000a14', border: '1px solid #000a14', boxShadow: 'none' }, label: { color: '#000a14', fontWeight: 500 } }}
          classNames={{ input: 'custom-input' }}
        />
        <Textarea label="Personal Context" value={form.persona_context || ''} onChange={handleChange('persona_context')} mb="sm"
          placeholder="I have previously worked on analyzing customers at X Company and love to do Y."
          autosize
          minRows={3}
          maxRows={12}
          styles={{ input: { background: '#e6f3ff', color: '#000a14', border: '1px solid #000a14', boxShadow: 'none' }, label: { color: '#000a14', fontWeight: 500 } }}
          classNames={{ input: 'custom-input' }}
        />
        <TextInput label="Company of Interest" value={form.company_interest || ''} onChange={handleChange('company_interest')} mb="sm"
          styles={{ input: { background: '#e6f3ff', color: '#000a14', border: '1px solid #000a14', boxShadow: 'none' }, label: { color: '#000a14', fontWeight: 500 } }}
          classNames={{ input: 'custom-input' }}
        />
        <TextInput label="Role Type" value={form.role_type || ''} onChange={handleChange('role_type')} mb="sm"
          placeholder="Internship/Full-Time/Research"
          styles={{ input: { background: '#e6f3ff', color: '#000a14', border: '1px solid #000a14', boxShadow: 'none' }, label: { color: '#000a14', fontWeight: 500 } }}
          classNames={{ input: 'custom-input' }}
        />
        <Group position="right">
          <Button
            onClick={handleSave}
            disabled={loading}
            style={{ ...blueButtonStyle, ...(hovered ? blueButtonHover : {}) }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
          >
            Save Profile
          </Button>
          {savedMsg && <span style={{ color: '#4fd165', marginLeft: 12, fontWeight: 500 }}>{savedMsg}</span>}
        </Group>
        <style>{`.custom-input:focus { border: 1.5px solid #5fafde !important; box-shadow: 0 0 0 1.5px #5fafde !important; }`}</style>
      </form>
    </>
  );
};

export default Settings;
