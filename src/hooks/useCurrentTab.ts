import { useEffect, useState } from 'react';
import browser from 'webextension-polyfill';

export default function useCurrentTab(urlFilter?: string): [browser.Tabs.Tab | undefined, boolean] {
  const [tab, setTab] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  useEffect(() => {
    const filters: browser.Tabs.QueryQueryInfoType = { active: true, currentWindow: true };
    if (urlFilter) { filters.url = urlFilter; }
    setIsLoading(true);
    browser.tabs.query(filters).then((tabs) => {
      if (tabs.length > 0) {
        const currentTab = tabs[0];
        setTab(currentTab);
      }
    }).finally(() => setIsLoading(false));
  }, [urlFilter]);

  return [tab, isLoading];
}
