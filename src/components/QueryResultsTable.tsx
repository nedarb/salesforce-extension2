/* eslint-disable react/require-default-props */
import { Table } from '@mantine/core';
import React from 'react';
import browser from 'webextension-polyfill';

interface Props {
    cookie: browser.Cookies.Cookie;
    queryResults: {
        done: boolean;
        totalSize: number;
        records: Array<any>;
      }
}

function RenderCell({ name, value, href }: { name: string; value: any; href?: string }) {
  if (typeof value === 'boolean') {
    return <td>{value ? '✔️' : '☐'}</td>;
  }
  if (value == null) {
    return <td>-</td>;
  }
  if (typeof value === 'object') {
    const keys = Object.keys(value).filter((key) => key !== 'attributes');
    return <td>{keys.length === 1 ? value[keys[0] || ''] : keys.map((key) => `${key}: ${value[key]}`).join(', ')}</td>;
  }
  if (href && name === 'Name') {
    return (
      <td>
        <a href={href} target="_blank">{value}</a>
      </td>
    );
  }
  return <td>{value}</td>;
}

export default function QueryResultsTable({ queryResults, cookie }: Props) {
  if (!queryResults || !queryResults.records) return null;
  const keys = Object.keys(
    queryResults.records[0] || {},
  );
  const headerKeys = keys.filter((key) => key !== 'attributes' && key !== 'Id');
  const hasId = keys.includes('Id');
  const hasName = keys.includes('Name');
  return (
    <Table verticalSpacing="xs" fontSize="xs" striped>
      <caption>{queryResults.records.length} results</caption>
      <thead>
        <tr>
          <th> </th>
          {headerKeys.map((key) => (
            <th key={key}>{key}</th>
          ))}
          {hasId && !hasName && <th> </th>}
        </tr>
      </thead>
      <tbody>
        {queryResults.records.map((row, index) => {
          const unique = row.Id || row.attributes?.url || index;
          const href = `https://${cookie.domain}/${row.Id}`;
          return (
            <tr key={unique}>
              <td>{index + 1}</td>
              {headerKeys.map((key) => (
                <RenderCell key={key} name={key} value={row[key]} href={href} />
              ))}
              {hasId && !hasName && <td><a href={href} target="_blank">🌐</a></td>}
            </tr>
          );
        })}
      </tbody>
    </Table>
  );
}
