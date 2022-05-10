import { useEffect, useState } from 'react';
import browser from 'webextension-polyfill';

export default function useCurrentTab(urlFilter?: string): browser.Tabs.Tab | undefined {
  const [tab, setTab] = useState<any>(null);
  useEffect(() => {
    const filters: browser.Tabs.QueryQueryInfoType = { active: true, currentWindow: true };
    if (urlFilter) { filters.url = urlFilter; }
    browser.tabs.query(filters).then((tabs) => {
      if (tabs.length > 0) {
        const currentTab = tabs[0];
        setTab(currentTab);
      }
    });
  }, [urlFilter]);

  return tab;
}
