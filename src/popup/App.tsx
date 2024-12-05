import React, {
  useCallback, useContext, useEffect, useState,
} from 'react';
import browser from 'webextension-polyfill';
import { Button, Text, Paper } from '@mantine/core';
import useCurrentTab from '../hooks/useCurrentTab';
import useBrowserCookie from '../hooks/useBrowserCookie';
import { useSalesforceApi } from '../hooks/useSalesforceQuery';
import urlToSalesforceMyDomain, {
  SalesforceDomains,
} from '../common/SalesforceUtils';
import SalesforceContext from '../contexts/SalesforceContext';
import useAsyncState from '../hooks/useAsyncState';
import SalesforceSession from '../components/SalesforceSession';
import CookieChooser from '../components/CookieChooser';
import Query from '../newtab/Query';
import useLocalStorage from '../hooks/useLocalStorage';
import useBrowserPermission from '../hooks/useBrowserPermission';

interface SalesforceApiIdentity {
  display_name: string;
  email: string;
}

function LoggedIntoSalesforce() {
  const { cookie } = useContext(SalesforceContext);

  return <Query cookie={cookie} />;
}

function getSalesforceTabs() {
  return browser.tabs.query({
    url: [
      'https://*.lightning.force.com/*',
      'https://*.lightning.localhost.sfdcdev.force.com/*',
    ],
  });
}

const App = () => {
  const windowUrl = new URL(window.location.href);
  const [lastDomainUsed, setLastDomainUsed] =
    useLocalStorage<string>('lastDomain');
  const [salesforceTabs, isSalesforceTabsLoading] =
    useAsyncState(getSalesforceTabs);
  const salesforceTabDomains: Set<string | undefined> = new Set(
    salesforceTabs
      ?.map((t) => t.url)
      .map((url) => (url ? new URL(url) : null))
      .filter((url) => !!url)
      .map((url) => url?.host),
  );
  const permissions = useBrowserPermission();
  const [specificCookie, setSpecificCookie] = useState<
    browser.Cookies.Cookie | undefined
  >();
  const [currentTab, isCurrentTabLoading] = useCurrentTab();
  const currentTabUrl = [
    urlToSalesforceMyDomain(windowUrl.searchParams.get('domain')) ?? undefined,
    specificCookie?.domain ? `https://${specificCookie.domain}` : undefined,
    currentTab?.url,
    ...(salesforceTabs?.map((t) => t.url).filter(Boolean) || []),
  ].filter(Boolean)[0];

  const [cookie, isCookieLoading] = useBrowserCookie({
    url: urlToSalesforceMyDomain(currentTabUrl),
    name: 'sid',
  });

  const isLoadingPrimitives =
    isSalesforceTabsLoading || isCurrentTabLoading || isCookieLoading;

  const { results: apiResults } = useSalesforceApi<{ identity: string }>({
    url: '/services/data/v50.0',
    cookie,
    useCache: true,
  });

  const { results: identityResults } = useSalesforceApi<SalesforceApiIdentity>({
    url: apiResults?.identity,
    cookie,
    useCache: true,
  });

  const handleCookieChosen = useCallback((c: browser.Cookies.Cookie) => {
    const url = new URL(window.location.href);
    url.searchParams.set('domain', c.domain);
    window.history.pushState({}, 'Title', url.toString());
    setLastDomainUsed(c.domain);
    setSpecificCookie(c);
  }, []);

  useEffect(() => {
    console.log(
      'salesforceTabs',
      salesforceTabDomains,
      salesforceTabs?.map((t) => [t.url, t.title]),
    );
  }, [salesforceTabs]);

  console.log('permissions', permissions);

  if (isLoadingPrimitives) {
    return null;
  }

  const url = currentTabUrl?.startsWith('http') ? new URL(currentTabUrl) : null;

  if (url && SalesforceDomains.find((domain) => url?.host.endsWith(domain))) {
    const launchUrl = `${browser.runtime.getURL('./newtab.html')}?domain=${
      url?.host
    }`;

    return (
      <SalesforceSession domain={url.host}>
        <Text size="xs">
          <CookieChooser
            defaultDomain={url.host}
            onCookieChosen={handleCookieChosen}
          />
          <Button
            component="a"
            href={launchUrl}
            target="_blank"
            rel="noreferrer"
          >
            Explore
          </Button>
          <p>
            {identityResults?.display_name} ({identityResults?.email})
          </p>
          <LoggedIntoSalesforce />
        </Text>
      </SalesforceSession>
    );
  }

  return (
    <Paper shadow="xs" p="md">
      <Text>
        Open a Salesforce tab to explore the org.
        {specificCookie?.domain}
      </Text>
      <CookieChooser
        defaultDomain={lastDomainUsed}
        onCookieChosen={handleCookieChosen}
      />
      <Button
        component="a"
        href={`https://${lastDomainUsed ?? 'login.salesforce.com'}`}
        target="_blank"
        rel="noreferrer"
      >
        Log back in
      </Button>
    </Paper>
  );
};

export default App;
