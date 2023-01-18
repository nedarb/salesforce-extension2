import {
  Grid, MultiSelect, Paper, Select,
} from '@mantine/core';
import React, { useMemo, useState } from 'react';
import browser from 'webextension-polyfill';
import useLocalStorage from '../hooks/useLocalStorage';
import { useSalesforceApi } from '../hooks/useSalesforceQuery';

interface Query {
  source: string;
  selectedColumns: string[];
  relationships?: string[];
}

type SObjectDescribeResult = {
  name: string;
  label: string;
  fields: SObjectDescribeField[];
  childRelationships: {
    cascadeDelete: boolean;
    childSObject: string;
    deprecatedAndHidden: boolean;
    field: string;
    relationshipName: string;
    restrictedDelete: boolean;
  }[];
};
type SObjectDescribeField = {
  name: string;
  label: string;
  relationshipName?: string;
  referenceTo?: string[];
};

export default function QueryBuilder({
  cookie,
  relationshipName,
  specificObject,
}: {
  cookie: browser.Cookies.Cookie;
  relationshipName?: string;
  specificObject?: string;
}) {
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

  const [draftQuery, setDraftQuery] = relationshipName
    ? useState<Query>(() => (specificObject ? { source: specificObject } : undefined))
    : useLocalStorage<Query>(`draftQuery:${cookie.domain}`);

  const selectedObjectName = specificObject ?? draftQuery?.source;

  const { results: currentObjectDescribeResult } =
    useSalesforceApi<SObjectDescribeResult>({
      url: selectedObjectName
        ? `/services/data/v52.0/sobjects/${selectedObjectName}/describe`
        : undefined,
      cookie,
      useCache: true,
    });
  console.debug(
    `currentObjectDescribeResult${specificObject}`,
    currentObjectDescribeResult,
  );

  const setSourceObject = (source: string) => {
    const selectedColumns =
      source !== draftQuery?.source ? [] : draftQuery?.selectedColumns || [];
    setDraftQuery({
      ...draftQuery,
      selectedColumns,
      source,
      relationships: [],
    });
  };
  const setSelectedColumns = (selectedColumns: string[]) => setDraftQuery({
    source: '',
    relationships: [],
    ...draftQuery,
    selectedColumns,
  });

  const setSelectedRelationships = (selectedRelationships: string[]) => setDraftQuery({
    source: '',
    selectedColumns: [],
    ...draftQuery,
    relationships: selectedRelationships,
  });

  const fieldMap = useMemo(
    () => (currentObjectDescribeResult
      ? currentObjectDescribeResult.fields.reduce((map, field) => {
        map.set(field.name, field);
        return map;
      }, new Map<string, SObjectDescribeField>())
      : undefined),
    [currentObjectDescribeResult],
  );

  console.log('fieldMap', fieldMap);

  return (
    <div>
      Query Builder
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
            disabled={!!specificObject}
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

        <Grid.Col span={3}>
          <MultiSelect
            searchable
            label="Selected relationships"
            placeholder="Select relationships"
            nothingFound="No results found."
            value={draftQuery?.relationships}
            onChange={setSelectedRelationships}
            limit={100}
            data={
              currentObjectDescribeResult?.childRelationships
                .filter((r) => r.relationshipName)
                .map((o) => ({
                  value: o.relationshipName,
                  label: o.relationshipName,
                })) || []
            }
          />
        </Grid.Col>
        {currentObjectDescribeResult?.childRelationships
          .filter((r) => draftQuery?.relationships?.includes(r.relationshipName))
          .map((r) => (
            <Grid.Col span={12} key={r.relationshipName} ml="lg">
              {r.relationshipName}
              <QueryBuilder
                cookie={cookie}
                relationshipName={r.relationshipName}
                specificObject={r.childSObject}
              />
            </Grid.Col>
          ))}
      </Grid>
    </div>
  );
}
