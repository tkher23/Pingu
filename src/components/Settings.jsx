import React from 'react';
import { Text, TextInput, Textarea, Select, Button, Group, Notification } from '@mantine/core';
import useProfile from '../hooks/useProfile';

const Settings = () => {
  const { profile, loading, saveProfile, error, getProfile } = useProfile();
  const [form, setForm] = React.useState(profile || {});
  const [savedMsg, setSavedMsg] = React.useState('');

  React.useEffect(() => {
    getProfile();
  }, [getProfile]);

  React.useEffect(() => {
    setForm(profile || {});
  }, [profile]);

  const handleChange = (field) => (e) => {
    setForm({ ...form, [field]: e.target.value });
  };

  const handleSelect = (value) => {
    setForm({ ...form, role_type: value });
  };

  const handleSave = () => {
    saveProfile(form);
    setSavedMsg('Saved!');
    setTimeout(() => setSavedMsg(''), 2000);
  };

  return (
    <form>
      {error && (
        <Notification color="red" title="Profile Error" mb="md">
          {error.toString()}
        </Notification>
      )}
      <TextInput label="Your Name" value={form.name || ''} onChange={handleChange('name')} mb="sm" />
      <Textarea label="Brief Intro" value={form.intro || ''} onChange={handleChange('intro')} mb="sm" />
      <TextInput label="Default Career/Internship Interest" value={form.default_interest || ''} onChange={handleChange('default_interest')} mb="sm" />
      <Textarea label="Personal Context" value={form.persona_context || ''} onChange={handleChange('persona_context')} mb="sm" />
      <TextInput label="Company of Interest" value={form.company_interest || ''} onChange={handleChange('company_interest')} mb="sm" />
      <Select label="Role Type" value={form.role_type || 'internship'} onChange={handleSelect} data={[{value:'internship',label:'Internship'},{value:'full-time',label:'Full-Time'}]} mb="sm" />
      <Group position="right">
        <Button onClick={handleSave} disabled={loading}>Save Profile</Button>
        {savedMsg && <span style={{ color: '#4fd165', marginLeft: 12, fontWeight: 500 }}>{savedMsg}</span>}
      </Group>
    </form>
  );
};

export default Settings;
