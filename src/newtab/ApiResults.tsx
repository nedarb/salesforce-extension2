import React, {
  ChangeEventHandler,
  useCallback, useEffect, useMemo, useState,
} from 'react';
import browser from 'webextension-polyfill';
import { JSONTree } from 'react-json-tree';
import { LoadingOverlay, Switch } from '@mantine/core';
import { useSalesforceApi } from '../hooks/useSalesforceQuery';
import QueryResultsTable from '../components/QueryResultsTable';
import useLocalStorage from '../hooks/useLocalStorage';

function getItemString(
  nodeType: string,
  data: any,
  itemType: React.ReactNode,
  itemString: string,
  keyPath: (string | number)[],
): React.ReactNode {
  // console.log('getItemString', ...arguments);
  const name =
    data?.id || data?.name || data?.relationshipName || data?.Id || data?.Name;
  return (
    <span className="foobar">
      {name && <span>{name}</span>} {itemType} {itemString}
    </span>
  );
}

function getValueRenderer(onClick?: (path: string) => void) {
  return function valueRenderer(
    valueAsString: any,
    value: any,
    ...keyPath: (string | number)[]
  ): React.ReactNode {
    if (
      keyPath[0] === 'url' ||
      (value && value.startsWith && value.startsWith('/'))
    ) {
      const handleClick = useCallback(
        (e) => {
          e.preventDefault();
          if (onClick) onClick(value as string);
        },
        [value],
      );
      return (
        <a className="nav" href="#" onClick={handleClick}>
          {valueAsString}
        </a>
      );
    }
    return valueAsString;
  };
}

export interface Props {
  url: string;
  cookie: browser.Cookies.Cookie;
  onUpdateUrl?: (updated: string) => void;
}
export default function ApiResults({ url, cookie, onUpdateUrl }: Props) {
  const [showAsTable, setShowAsTable] = useLocalStorage(`query_result:show_as_table:${cookie.domain}`, false);
  const { results, isLoading, error } = useSalesforceApi({
    url,
    cookie,
  });

  const valueRenderer = useMemo(() => {
    return getValueRenderer(onUpdateUrl);
  }, [onUpdateUrl]);

  const handleToggleChange: ChangeEventHandler<HTMLInputElement> = useCallback((ev) => setShowAsTable(ev.target.checked), []);

  useEffect(() => {
    console.log(results);
  }, [results]);

  if (error) {
    return (
      <div>
        ERROR
        <JSONTree data={error} shouldExpandNode={() => true} />
      </div>
    );
  }
  if (isLoading) {
    return <LoadingOverlay visible={isLoading} />;
  }

  return (
    <>
      <Switch label="Show as table" checked={showAsTable} onChange={handleToggleChange} />
      {showAsTable ? <QueryResultsTable queryResults={results} cookie={cookie} /> : (
        <JSONTree
          data={results}
          getItemString={getItemString}
          valueRenderer={valueRenderer}
        />
      )}
    </>
  );
}
