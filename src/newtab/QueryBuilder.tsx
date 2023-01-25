/* eslint-disable react/require-default-props */
import {
  Button,
  Grid,
  Input,
  MultiSelect,
  NumberInput,
  Paper,
  Select,
  TextInput,
  Title,
} from '@mantine/core';
import React, {
  useMemo, useState, useCallback, useEffect,
} from 'react';

import browser from 'webextension-polyfill';
import useLocalStorage from '../hooks/useLocalStorage';
import { useSalesforceApi } from '../hooks/useSalesforceQuery';

interface Query {
  relationshipNameOrSourceObject: string;
  sourceObject?: string;
  selectedColumns: string[];
  relationshipQueries?: Query[];
  whereConditions?: WhereCondition[];
  limit?: number;
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

const Operators = [
  {
    value: '=',
    label: '=',
  },
  {
    value: '!=',
    label: '≠',
  },
  {
    value: '<',
    label: '<',
  },
  {
    value: '<=',
    label: '≤',
  },
  {
    value: '>',
    label: '>',
  },
  {
    value: '>=',
    label: '≥',
  },
  {
    value: 'starts',
    label: 'starts with',
  },
  {
    value: 'ends',
    label: 'ends with',
  },
  {
    value: 'contains',
    label: 'contains',
  },
  {
    value: 'IN',
    label: 'in',
  },
  {
    value: 'NOT IN',
    label: 'not in',
  },
  {
    value: 'INCLUDES',
    label: 'includes',
  },
  {
    value: 'EXCLUDES',
    label: 'excludes',
  },
];

type WhereCondition = {
  id: string;
  field?: string;
  operator?: string;
  value?: string;
};

type SObjectDescribeField = {
  name: string;
  label: string;
  relationshipName?: string;
  referenceTo?: string[];
};

interface Props {
  cookie: browser.Cookies.Cookie;
  relationshipName?: string;
  specificObject?: string;
  depth?: number;
  defaultQuery?: Query;
  onQueryChanged?: (query: Query) => void;
}

export function stringifyQuery(query?: Query) {
  if (!query) {
    return undefined;
  }
  const relationshipQueries: string[] =
    query?.relationshipQueries?.map(stringifyQuery).map((v) => `(${v})`) ?? [];
  const cols = [...query.selectedColumns, ...(relationshipQueries ?? [])];
  const condition = query?.whereConditions?.length
    ? `WHERE ${query.whereConditions
      .map((c) => `${c.field} ${c.operator} '${c.value}'`)
      .join(' AND ')}`
    : '';
  const limit = (query.limit ?? 0) > 0 ? ` LIMIT ${query.limit}` : '';
  return `SELECT ${cols.join(', ')} FROM ${
    query.relationshipNameOrSourceObject
  } ${condition} ${limit}`;
}

export default function QueryBuilder({
  cookie,
  relationshipName,
  specificObject,
  depth,
  defaultQuery,
  onQueryChanged,
}: Props) {
  const currentDepth = depth ?? 1;
  const {
    results: globalResults,
    isLoading,
    error,
  } = useSalesforceApi<{
    sobjects: { name: string; label: string; queryable: boolean }[];
  }>({
    url: '/services/data/v56.0/sobjects',
    cookie,
    useCache: true,
  });

  const queryableObjects = useMemo(
    () => (globalResults?.sobjects ?? []).filter((o) => o.queryable),
    [globalResults],
  );

  const [draftQuery, setDraftQuery] = relationshipName
    ? useState<Query>(
      () => defaultQuery ?? {
        relationshipNameOrSourceObject:
              relationshipName ?? specificObject ?? '',
        sourceObject: specificObject,
        selectedColumns: [],
      },
    )
    : useLocalStorage<Query>(`draftRichQuery:${cookie.domain}`);

  useEffect(() => {
    console.log('UPDATED QUERY: ', stringifyQuery(draftQuery));
    if (draftQuery && onQueryChanged && relationshipName) {
      onQueryChanged(draftQuery);
    }
  }, [relationshipName, draftQuery]);

  const selectedObjectName =
    specificObject ?? draftQuery?.relationshipNameOrSourceObject;

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
      source !== draftQuery?.relationshipNameOrSourceObject
        ? []
        : draftQuery?.selectedColumns || [];
    setDraftQuery({
      ...draftQuery,
      selectedColumns,
      relationshipNameOrSourceObject: source,
    });
  };
  const setSelectedColumns = (selectedColumns: string[]) => setDraftQuery({
    relationshipNameOrSourceObject: '',
    ...draftQuery,
    selectedColumns,
  });

  const selectedRelationships = useMemo(
    () => draftQuery?.relationshipQueries?.map(
      (q) => q.relationshipNameOrSourceObject,
    ),
    [draftQuery],
  );

  const setSelectedRelationships = (newSelectedRelationships: string[]) => setDraftQuery((existing) => {
    const relationshipQueries: Query[] = newSelectedRelationships.map(
      (sourceName) => existing.relationshipQueries?.find(
        (r) => r.relationshipNameOrSourceObject === sourceName,
      ) ?? {
        relationshipNameOrSourceObject: sourceName,
        sourceObject: currentObjectDescribeResult?.childRelationships.find(
          (r) => r.relationshipName === sourceName,
        )?.childSObject,
        selectedColumns: [],
      },
    );
    return {
      relationshipNameOrSourceObject: '',
      selectedColumns: [],
      ...draftQuery,
      relationshipQueries,
    };
  });

  const addCondition = () => setDraftQuery((existing) => {
    const conditions = existing.whereConditions ?? [];
    const newConditions: WhereCondition[] = [
      ...conditions,
      { id: conditions.length.toString() },
    ];
    return { ...existing, whereConditions: newConditions };
  });

  const removeCondition = (id: string) => setDraftQuery((existing) => {
    const conditions = existing.whereConditions ?? [];
    return {
      ...existing,
      whereConditions: conditions.filter((c) => c.id !== id),
    };
  });

  const updateCondition = (updates: WhereCondition) => setDraftQuery((existing) => {
    const conditions = existing.whereConditions ?? [];
    return {
      ...existing,
      whereConditions: conditions.map((c) => (c.id === updates.id ? updates : { ...c })),
    };
  });

  const setLimit = (updatedLimit?: number) => setDraftQuery((existing) => {
    return { ...existing, limit: updatedLimit };
  });

  const updateRelationshipQuery = (query: Query) => setDraftQuery((existing) => {
    const queries = existing.relationshipQueries ?? [];
    const updated: Query[] = queries.map((q) => (q.relationshipNameOrSourceObject ===
        query.relationshipNameOrSourceObject
      ? query
      : { ...q }));
    return { ...existing, relationshipQueries: updated };
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

  const selectedChildRelationships = useMemo(() => {
    if (fieldMap && draftQuery?.selectedColumns.length) {
      return draftQuery.selectedColumns
        .map((col) => fieldMap.get(col)?.referenceTo)
        .map((referenceTo) => (referenceTo?.length === 1 ? referenceTo[0] : undefined))
        .filter(Boolean);
    }
    return [];
  }, [fieldMap, draftQuery?.selectedColumns]);

  const { results: relationshipDescribes } = useSalesforceApi<{
    hasErrors: boolean;
    results: { result: SObjectDescribeResult; statusCode: number }[];
  }>({
    url:
      selectedChildRelationships.length > 0
        ? '/services/data/v56.0/composite/batch'
        : undefined,
    cookie,
    useCache: false,
    method: 'POST',
    data: {
      batchRequests: selectedChildRelationships.map((sobjectName) => ({
        method: 'GET',
        url: `v56.0/sobjects/${sobjectName}/describe`,
      })),
    },
  });

  console.log('fieldMap', fieldMap, relationshipDescribes);

  const possibleColumns = useMemo(() => {
    return (
      currentObjectDescribeResult?.fields.map((o) => ({
        value: o.name,
        label: o.label,
      })) || []
    );
  }, [currentObjectDescribeResult, selectedChildRelationships]);

  return (
    <div>
      <Grid>
        <Grid.Col span={3}>
          <Select
            label="Select object"
            value={
              draftQuery?.sourceObject ??
              draftQuery?.relationshipNameOrSourceObject
            }
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
            label="Columns"
            placeholder="Select columns"
            nothingFound="No results found."
            limit={100}
            value={draftQuery?.selectedColumns}
            onChange={setSelectedColumns}
            data={possibleColumns}
          />
        </Grid.Col>

        {currentDepth < 3 && (
          <Grid.Col span={3}>
            <MultiSelect
              searchable
              label="Subqueries"
              placeholder="Select any subquery relationships"
              nothingFound="No results found."
              value={selectedRelationships}
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
        )}
        <Grid.Col span={12} ml="xl">
          {draftQuery?.whereConditions?.map((condition) => (
            <Grid key={condition.id}>
              <Grid.Col span={3}>
                <Select
                  searchable
                  label="Selected column"
                  placeholder="Select column"
                  nothingFound="No results found."
                  value={condition.field}
                  onChange={(v) => updateCondition({ ...condition, field: v ?? undefined })}
                  limit={100}
                  data={
                    currentObjectDescribeResult?.fields.map((o) => ({
                      value: o.name,
                      label: o.label,
                    })) || []
                  }
                />
              </Grid.Col>
              <Grid.Col span={2}>
                <Select
                  searchable
                  label="Criteria"
                  placeholder="Criteria"
                  value={condition.operator}
                  data={Operators}
                  onChange={(updates) => updateCondition({
                    ...condition,
                    operator: updates ?? undefined,
                  })}
                />
              </Grid.Col>
              <Grid.Col span={3}>
                <TextInput
                  label="Value"
                  value={condition.value}
                  onChange={(updates) => updateCondition({
                    ...condition,
                    value: updates.target.value,
                  })}
                />
              </Grid.Col>
              <Grid.Col span={2}>
                <Button onClick={() => removeCondition(condition.id)}>
                  Remove
                </Button>
              </Grid.Col>
            </Grid>
          ))}
          <Button onClick={addCondition} mt="md">
            Add condition
          </Button>
        </Grid.Col>
        <Grid.Col span={4} ml="xl">
          <NumberInput
            label="Limit"
            value={draftQuery?.limit}
            onChange={setLimit}
          />
        </Grid.Col>
        {currentObjectDescribeResult?.childRelationships
          .filter((r) => selectedRelationships?.includes(r.relationshipName))
          .map((r) => (
            <Grid.Col span={12} key={r.relationshipName} ml="lg">
              <Title order={5}>Subquery: {r.relationshipName}</Title>
              <QueryBuilder
                cookie={cookie}
                relationshipName={r.relationshipName}
                specificObject={r.childSObject}
                depth={currentDepth + 1}
                defaultQuery={draftQuery?.relationshipQueries?.find(
                  (q) => q.relationshipNameOrSourceObject === r.relationshipName,
                )}
                onQueryChanged={updateRelationshipQuery}
              />
            </Grid.Col>
          ))}
      </Grid>
    </div>
  );
}
