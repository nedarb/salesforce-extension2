import React, {
  useCallback, useEffect, useMemo, useState,
} from 'react';
import browser from 'webextension-polyfill';
import { JSONTree } from 'react-json-tree';
import { LoadingOverlay } from '@mantine/core';
import { useSalesforceApi } from '../hooks/useSalesforceQuery';

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
  const { results, isLoading, error } = useSalesforceApi({
    url,
    cookie,
  });

  const valueRenderer = useMemo(() => {
    return getValueRenderer(onUpdateUrl);
  }, [onUpdateUrl]);

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
    <JSONTree
      data={results}
      getItemString={getItemString}
      valueRenderer={valueRenderer}
    />
  );
}
