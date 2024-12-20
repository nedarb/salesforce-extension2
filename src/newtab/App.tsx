/* eslint-disable implicit-arrow-linebreak */
import React, {
  ChangeEventHandler,
  FormEventHandler,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import {
  Paper, Tabs, Button, Text,
} from '@mantine/core';
import urlToSalesforceMyDomain from '../common/SalesforceUtils';
import useDebounce from '../hooks/useDebounce';
import useHash from '../hooks/useHash';
import ApiResults from './ApiResults';
import Query from './Query';
import useLocalStorage from '../hooks/useLocalStorage';
import SalesforceSession from '../components/SalesforceSession';
import SalesforceContext from '../contexts/SalesforceContext';

const url = new URL(window.location.href);

function LoggedIntoSalesforce() {
  const { cookie } = useContext(SalesforceContext);
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
    setPath(e.target.value);
  const handleSubmit: FormEventHandler<HTMLFormElement> = (e) => {
    e.preventDefault();
    const updatedPath =
      e.currentTarget.querySelector('input[name="path"]')?.value;
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
    <Tabs className="tabs" value={activeTab} onTabChange={setActiveTab}>
      <Tabs.List>
        <Tabs.Tab value="explorer">{cookie.domain}</Tabs.Tab>
        <Tabs.Tab value="query">Query</Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel value="explorer">
        <div>
          Logged in to{' '}
          <a href={`https://${cookie.domain}`} target="_blank">
            {cookie.domain}
          </a>
          <form onSubmit={handleSubmit}>
            <input
              type="text"
              name="path"
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
      </Tabs.Panel>
      <Tabs.Panel value="query">
        <Query cookie={cookie} />
      </Tabs.Panel>
    </Tabs>
  );
}

const App = () => {
  const domain = urlToSalesforceMyDomain(
    url.searchParams.get('domain') ?? undefined,
  );

  if (!domain) {
    return (
      <Paper shadow="xs" p="md">
        <Text>Please log into a Salesforce org!</Text>
        <Button
          component="a"
          href="https://login.salesforce.com"
          target="_blank"
          rel="noreferrer"
        >
          Log in
        </Button>
      </Paper>
    );
  }

  const titleEl = document.head.querySelector('title');
  if (titleEl) {
    const { host } = new URL(domain);
    titleEl.innerText = `Explore org: ${host}`;
  }

  return (
    <SalesforceSession domain={domain}>
      <LoggedIntoSalesforce />
    </SalesforceSession>
  );
};

export default App;
