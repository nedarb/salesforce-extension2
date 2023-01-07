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

  const {
    results: globalResults,
    isLoading,
    error,
  } = useSalesforceApi<{
    sobjects: { name: string; label: string; queryable: boolean }[];
  }>({
    url: '/services/data/v52.0/sobjects',
    cookie,
    useCache: true,
  });

  const queryableObjects = useMemo(
    () => (globalResults?.sobjects ?? []).filter((o) => o.queryable),
    [globalResults],
  );

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

  const setSourceObject = (source: string) => {
    const selectedColumns =
      source !== draftQuery?.source ? [] : draftQuery?.selectedColumns || [];
    setDraftQuery({ ...draftQuery, selectedColumns, source });
  };
  const setSelectedColumns = (selectedColumns: string[]) =>
    setDraftQuery({ source: '', ...draftQuery, selectedColumns });

  return (
    <form onSubmit={handleSubmit}>
      <Grid>
        <Grid.Col span={3}>
          <Select
            label="Source object"
            value={draftQuery?.source}
            onChange={setSourceObject}
            searchable
            limit={100}
            placeholder="Select object"
            nothingFound="No results found."
            data={
              queryableObjects.map((o) => ({
                value: o.name,
                label: o.label,
              })) || []
            }
          />
        </Grid.Col>
        <Grid.Col span={3}>
          <MultiSelect
            searchable
            label="Selected columns"
            placeholder="Select columns"
            nothingFound="No results found."
            limit={100}
            value={draftQuery?.selectedColumns}
            onChange={setSelectedColumns}
            data={
              currentObjectDescribeResult?.fields.map((o) => ({
                value: o.name,
                label: o.label,
              })) || []
            }
          />
        </Grid.Col>
        <Grid.Col span={12}>
          {selectedFields
            .filter((field) => field.relationshipName)
            .map((field) => {
              const unionedFields = (
                field.referenceTo?.map(
                  (obj) => relationshipDescribesMap?.[obj],
                ) || []
              ).reduce<Map<string, SObjectDescribeField>>(
                (map, describeResult) => {
                  if (describeResult) {
                    for (const f of describeResult.fields) {
                      map.set(f.name, f);
                    }
                  }
                  return map;
                },
                new Map(),
              );

              console.log(unionedFields);
              return (
                <Paper key={field.name} shadow="xs" p="md" m="xs" withBorder>
                  <MultiSelect
                    label={`Select relationship: ${field.relationshipName}`}
                    data={[...unionedFields.values()].map((f) => ({
                      value: f.name,
                      label: f.label,
                    }))}
                  />
                </Paper>
              );
            })}
        </Grid.Col>
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
