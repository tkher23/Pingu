import React, { useState, useEffect } from 'react';
import { Modal, Button, Text } from '@mantine/core';

const SubscriptionsOnboardingPanel = () => {
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem('hasSeenSubscriptionsOnboarding')) {
      setShowOnboarding(true);
    }
  }, []);

  const handleCloseOnboarding = () => {
    setShowOnboarding(false);
    localStorage.setItem('hasSeenSubscriptionsOnboarding', 'true');
  };

  return (
    <Modal
      opened={showOnboarding}
      onClose={handleCloseOnboarding}
      title="Subscriptions Tab"
      centered
      overlayProps={{ backgroundOpacity: 0.55, blur: 2 }}
    >
      <Text size="md" mb="md">
        Here you can view your current plan, see when it ends, and upgrade or change your subscription. All your plan and credit info is managed here. Simple emails use 1 credit, Agentic Mode uses 1 credit per profile, and Batch Mode uses 1 credit per profile processed.
      </Text>
      <Button onClick={handleCloseOnboarding} fullWidth color="blue" radius="md">Got it!</Button>
    </Modal>
  );
};

export default SubscriptionsOnboardingPanel;
