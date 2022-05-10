import React, { useEffect, useState } from 'react';
import browser from 'webextension-polyfill';
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
  const [query, setQuery] = useState(
    'SELECT Id, Name, IsActive FROM User LIMIT 10',
  );
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
        <input
          type='text'
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
              const headerKeys = Object.keys(
                queryResults.records[0] || {},
              ).filter((key) => key !== 'attributes');
              return (
                <div>
                  Results ({queryResults.totalSize})
                  <table>
                    <thead>
                      <tr>
                        <th> </th>
                        {headerKeys.map((key) => (
                          <th key={key}>{key}</th>
                        ))}
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
                        </tr>
                      );
                    })}
                  </table>
                </div>
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

  const { results: queryResults, isLoading } = useSalesforceQuery<{
    done: boolean;
    totalSize: number;
  }>({
    query: 'SELECT count() FROM Contact',
    cookie,
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

  if (SalesforceDomains.find((domain) => url?.host.endsWith(domain))) {
    const launchUrl = `${browser.runtime.getURL('./newtab.html')}?domain=${
      url?.host
    }`;
    return (
      <div>
        SALESFORCE DOMAIN: {url?.host}{' '}
        <a href={launchUrl} target='_blank'>
          Explore
        </a>
        <p>
          {identityResults?.display_name} ({identityResults?.email})
        </p>
        {hasPermission && cookie && <LoggedIntoSalesforce cookie={cookie} />}
        <p>
          {isLoading ? (
            'querying...'
          ) : (
            <span>Total contacts: {queryResults?.totalSize}</span>
          )}
        </p>
        <p>
          {hasPermission === false && (
            <button type='button' onClick={onRequestPermission}>
              Request
            </button>
          )}
        </p>
      </div>
    );
  }

  return (
    <div>
      Get started at './src/popup/App.tsx'
      {currentTab != null ? 'has tab' : 'no tab'}
      {JSON.stringify(hasPermission)}
      {JSON.stringify(currentTab)}
      {hasPermission === false && (
        <button type='button' onClick={onRequestPermission}>
          Request
        </button>
      )}
    </div>
  );
};

export default App;
