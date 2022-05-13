/* eslint-disable implicit-arrow-linebreak */
import {
  Grid, Group, Switch, TextInput,
} from '@mantine/core';
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
  const [showAsTable, setShowAsTable] = useLocalStorage(`query_result:show_as_table:${cookie.domain}`, false);
  const [query, setQuery] = useLocalStorage<string>(
    `currentQuery:${cookie.domain}`,
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

  const handleToggleChange: ChangeEventHandler<HTMLInputElement> = useCallback((ev) => setShowAsTable(ev.target.checked), []);

  const url = `/services/data/v52.0/query?q=${encodeURIComponent(
    debounced ?? '',
  )}`;

  return (
    <form onSubmit={handleSubmit}>
      <Grid>
        <Grid.Col span={9}>
          <TextInput type="text" name="query" defaultValue={query} />
        </Grid.Col>
        <Grid.Col span={3}>
          <Switch label="Show as table" checked={showAsTable} onChange={handleToggleChange} />
        </Grid.Col>
      </Grid>
      <ApiResults url={url} cookie={cookie} onUpdateUrl={forcePathUpdate} showAsTable={showAsTable} />
    </form>
  );
}
