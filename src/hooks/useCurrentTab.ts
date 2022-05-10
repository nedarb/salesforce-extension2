import { useEffect, useState } from 'react';
import browser from 'webextension-polyfill';

export default function useCurrentTab(): browser.Tabs.Tab | undefined {
  const [tab, setTab] = useState<any>(null);
  useEffect(() => {
    browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
      if (tabs.length > 0) {
        const currentTab = tabs[0];
        setTab(currentTab);
      }
    });
  }, []);

  return tab;
}
