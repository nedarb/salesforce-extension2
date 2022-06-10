import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import browser from 'webextension-polyfill';
import {
  Modal, Autocomplete, Loader, MultiSelect,
} from '@mantine/core';
import { useSalesforceApi } from '../../hooks/useSalesforceQuery';

function extractSObjectName(url: URL) {
  const pathParts = url.pathname.split('/').filter(Boolean);
  if (pathParts[0] === 'lightning') {
    if (pathParts[1] === 'r') {
      return pathParts[2];
    }
  }

  return undefined;
}

const Actions = [{ value: 'update', label: 'Update' }, { value: 'delete', label: 'Delete' }];

function ToDisplay({ cookie, onClose }: {cookie: browser.Cookies.Cookie; onClose: ()=>void}) {
  const url = new URL(window.location.href);
  const sobjectName = extractSObjectName(url);
  const apiUrl = sobjectName ? `/services/data/v50.0/sobjects/${sobjectName}/describe` : undefined;
  const { results, isLoading } = useSalesforceApi<{fields:Array<{name: string;label: string; type: string}>}>({ url: apiUrl, cookie, useCache: true });

  const timeoutRef = useRef<number>(-1);
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<string[]>([]);

  const [value2, setValue2] = useState<Array<string>>([]);

  const handleChange = (val: string) => {
    window.clearTimeout(timeoutRef.current);
    setValue(val);
    setData([]);

    if (val.trim().length === 0 || val.includes('@')) {
      setLoading(false);
    } else {
      setLoading(true);
      timeoutRef.current = window.setTimeout(() => {
        setLoading(false);
        setData(['gmail.com', 'outlook.com', 'yahoo.com'].map((provider) => `${val}@${provider}`));
      }, 1000);
    }
  };

  const options: Array<{value: string; label: string}> = value2[0] === 'update' ? [Actions[0],
    ...(results ? results.fields.map((field) => ({ value: field.name, label: field.label })) || [] : []),
  ] : Actions;

  return (
    <Modal title="Salesforce actions" onClose={onClose} opened overflow="inside">
      HELLO WORLD
      <MultiSelect
        searchable
        value={value2}
        onChange={setValue2}
        data={options}
        label="Your favorite frameworks/libraries"
        placeholder="Pick all that you like"
      />
      <Autocomplete
        data-autofocus
        value={value}
        data={data}
        onChange={handleChange}
        rightSection={loading ? <Loader size={16} /> : null}
        label="Async Autocomplete data"
        placeholder="Your email"
      />
      {JSON.stringify(results)}
    </Modal>
  );
}

function App() {
  const [isShowing, setIsShowing] = useState(false);
  const handleOverlayClick = () => setIsShowing((cur) => !cur);
  const timeoutRef = useRef<number>(-1);
  const inputRef = useRef<HTMLInputElement>();
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<string[]>([]);
  const [cookie, setCookie] = useState<browser.Cookies.Cookie>();
  useSalesforceApi({ url: '/services/data/v50.0/services/' });

  useEffect(() => {
    const listener = (msg: any) => {
      console.log('GOT MESSAGE', msg);
      if (msg?.command === 'toggle-popover') {
        setIsShowing((cur) => !cur);
        setCookie(msg.cookie);
      }
    };
    browser.runtime.onMessage.addListener(listener);
    return () => browser.runtime.onMessage.removeListener(listener);
  }, []);

  const handleChange = (val: string) => {
    window.clearTimeout(timeoutRef.current);
    setValue(val);
    setData([]);

    if (val.trim().length === 0 || val.includes('@')) {
      setLoading(false);
    } else {
      setLoading(true);
      timeoutRef.current = window.setTimeout(() => {
        setLoading(false);
        setData(['gmail.com', 'outlook.com', 'yahoo.com'].map((provider) => `${val}@${provider}`));
      }, 1000);
    }
  };

  if (!isShowing || !cookie) { return null; }

  return <ToDisplay cookie={cookie} onClose={handleOverlayClick} />;
  // return (
  //   <Modal title="Salesforce actions" onClose={handleOverlayClick} opened={isShowing}>
  //     HELLO WORLD
  //     <Autocomplete
  //       ref={inputRef as any}
  //       autoFocus
  //       value={value}
  //       data={data}
  //       onChange={handleChange}
  //       rightSection={loading ? <Loader size={16} /> : null}
  //       label="Async Autocomplete data"
  //       placeholder="Your email"
  //     />
  //   </Modal>
  // );
}

const el = document.createElement('div');
el.id = 'sf-extension';
document.body.appendChild(el);

ReactDOM.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  el,
);

console.log('FOOBAR!');

export {}; // stops ts error that the file isn't a module
