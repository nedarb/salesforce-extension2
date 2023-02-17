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

type OrderBy = {
  fieldName: string;
  direction?: string;
};

export interface Query {
  relationshipNameOrSourceObject: string;
  sourceObject?: string;
  selectedColumns: string[];
  relationshipQueries?: Query[];
  whereConditions?: WhereCondition[];
  limit?: number;
  orderBy?: OrderBy;
  groupBy?: string[];
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

const AggregateFieldRegex = /(\w+)\((\w+(?:\.\w+)*)\)(?:\s+(\w+))?/im;

const AggregateFunctions = [
  'AVG',
  'COUNT',
  'COUNT_DISTINCT',
  'MIN',
  'MAX',
  'SUM',
];

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

const BooleanSelectOptions = [
  {
    value: 'TRUE',
    label: 'True',
  },
  {
    value: 'FALSE',
    label: 'False',
  },
  {
    value: 'NULL',
    label: 'Null',
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

function removeQuotes(value: string | number | undefined) {
  if (typeof value === 'string') {
    const result = /^['"](.+)['"]$/gm.exec(value);
    return result && result.length > 1 ? result[1] : value;
  }
  return value;
}

function stringifyCondition(condition: WhereCondition): string | undefined {
  if (condition.field && condition.operator) {
    const { value } = condition;
    const finalValue = `${value}`;
    if (condition.operator === 'contains') {
      return `${condition.field} LIKE '%${removeQuotes(condition.value)}%'`;
    }
    if (condition.operator === 'starts') {
      return `${condition.field} LIKE '${removeQuotes(condition.value)}%'`;
    }
    if (condition.operator === 'ends') {
      return `${condition.field} LIKE '%${removeQuotes(condition.value)}'`;
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
  const groupBy = query?.groupBy?.length
    ? ` GROUP BY ${query.groupBy?.join(', ')}`
    : '';
  const limit = (query.limit ?? 0) > 0 ? ` LIMIT ${query.limit}` : '';
  const orderBy = query.orderBy?.fieldName
    ? ` ORDER BY ${query.orderBy?.fieldName} ${query.orderBy.direction ?? ''}`
    : '';
  return `SELECT ${cols.join(', ')} FROM ${
    query.relationshipNameOrSourceObject
  } ${condition}${groupBy}${orderBy}${limit}`;
}

interface RenderFieldProps {
  fieldType: string;
  value: string | number | undefined;
  onUpdate: (value: string | number | undefined | null) => void;
}

function renderField({ fieldType, value, onUpdate }: RenderFieldProps) {
  switch (fieldType) {
    case 'double':
      return (
        <NumberInput
          label="Value"
          value={typeof value === 'number' ? value : undefined}
          onChange={onUpdate}
        />
      );
    case 'boolean': {
      const parsedValue = value?.toString() ?? '';
      return (
        <Select
          label="Value"
          value={parsedValue}
          data={BooleanSelectOptions}
          onChange={onUpdate}
        />
      );
    }
    default:
      return (
        <TextInput
          label="Value"
          value={value}
          onChange={(updates) => onUpdate(updates.target.value)}
        />
      );
  }
}

const RenderField = React.memo(renderField);

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
      { id: Math.random().toString() },
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
      return [
        ...new Set(
          draftQuery.selectedColumns
            .map((col) => {
              const [name, extended] = col.split('.');
              return fieldMap.get(name!)?.referenceTo;
            })
            .map((referenceTo) => (referenceTo?.length === 1 ? referenceTo[0] : undefined))
            .filter(Boolean),
        ),
      ];
    }
    return [];
  }, [fieldMap, draftQuery?.selectedColumns]);

  const selectedColumns = draftQuery?.selectedColumns;

  const {
    results: relationshipDescribes,
    isLoading: relationshipDescribesLoading,
  } = useSalesforceApi<{
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

  const parsedSelectedColumns = useMemo(() => {
    return draftQuery?.selectedColumns.map((selectedCol) => {
      const aggregateFieldMatch = AggregateFieldRegex.exec(selectedCol);
      if (aggregateFieldMatch && aggregateFieldMatch.length > 2) {
        const col = aggregateFieldMatch[2]!;
        return {
          type: 'aggregate',
          fn: aggregateFieldMatch[1],
          fullName: selectedCol,
          baseName: col.split('.')[0]!,
        };
      }
      if (selectedCol.includes('.')) {
        return {
          type: 'relationship',
          fullName: selectedCol,
          baseName: selectedCol.split('.')[0]!,
        };
      }
      return { type: 'simple', fullName: selectedCol, baseName: selectedCol };
    });
  }, [draftQuery?.selectedColumns]);

  const possibleColumns = useMemo(() => {
    const selectedRelationships = parsedSelectedColumns
      ?.filter((col) => col.baseName !== col.fullName)
      .map((col) => fieldMap?.get(col.baseName))
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
    const aggregateColumns =
      parsedSelectedColumns
        ?.filter((col) => col.type === 'aggregate')
        .map((col) => ({
          group: 'Aggregate columns',
          value: col.fullName,
          label: col.fullName,
        })) ?? [];
    return [
      ...aggregateColumns,
      ...(currentObjectDescribeResult?.fields.map((o) => ({
        group: `${currentObjectDescribeResult.label} fields`,
        value: o.name,
        label: [
          o.label,
          o.relationshipName ? `(${o.relationshipName})` : o.relationshipName,
        ]
          .filter(Boolean)
          .join(' '),
      })) || []),
      ...groups,
    ];
  }, [
    parsedSelectedColumns,
    fieldMap,
    currentObjectDescribeResult,
    relationshipSObjects,
  ]);

  const aggregateColumns = useMemo(() => {
    if (draftQuery && draftQuery.groupBy?.length) {
      const groupBy = new Set(draftQuery.groupBy);
      return draftQuery.selectedColumns
        .map((col, index) => ({ col, index }))
        .filter(({ col }) => !groupBy.has(col))
        .map(({ col, index }) => ({
          col,
          index,
          matches: AggregateFieldRegex.exec(col) ?? [],
        }));
    }
    return [];
  }, [draftQuery]);

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
          disabled={
            currentObjectDescribeResultLoading || relationshipDescribesLoading
          }
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

      {aggregateColumns.length > 0 &&
        aggregateColumns.map((column) => {
          const { col, index, matches } = column;
          const functionName = matches[1];
          const columnName = matches[2] ?? col;
          return (
            <Grid.Col span={4} key={col}>
              <Select
                searchable
                label={`Aggregate for: ${col}`}
                nothingFound="No results found."
                limit={100}
                disabled={
                  currentObjectDescribeResultLoading ||
                  relationshipDescribesLoading
                }
                value={functionName}
                onChange={(e) => setDraftQuery((existing) => {
                  const { selectedColumns: currentcols } = existing;
                  const copy = [...currentcols];
                  copy[index] = e
                    ? `${functionName}(${columnName})`
                    : columnName;
                  return { ...existing, selectedColumns: copy };
                })}
                data={AggregateFunctions}
              />
            </Grid.Col>
          );
        })}

      <Grid.Col span={4}>
        <MultiSelect
          searchable
          label="Group by"
          placeholder="Group by columns"
          nothingFound="No results found."
          limit={100}
          disabled={
            currentObjectDescribeResultLoading || relationshipDescribesLoading
          }
          value={draftQuery?.groupBy}
          onChange={(e) => setDraftQuery((existing) => ({ ...existing, groupBy: e }))}
          data={possibleColumns}
        />
      </Grid.Col>
      <Grid.Col span={12}>
        {draftQuery?.whereConditions?.map((condition) => {
          const fieldType = fieldMap?.get(condition.field ?? '')?.type;
          const quotes =
            fieldType !== 'double' &&
            fieldType !== 'datetime' &&
            fieldType !== 'boolean' &&
            fieldType !== 'date';
          const currentValue = quotes
            ? removeQuotes(
              typeof condition.value === 'string' ? condition.value : '',
            )
            : condition.value;
          return (
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
                  data={possibleColumns}
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
                <RenderField
                  fieldType={fieldType ?? ''}
                  value={currentValue}
                  onUpdate={(updated) => updateCondition({
                    ...condition,
                    value: quotes ? `'${updated}'` : updated,
                  })}
                />
              </Grid.Col>
              <Grid.Col span={2}>
                <Button onClick={() => removeCondition(condition.id)}>
                  Remove
                </Button>
              </Grid.Col>
            </Grid>
          );
        })}
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
          data={possibleColumns}
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
