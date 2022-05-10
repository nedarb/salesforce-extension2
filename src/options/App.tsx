import React, { useEffect } from 'react';
import browser from 'webextension-polyfill';

const App = () => {
  const handleClick = async () => {
    const result = await browser.permissions.request({
      permissions: ['cookies'],
      origins: ['https://developer.chrome.com/*'],
    });
    console.log(result);
  };
  return (
    <div>
      Get started at './src/options/App.tsx' OPTIONS
      <button onClick={() => handleClick()} type='button'>
        Check
      </button>
    </div>
  );
};

export default App;
