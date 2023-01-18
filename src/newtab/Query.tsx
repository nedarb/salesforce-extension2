// SELECT Id, sfLma__Org_Instance__c from sfLma__License__c LIMIT 10
/* eslint-disable implicit-arrow-linebreak */
import {
  Autocomplete,
  Grid,
  Group,
  MultiSelect,
  Paper,
  Select,
  Switch,
  TextInput,
} from '@mantine/core';
import React, {
  ChangeEventHandler,
  FormEventHandler,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import browser from 'webextension-polyfill';
import useDebounce from '../hooks/useDebounce';
import useLocalStorage from '../hooks/useLocalStorage';
import { useSalesforceApi } from '../hooks/useSalesforceQuery';
import ApiResults from './ApiResults';
import QueryBuilder from './QueryBuilder';

const QueryFieldName = 'query';

type SObjectDescribeField = {
  name: string;
  label: string;
  relationshipName?: string;
  referenceTo?: string[];
};

type SObjectDescribeResult = {
  name: string;
  label: string;
  fields: SObjectDescribeField[];
};

interface Query {
  source: string;
  selectedColumns: string[];
}

export default function Query({ cookie }: { cookie: browser.Cookies.Cookie }) {
  const [recentQueries, setRecentQueries] = useLocalStorage<Array<string>>(
    `recentQueries:${cookie.domain}`,
    [],
  );
  const [showAsTable, setShowAsTable] = useLocalStorage(
    `query_result:show_as_table:${cookie.domain}`,
    false,
  );

  const [draftQuery, setDraftQuery] = useLocalStorage<Query>(
    `draftQuery:${cookie.domain}`,
  );

  const selectedObjectName = draftQuery?.source;

  const [query, setQuery] = useLocalStorage<string>(
    `currentQuery:${cookie.domain}`,
    'SELECT count() from User',
  );
  const [debounced, immediatelyUpdate] = useDebounce(query);

  const { results: currentObjectDescribeResult } =
    useSalesforceApi<SObjectDescribeResult>({
      url: selectedObjectName
        ? `/services/data/v52.0/sobjects/${selectedObjectName}/describe`
        : undefined,
      cookie,
      useCache: true,
    });

  console.log('selectedObjectDescribeResult', currentObjectDescribeResult);

  const selectedFields =
    draftQuery?.selectedColumns.length &&
    currentObjectDescribeResult?.name === draftQuery.source
      ? currentObjectDescribeResult.fields.filter((field) =>
        draftQuery.selectedColumns.includes(field.name))
      : [];

  console.log('selected', currentObjectDescribeResult, selectedFields);

  const otherSObjectsToDescribe: string[] = useMemo(
    () =>
      Array.from(
        currentObjectDescribeResult && draftQuery?.selectedColumns.length
          ? new Set(
            currentObjectDescribeResult.fields
              .filter(
                (field) =>
                  draftQuery.selectedColumns.includes(field.name) &&
                    field.relationshipName,
              )
              .flatMap((field) => field.referenceTo!),
          )
          : new Set<string>(),
      ),
    [currentObjectDescribeResult, draftQuery?.selectedColumns],
  );

  const { results: relationshipDescribes } = useSalesforceApi<{
    hasErrors: boolean;
    results: { result: SObjectDescribeResult; statusCode: number }[];
  }>({
    url:
      otherSObjectsToDescribe.length > 0
        ? '/services/data/v56.0/composite/batch'
        : undefined,
    cookie,
    useCache: false,
    method: 'POST',
    data: {
      batchRequests: otherSObjectsToDescribe.map((sobjectName) => ({
        method: 'GET',
        url: `v56.0/sobjects/${sobjectName}/describe`,
      })),
    },
  });

  const relationshipDescribesMap =
    otherSObjectsToDescribe.length && relationshipDescribes
      ? otherSObjectsToDescribe.reduce<
          Record<string, SObjectDescribeResult | undefined>
        >((map, name, index) => {
          return {
            ...map,
            [name]: relationshipDescribes.results[index]?.result,
          };
        }, {})
      : undefined;

  console.log('r', relationshipDescribesMap);

  const handleSubmit: FormEventHandler<HTMLFormElement> = (e) => {
    e.preventDefault();
    const updatedQuery = e.currentTarget.querySelector(
      `input[name="${QueryFieldName}"]`,
    )?.value;
    if (updatedQuery) {
      setQuery(updatedQuery);
      immediatelyUpdate(updatedQuery);
    }
  };

  const handleKeyUp: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (e.key === 'Enter') {
      const { value } = e.target as HTMLInputElement;
      setQuery(value);
      immediatelyUpdate(value);
    }
  };

  const forcePathUpdate = useCallback(
    (updatedPath) => {
      setQuery(updatedPath);
      immediatelyUpdate(updatedPath);
    },
    [query],
  );

  const handleToggleChange: ChangeEventHandler<HTMLInputElement> = useCallback(
    (ev) => setShowAsTable(ev.target.checked),
    [],
  );

  const url = `/services/data/v52.0/query?q=${encodeURIComponent(
    debounced ?? '',
  )}`;

  const handleSuccessfulQuery = useCallback(
    (urlUsed: string) => {
      const u = new URL(urlUsed, `https://${cookie.domain}`);
      const actualQuery = u.searchParams.get('q');

      if (actualQuery) {
        // save query in recently used queries
        const newList = [...new Set(recentQueries)];
        newList.push(actualQuery);
        setRecentQueries(newList);
      }
    },
    [url, recentQueries],
  );

  const queryOptions: Array<string> = [...new Set(recentQueries || [])];

  return (
    <form onSubmit={handleSubmit}>
      <QueryBuilder cookie={cookie} />
      <Grid>
        <Grid.Col span={9}>
          <Autocomplete
            name={QueryFieldName}
            defaultValue={query}
            limit={20}
            placeholder="SELECT Id, Name FROM User"
            label="Query"
            required
            data={queryOptions}
            onKeyUp={handleKeyUp}
            onItemSubmit={(item) => {
              setQuery(item.value);
              immediatelyUpdate(item.value);
            }}
          />
        </Grid.Col>
        <Grid.Col span={3}>
          <Switch
            label="Show as table"
            checked={showAsTable}
            onChange={handleToggleChange}
          />
        </Grid.Col>
      </Grid>
      <ApiResults
        url={url}
        cookie={cookie}
        onUpdateUrl={forcePathUpdate}
        showAsTable={showAsTable}
        onSuccessfulQuery={handleSuccessfulQuery}
      />
    </form>
  );
}
