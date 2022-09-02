/* eslint-disable react/require-default-props */
import { Table, List } from '@mantine/core';
import React, { ReactNode } from 'react';
import browser from 'webextension-polyfill';

interface Props {
    cookie: browser.Cookies.Cookie;
    queryResults: {
        done: boolean;
        totalSize: number;
        records: Array<any>;
      }
}

function Labelize({ label, children }: {label?: string; children: ReactNode}) {
  if (label) {
    return <span className="field">{label}: {children}</span>;
  }

  return <>{children}</>;
}

function RenderObject({ label, value, domain }: {label?: string; value: any; domain: string}) {
  if (value === null || value === undefined) { return null; }
  const type = typeof value;
  if (type === 'string' || type === 'number') {
    if (label === 'Id') {
      const url = `https://${domain}/${value}`;
      return <Labelize label={label}><a href={url} target="_blank" rel="noreferrer">{value}</a></Labelize>;
    }
    return <Labelize label={label}>{value}</Labelize>;
  }
  if (type === 'boolean') {
    return <Labelize label={label}>{value ? 'TRUE' : 'FALSE'}</Labelize>;
  }
  if (Array.isArray(value)) {
    return (
      <div className="array">{label} ({value.length}):
        <List type="ordered" size="xs">
          {value.map((obj, index) => <List.Item key={index.toString()}><RenderObject domain={domain} value={obj} /></List.Item>)}
        </List>
      </div>
    );
  }

  const keys = Object.keys(value).filter((key) => key !== 'attributes');

  if (keys.includes('Id') && keys.includes('Name')) {
    const url = `https://${domain}/${value.Id}`;
    const link = <a href={url} target="_blank" rel="noreferrer">{value.Name}</a>;
    return (
      <Labelize label={label}>
        {link}<br />
        {keys.filter((key) => key !== 'Id' && key !== 'Name').map((key) => {
          const v = value[key];
          return <RenderObject key={key} label={key} value={v} domain={domain} />;
        })}
      </Labelize>
    );
  }

  if (keys.length === 1 && keys[0]) {
    return <span>{value[keys[0]]}</span>;
  }
  return (
    <Labelize label={label}>
      {keys.map((key) => <RenderObject key={key} label={key} value={value[key]} domain={domain} />)}
    </Labelize>
  );
}

const DATETIME_REGEX = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}\+\d{4}/;

function RenderCell({
  name, value, domain, href,
}: { name: string; value: any; domain: string; href?: string }) {
  if (typeof value === 'boolean') {
    return <td>{value ? '✔️' : '☐'}</td>;
  }
  if (value == null) {
    return <td>-</td>;
  }
  if (typeof value === 'object') {
    return <td><RenderObject value={value} domain={domain} /></td>;
  }
  if (href && name === 'Name') {
    return (
      <td>
        <a href={href} target="_blank">{value}</a>
      </td>
    );
  }
  if (typeof value === 'string') {
    // check if it's a datetime
    const isDate = DATETIME_REGEX.test(value);
    if (isDate) {
      return <td className="date">{new Date(value).toLocaleString()}</td>;
    }
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
                <RenderCell key={key} name={key} value={row[key]} href={href} domain={cookie.domain} />
              ))}
              {hasId && !hasName && <td><a href={href} target="_blank">🌐</a></td>}
            </tr>
          );
        })}
      </tbody>
    </Table>
  );
}
