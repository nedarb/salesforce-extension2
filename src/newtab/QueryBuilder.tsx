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

export interface Query {
  relationshipNameOrSourceObject: string;
  sourceObject?: string;
  selectedColumns: string[];
  relationshipQueries?: Query[];
  whereConditions?: WhereCondition[];
  limit?: number;
  orderBy?: {
    fieldName: string;
    direction?: string;
  };
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
  value?: string | number;
};

type SObjectDescribeField = {
  name: string;
  label: string;
  relationshipName?: string;
  referenceTo?: string[];
  type: string;
};

interface Props {
  cookie: browser.Cookies.Cookie;
  relationshipName?: string;
  specificObject?: string;
  depth?: number;
  defaultQuery?: Query;
  onQueryChanged?: (query: Query) => void;
}

function stringifyCondition(condition: WhereCondition): string | undefined {
  if (condition.field && condition.operator) {
    const { value } = condition;
    const finalValue = typeof value === 'number' ? `${value}` : `'${value}'`;
    if (condition.operator === 'contains') {
      return `${condition.field} LIKE '%${condition.value}%'`;
    }
    return `${condition.field} ${condition.operator} ${finalValue}`;
  }
  return undefined;
}

export function stringifyQuery(query: Query): string;
export function stringifyQuery(query?: Query): string | undefined;
export function stringifyQuery(query?: Query) {
  if (!query || query.selectedColumns.length === 0) {
    return undefined;
  }
  const relationshipQueries: string[] =
    query?.relationshipQueries
      ?.map(stringifyQuery)
      .filter(Boolean)
      .map((v) => `(${v})`) ?? [];
  const cols = [...query.selectedColumns, ...(relationshipQueries ?? [])];
  const condition = query?.whereConditions?.length
    ? `WHERE ${query.whereConditions
      .map(stringifyCondition)
      .filter(Boolean)
      .join(' AND ')}`
    : '';
  const limit = (query.limit ?? 0) > 0 ? ` LIMIT ${query.limit}` : '';
  const orderBy = query.orderBy?.fieldName
    ? ` ORDER BY ${query.orderBy?.fieldName} ${query.orderBy.direction ?? ''}`
    : '';
  return `SELECT ${cols.join(', ')} FROM ${
    query.relationshipNameOrSourceObject
  } ${condition}${orderBy}${limit}`;
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
    isLoading: queryableObjectsLoading,
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
    if (draftQuery && onQueryChanged) {
      onQueryChanged(draftQuery);
    }
  }, [draftQuery]);

  const selectedObjectName =
    specificObject ?? draftQuery?.relationshipNameOrSourceObject;

  const {
    results: currentObjectDescribeResult,
    isLoading: currentObjectDescribeResultLoading,
  } = useSalesforceApi<SObjectDescribeResult>({
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
      relationshipQueries: [],
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
        if (field.relationshipName) {
          map.set(field.relationshipName, field);
        }
        return map;
      }, new Map<string, SObjectDescribeField>())
      : undefined),
    [currentObjectDescribeResult],
  );

  const selectedChildRelationships = useMemo(() => {
    if (fieldMap && draftQuery?.selectedColumns.length) {
      return [...new Set(draftQuery.selectedColumns
        .map((col) => {
          const [name, extended] = col.split('.');
          return fieldMap.get(name!)?.referenceTo;
        })
        .map((referenceTo) => (referenceTo?.length === 1 ? referenceTo[0] : undefined))
        .filter(Boolean))];
    }
    return [];
  }, [fieldMap, draftQuery?.selectedColumns]);

  console.debug('selectedChildRelationships', selectedChildRelationships);

  const selectedColumns = draftQuery?.selectedColumns;

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
      batchRequests: [...new Set(selectedChildRelationships)].map(
        (sobjectName) => ({
          method: 'GET',
          url: `v56.0/sobjects/${sobjectName}/describe`,
        }),
      ),
    },
  });
  const relationshipSObjects = useMemo(() => {
    return relationshipDescribes?.results.reduce((map, sobject) => {
      map.set(sobject.result.name, sobject.result);
      return map;
    }, new Map<string, SObjectDescribeResult>());
  }, [relationshipDescribes]);

  console.log(
    'fieldMap',
    fieldMap,
    relationshipDescribes,
    selectedChildRelationships,
  );

  const possibleColumns = useMemo(() => {
    const selectedRelationships = selectedColumns
      ?.map((col) => {
        const [name, extended] = col.split('.');
        return fieldMap?.get(name!);
      })
      .map((field) => (field?.relationshipName && field.referenceTo?.[0]
        ? {
          field,
          relationship: relationshipSObjects?.get(field.referenceTo[0]),
        }
        : undefined))
      .filter((arr) => !!arr)
      .map((obj) => {
        const { field, relationship } = obj!;
        return { field, relationship };
      });
    console.log(
      'selectedRelationships',
      selectedRelationships,
      relationshipSObjects,
    );
    const groups =
      selectedRelationships
        ?.flatMap((obj) => {
          if (obj) {
            return obj.relationship?.fields.map((o) => ({
              value: `${obj.field.relationshipName}.${o.name}`,
              label: `${obj.field.label} - ${o.label}`,
              group: `${obj.field.label} fields`,
            }));
          }
          return [];
        })
        .filter(Boolean) ?? [];
    console.debug('groups', groups);
    return [
      ...(currentObjectDescribeResult?.fields.map((o) => ({
        group: `${currentObjectDescribeResult.label} fields`,
        value: o.name,
        label: o.label,
      })) || []),
      ...groups,
    ];
  }, [
    selectedColumns,
    fieldMap,
    currentObjectDescribeResult,
    relationshipSObjects,
  ]);

  return (
    <Grid>
      <Grid.Col span={4}>
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
          disabled={!!specificObject || queryableObjectsLoading}
          data={
            queryableObjects.map((o) => ({
              value: o.name,
              label: `${o.label} (${o.name})`,
            })) || []
          }
        />
      </Grid.Col>
      <Grid.Col span={4}>
        <MultiSelect
          searchable
          label="Columns"
          placeholder="Select columns"
          nothingFound="No results found."
          limit={100}
          disabled={currentObjectDescribeResultLoading}
          value={selectedColumns}
          onChange={setSelectedColumns}
          data={possibleColumns}
        />
      </Grid.Col>

      {currentDepth < 3 && (
        <Grid.Col span={4}>
          <MultiSelect
            searchable
            label="Subqueries"
            placeholder="Select any subquery relationships"
            nothingFound="No results found."
            disabled={currentObjectDescribeResultLoading}
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
      <Grid.Col span={12}>
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
              {fieldMap?.get(condition.field ?? '')?.type === 'double' ? (
                <NumberInput
                  label="Value"
                  value={
                    typeof condition.value === 'number'
                      ? condition.value
                      : undefined
                  }
                  onChange={(updates) => updateCondition({
                    ...condition,
                    value: updates,
                  })}
                />
              ) : (
                <TextInput
                  label="Value"
                  value={condition.value}
                  onChange={(updates) => updateCondition({
                    ...condition,
                    value: updates.target.value,
                  })}
                />
              )}
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
      <Grid.Col span={4}>
        <NumberInput
          label="Limit"
          value={draftQuery?.limit}
          onChange={setLimit}
        />
      </Grid.Col>
      <Grid.Col span={4}>
        <Select
          searchable
          label="Order by"
          placeholder="Order by"
          nothingFound="No results found."
          value={draftQuery?.orderBy?.fieldName}
          onChange={(v) => setDraftQuery((existing) => ({
            ...existing,
            orderBy: { ...existing.orderBy, fieldName: v ?? '' },
          }))}
          limit={100}
          data={
            currentObjectDescribeResult?.fields.map((o) => ({
              value: o.name,
              label: o.label,
            })) || []
          }
        />
      </Grid.Col>
      <Grid.Col span={4}>
        <Select
          label="Order direction"
          value={draftQuery?.orderBy?.direction}
          onChange={(v) => setDraftQuery((existing) => ({
            ...existing,
            orderBy: { ...existing.orderBy, direction: v },
          }))}
          limit={100}
          data={[{ value: '', label: '-' }, 'ASC', 'DESC']}
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
  );
}
