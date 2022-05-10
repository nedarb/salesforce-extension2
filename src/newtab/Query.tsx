/* eslint-disable implicit-arrow-linebreak */
import React, {
  ChangeEventHandler,
  FormEventHandler,
  useCallback,
  useState,
} from 'react';
import browser from 'webextension-polyfill';
import useDebounce from '../hooks/useDebounce';
import useLocalStorage from '../hooks/useLocalStorage';
import ApiResults from './ApiResults';

export default function Query({ cookie }: { cookie: browser.Cookies.Cookie }) {
  const [query, setQuery] = useLocalStorage<string>(
    'currentQuery',
    'SELECT count() from User',
  );
  const [debounced, immediatelyUpdate] = useDebounce(query);

  const handleSubmit: FormEventHandler<HTMLFormElement> = (e) => {
    e.preventDefault();
    const updatedQuery = e.currentTarget.querySelector(
      'input[name="query"]',
    )?.value;
    if (updatedQuery) {
      setQuery(updatedQuery);
      immediatelyUpdate(updatedQuery);
    }
  };

  const forcePathUpdate = useCallback(
    (updatedPath) => {
      setQuery(updatedPath);
      immediatelyUpdate(updatedPath);
    },
    [query],
  );

  const url = `/services/data/v52.0/query?q=${encodeURIComponent(
    debounced ?? '',
  )}`;

  return (
    <form onSubmit={handleSubmit}>
      <input type='text' name='query' value={query} />
      <ApiResults url={url} cookie={cookie} onUpdateUrl={forcePathUpdate} />
    </form>
  );
}
