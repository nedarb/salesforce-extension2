import React, {
  FormEventHandler,
  useCallback, useContext, useEffect, useState,
} from 'react';
import browser from 'webextension-polyfill';
import {
  Textarea, LoadingOverlay, Button, Text, Table, Paper,
} from '@mantine/core';
import useCurrentTab from '../hooks/useCurrentTab';
import useBrowserPermission from '../hooks/useBrowserPermission';
import useBrowserCookie from '../hooks/useBrowserCookie';
import useSalesforceQuery, {
  useSalesforceApi,
  useSalesforceQueryExplain,
} from '../hooks/useSalesforceQuery';
import useDebounce from '../hooks/useDebounce';
import urlToSalesforceMyDomain, {
  SalesforceDomains,
} from '../common/SalesforceUtils';
import SalesforceContext from '../contexts/SalesforceContext';
import useLocalStorage from '../hooks/useLocalStorage';
import useAsyncState from '../hooks/useAsyncState';
import QueryResultsTable from '../components/QueryResultsTable';
import SalesforceSession from '../components/SalesforceSession';
import CookieChooser from '../components/CookieChooser';

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

function LoggedIntoSalesforce() {
  const { cookie } = useContext(SalesforceContext);
  const [query, setQuery] = useLocalStorage(`popup_query:${cookie.domain}`, 'SELECT Id, Name, IsActive FROM User LIMIT 10');
  const [debounced] = useDebounce(query, 2000);
  const {
    results: queryExplainResults,
    error: queryExplainError,
    isLoading,
  } = useSalesforceQueryExplain<{ sourceQuery: string }>({
    query: debounced,
    cookie,
  });

  const { results: queryResults, isLoading: isQueryLoading } = useSalesforceQuery<{
    done: boolean;
    totalSize: number;
    records: Array<any>;
  }>({ query: queryExplainResults?.sourceQuery, cookie });

  useEffect(() => {
    console.log(queryExplainResults, queryExplainError);
  }, [queryExplainResults, queryExplainError]);

  const handleChange = (e) => setQuery(e.target.value.trim());

  return (
    <form>
      <LoadingOverlay visible={isLoading || isQueryLoading} />
      <Textarea
        autosize
        value={query}
        onChange={handleChange}
        disabled={isLoading}
      />
      {queryExplainError && (
        <Text color="red">
            {queryExplainError.map((e) => (
              <div key={e.errorCode}>
                {e.errorCode}: {e.message}
              </div>
            ))}
        </Text>
      )}
      {queryResults && !queryExplainError && <QueryResultsTable queryResults={queryResults} cookie={cookie} />}
    </form>
  );
}

function getSalesforceTabs() {
  return browser.tabs.query({ url: 'https://*.lightning.force.com/*' });
}

const App = () => {
  const windowUrl = new URL(window.location.href);
  const [salesforceTabs, isSalesforceTabsLoading] = useAsyncState(getSalesforceTabs);
  const salesforceTabDomains: Set<string | undefined> = new Set(salesforceTabs?.map((t) => t.url)
    .map((url) => (url ? new URL(url) : null))
    .filter((url) => !!url)
    .map((url) => url?.host));
  const [specificCookie, setSpecificCookie] = useState<browser.Cookies.Cookie | undefined>();
  const [currentTab, isCurrentTabLoading] = useCurrentTab('https://*.lightning.force.com/*');
  const currentTabUrl = [urlToSalesforceMyDomain(windowUrl.searchParams.get('domain')) ?? undefined, specificCookie?.domain ? `https://${specificCookie.domain}` : undefined, currentTab?.url, ...salesforceTabs?.map((t) => t.url).filter(Boolean) || []].filter(Boolean)[0];

  const [cookie, isCookieLoading] = useBrowserCookie({
    url: urlToSalesforceMyDomain(currentTabUrl),
    name: 'sid',
  });

  const isLoadingPrimitives = isSalesforceTabsLoading || isCurrentTabLoading || isCookieLoading;

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
    setSpecificCookie(c);
  }, []);

  useEffect(() => {
    console.log('salesforceTabs', salesforceTabDomains, salesforceTabs?.map((t) => ([t.url, t.title])));
  }, [salesforceTabs]);

  if (isLoadingPrimitives) { return null; }

  const url = currentTabUrl?.startsWith('http') ? new URL(currentTabUrl) : null;

  if (url && SalesforceDomains.find((domain) => url?.host.endsWith(domain))) {
    const launchUrl = `${browser.runtime.getURL('./newtab.html')}?domain=${
      url?.host
    }`;

    return (
      <SalesforceSession domain={url.host}>
        <Text size="xs">
          <CookieChooser defaultDomain={url.host} onCookieChosen={handleCookieChosen} />
          <Button component="a" href={launchUrl} target="_blank" rel="noreferrer">Explore</Button>
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
      <CookieChooser onCookieChosen={handleCookieChosen} />
      <Button component="a" href="https://login.salesforce.com" target="_blank" rel="noreferrer">Log back in</Button>
    </Paper>
  );
};

export default App;
