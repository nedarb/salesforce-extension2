import React, { useEffect, useState } from 'react';
import browser from 'webextension-polyfill';
import {
  Textarea, LoadingOverlay, Button, Text, Table,
} from '@mantine/core';
import useCurrentTab from '../hooks/useCurrentTab';
import useBrowserPermission from '../hooks/useBrowserPermission';
import useBrowserCookie from '../hooks/useBrowserCookie';
import useSalesforceQuery, {
  useSalesforceApi,
  useSalesforceQueryExplain,
} from '../hooks/useSalesforceQuery';
import useDebounce from '../hooks/useDebounce';
import normalizeSalesforceDomain, {
  SalesforceDomains,
} from '../common/SalesforceUtils';
import SalesforceContext from '../contexts/SalesforceContext';
import useLocalStorage from '../hooks/useLocalStorage';
import useAsyncState from '../hooks/useAsyncState';
import QueryResultsTable from '../components/QueryResultsTable';

interface SalesforceApiIdentity {
  display_name: string;
  email: string;
}

function RenderCell({ name, value, href }: { name: string; value: any; href?: string }) {
  if (typeof value === 'boolean') {
    return <td>{value ? '✔️' : '☐'}</td>;
  }
  if (value == null) {
    return <td>-</td>;
  }
  if (typeof value === 'object') {
    const keys = Object.keys(value).filter((key) => key !== 'attributes');
    return <td>{keys.length === 1 ? value[keys[0] || ''] : keys.map((key) => `${key}: ${value[key]}`).join(', ')}</td>;
  }
  if (href && name === 'Name') {
    return (
      <td>
        <a href={href} target="_blank">{value}</a>
      </td>
    );
  }
  return <td>{value}</td>;
}

function LoggedIntoSalesforce({ cookie }: { cookie: browser.Cookies.Cookie }) {
  const [query, setQuery] = useLocalStorage(`popup_query:${cookie.domain}`, 'SELECT Id, Name, IsActive FROM User LIMIT 10');
  const [debounced] = useDebounce(query);
  const {
    results: queryExplainResults,
    error: queryExplainError,
    isLoading,
  } = useSalesforceQueryExplain<{ sourceQuery: string }>({
    query: debounced,
    cookie,
  });

  const { results: queryResults } = useSalesforceQuery<{
    done: boolean;
    totalSize: number;
    records: Array<any>;
  }>({ query: queryExplainResults?.sourceQuery, cookie });

  useEffect(() => {
    console.log(queryExplainResults, queryExplainError);
  }, [queryExplainResults, queryExplainError]);

  const handleChange = (e) => setQuery(e.target.value.trim());

  return (
    <div>
      Logged in to {cookie.domain}
      <form>
        <LoadingOverlay visible={isLoading} />
        <Textarea
          autosize
          value={query}
          onChange={handleChange}
          disabled={isLoading}
        />
        <p>
          {queryExplainError &&
            queryExplainError.map((e) => (
              <div key={e.errorCode}>
                {e.errorCode}: {e.message}
              </div>
            ))}
        </p>
        <p>
          {queryResults && <QueryResultsTable queryResults={queryResults} cookie={cookie} />}
        </p>
      </form>
    </div>
  );
}

const windowUrl = new URL(window.location.href);

function getSalesforceTabs() {
  return browser.tabs.query({ url: 'https://*.lightning.force.com/*' });
}

const App = () => {
  const salesforceTabs = useAsyncState(getSalesforceTabs);
  const salesforceTabDomains: Set<string | undefined> = new Set(salesforceTabs?.map((t) => t.url)
    .map((url) => (url ? new URL(url) : null))
    .filter((url) => !!url)
    .map((url) => url?.host));
  const currentTab = useCurrentTab('https://*.lightning.force.com/*');
  const currentTabUrl = [currentTab?.url, ...salesforceTabs?.map((t) => t.url).filter(Boolean) || []].filter(Boolean)[0];
  console.log('curentTabUrl', currentTabUrl);

  const [
    hasPermission,
    onRequestPermission,
    onRemovePermission,
  ] = useBrowserPermission(currentTabUrl);
  const cookie = useBrowserCookie({
    url: hasPermission ? normalizeSalesforceDomain(currentTabUrl) : undefined,
    name: 'sid',
  });

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

  useEffect(() => {
    console.log('salesforceTabs', salesforceTabDomains, salesforceTabs?.map((t) => ([t.url, t.title])));
  }, [salesforceTabs]);

  const url = currentTabUrl?.startsWith('http') ? new URL(currentTabUrl) : null;

  if (url && SalesforceDomains.find((domain) => url?.host.endsWith(domain))) {
    const launchUrl = `${browser.runtime.getURL('./newtab.html')}?domain=${
      url?.host
    }`;
    if (hasPermission === false) {
      return (
        <div>
          <Text>
            SALESFORCE DOMAIN: {url?.host}{' '}
            <Button component="a" href={launchUrl} target="_blank" rel="noreferrer">Explore</Button>
            <a href={launchUrl} target="_blank" rel="noreferrer">
              Explore
            </a>
          </Text>
          <Button onClick={onRequestPermission}>
            Give permission to access {url.host}
          </Button>
        </div>
      );
    }

    return (
      <SalesforceContext.Provider value={{ domain: url?.host, onSessionExpired: () => {} }}>
        <Text size="xs">
          SALESFORCE DOMAIN: {url?.host}{' '}
          <Button component="a" href={launchUrl} target="_blank" rel="noreferrer">Explore</Button>
          <p>
            {identityResults?.display_name} ({identityResults?.email})
          </p>
          {hasPermission && cookie && <LoggedIntoSalesforce cookie={cookie} />}
        </Text>
      </SalesforceContext.Provider>
    );
  }

  if (salesforceTabDomains.size > 0) {

  }

  return (
    <div>
      Open a Salesforce tab to explore the org.
    </div>
  );
};

export default App;
