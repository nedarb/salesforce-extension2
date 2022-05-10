import React, { useEffect, useState } from 'react';
import browser from 'webextension-polyfill';
import {
  Paper, LoadingOverlay, Button, Text, Table,
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

interface SalesforceApiIdentity {
  display_name: string;
  email: string;
}

function RenderCell({ name, value }: { name: string; value: any }) {
  if (typeof value === 'boolean') {
    return <td>{value ? '✔️' : '☐'}</td>;
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
        <input
          type="text"
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
          {queryResults &&
            (() => {
              const keys = Object.keys(
                queryResults.records[0] || {},
              );
              const headerKeys = keys.filter((key) => key !== 'attributes' && key !== 'Id');
              const hasId = keys.includes('Id');
              const hasName = keys.includes('Name');
              return (
                <Table verticalSpacing="xs" fontSize="xs" striped>
                  <caption>{queryResults.records.length} results</caption>
                  <thead>
                    <tr>
                      <th> </th>
                      {headerKeys.map((key) => (
                        <th key={key}>{key}</th>
                      ))}
                      {hasId && <th> </th>}
                    </tr>
                  </thead>
                  {queryResults.records.map((row, index) => {
                    const unique = row.Id || row.attributes?.url || index;
                    return (
                      <tr key={unique}>
                        <td>{index + 1}</td>
                        {headerKeys.map((key) => (
                          <RenderCell key={key} name={key} value={row[key]} />
                        ))}
                        {hasId && <td><a href={`https://${cookie.domain}/${row.Id}`} target="_blank">🌐</a></td>}
                      </tr>
                    );
                  })}
                </Table>
              );
            })()}
        </p>
      </form>
    </div>
  );
}

const windowUrl = new URL(window.location.href);

const App = () => {
  const currentTab = useCurrentTab();
  const currentTabUrl =
    currentTab?.url ||
    (() => {
      const domain = windowUrl.searchParams.get('domain');
      return domain ? `https://${domain}/` : undefined;
    })();
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
        <div>
          SALESFORCE DOMAIN: {url?.host}{' '}
          <a href={launchUrl} target="_blank" rel="noreferrer">
            Explore
          </a>
          <p>
            {identityResults?.display_name} ({identityResults?.email})
          </p>
          {hasPermission && cookie && <LoggedIntoSalesforce cookie={cookie} />}
        </div>
      </SalesforceContext.Provider>
    );
  }

  return (
    <div>
      Open a Salesforce tab to explore the org.
    </div>
  );
};

export default App;
