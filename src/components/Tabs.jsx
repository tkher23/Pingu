import React, { useState } from 'react';
const Tabs = ({ tabs, children }) => {
  const [active, setActive] = useState(0);
  return (
    <div>
      <div style={{ display: 'flex' }}>
        {tabs.map((tab, i) => (
          <button key={tab} onClick={() => setActive(i)}>{tab}</button>
        ))}
      </div>
      <div>{children[active]}</div>
    </div>
  );
};
export default Tabs;
