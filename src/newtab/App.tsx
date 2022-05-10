/* eslint-disable implicit-arrow-linebreak */
import React, {
  ChangeEventHandler,
  FormEventHandler,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import browser from 'webextension-polyfill';
import { AppShell, Tabs, Header } from '@mantine/core';
import normalizeSalesforceDomain from '../common/SalesforceUtils';
import useBrowserCookie from '../hooks/useBrowserCookie';
import useBrowserPermission from '../hooks/useBrowserPermission';
import useDebounce from '../hooks/useDebounce';
import useHash from '../hooks/useHash';
import ApiResults from './ApiResults';
import SalesforceContext from '../contexts/SalesforceContext';
import Query from './Query';
import useLocalStorage from '../hooks/useLocalStorage';

const url = new URL(window.location.href);

function LoggedIntoSalesforce({ cookie }: { cookie: browser.Cookies.Cookie }) {
  const [activeTab, setActiveTab] = useLocalStorage<number>('activeTab');
  const defaultUrl = new URLSearchParams(window.location.hash.substring(1)).get(
    'url',
  );
  const { hash, updateHash, hashParams } = useHash();
  const [path, setPath] = useState(
    defaultUrl || '/services/data/v52.0/sobjects',
    // /services/data/v52.0/query?q=SELECT Id, Name, Email, (SELECT Id, Name FROM Opportunities) FROM Contact WHERE Id='0036100000jSX19AAG' LIMIT 100
  );
  const [debounced, immediatelyUpdate] = useDebounce(path);

  useEffect(() => {
    console.log('HASH=', hash, hashParams.get('url'));
    const value = hashParams.get('url');
    if (value) {
      setPath(value);
      immediatelyUpdate(value);
    }
  }, [hash]);

  useEffect(() => {
    updateHash(`url=${debounced}`);
  }, [debounced]);

  const handleChange: ChangeEventHandler<HTMLInputElement> = (e) =>
    setPath(e.target.value.trim());
  const handleSubmit: FormEventHandler<HTMLFormElement> = (e) => {
    e.preventDefault();
    const updatedPath = e.currentTarget.querySelector('input[name="path"]')
      ?.value;
    if (updatedPath) {
      setPath(updatedPath);
      immediatelyUpdate(updatedPath);
    }
  };

  const forcePathUpdate = useCallback(
    (updatedPath) => {
      setPath(updatedPath);
      immediatelyUpdate(updatedPath);
    },
    [path],
  );

  return (
    <Tabs className='tabs' active={activeTab} onTabChange={setActiveTab}>
      <Tabs.Tab label={cookie.domain}>
        <div>
          Logged in to{' '}
          <a href={`https://${cookie.domain}`} target='_blank'>
            {cookie.domain}
          </a>
          <form onSubmit={handleSubmit}>
            <input
              type='text'
              name='path'
              value={path}
              onChange={handleChange}
            />
            <ApiResults
              url={debounced}
              cookie={cookie}
              onUpdateUrl={forcePathUpdate}
            />
          </form>
        </div>
      </Tabs.Tab>
      <Tabs.Tab label='Query'>
        <Query cookie={cookie} />
      </Tabs.Tab>
    </Tabs>
  );
}

const App = () => {
  const domain = normalizeSalesforceDomain(
    url.searchParams.get('domain') ?? undefined,
  );
  const [
    hasPermission,
    onRequestPermission,
    onRemovePermission,
  ] = useBrowserPermission(domain);
  const [sessionExpired, setSessionExpired] = useState(false);

  const cookie = useBrowserCookie({
    url: hasPermission ? domain : undefined,
    name: 'sid',
  });

  const onSessionExpired = useCallback(
    (possibleError?: any) => {
      setSessionExpired(true);
      console.log('session expired', possibleError);
    },
    [domain],
  );

  if (!domain) {
    return (
      <div>
        ERROR! Please{' '}
        <a href='https://login.salesforce.com'>log into Salesforce</a>
      </div>
    );
  }

  if (sessionExpired) {
    return (
      <div className='error'>
        No valid session for{' '}
        <a href={domain} target='_blank'>
          {domain}
        </a>
      </div>
    );
  }

  if (!cookie) {
    return <div className='error'>No cookie for {domain}</div>;
  }

  return (
    <SalesforceContext.Provider value={{ domain, onSessionExpired }}>
      <LoggedIntoSalesforce cookie={cookie} />
    </SalesforceContext.Provider>
  );
};

export default App;
