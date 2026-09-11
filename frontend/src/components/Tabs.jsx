import React from 'react';
import { Tabs as MantineTabs } from '@mantine/core';

const Tabs = ({ tabs, children }) => {
  return (
    <MantineTabs defaultValue={tabs[0]}>
      <MantineTabs.List>
        {tabs.map((tab, i) => (
          <MantineTabs.Tab value={tab} key={tab}>{tab}</MantineTabs.Tab>
        ))}
      </MantineTabs.List>
      {children.map((child, i) => (
        <MantineTabs.Panel value={tabs[i]} key={tabs[i]}>
          {child}
        </MantineTabs.Panel>
      ))}
    </MantineTabs>
  );
};

export default Tabs;
