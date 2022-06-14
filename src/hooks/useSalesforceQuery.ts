/* eslint-disable no-restricted-syntax */
import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import browser from 'webextension-polyfill';
import SalesforceContext from '../contexts/SalesforceContext';

type HttpMethod = 'GET' | 'PATCH' | 'POST';

const uuid = () =>
  '00000000-0000-4000-8000-000000000000'.replace(/0/g, function () {
    return (0 | (Math.random() * 16)).toString(16);
  });

interface BaseParams {
  cookie?: browser.Cookies.Cookie;
  useCache?: boolean;
}
interface Params extends BaseParams {
  query?: string;
}

export interface Results<T> {
  results?: T;
  error?: any;
  isLoading: boolean;
}

export interface QueryResults<T> {
  done: boolean;
  totalSize: number;
  records: Array<T>;
}

interface AbortablePromise<T = any> {
  controller: AbortController;
  promise: Promise<T>;
}

export function makeApiCall<T = any>({
  url,
  cookie,
  useCache,
  method = 'GET',
  data,
}: {
  url: string;
  method?: HttpMethod;
  data?: any;
} & BaseParams): AbortablePromise<T> {
  if (!cookie) {
    throw new Error('Must have a cookie!');
  }

  const controller = new AbortController();
  const { signal } = controller;
  const finalUrl = url.startsWith('https:')
    ? url
    : new URL(url, `https://${cookie.domain}`);

  const cacheKey = `apiResult:${url.toString()}`;
  if (useCache) {
    const fromStorage = localStorage.getItem(cacheKey);
    if (fromStorage) {
      return JSON.parse(fromStorage);
    }
  }

  const promise = fetch(finalUrl.toString(), {
    method,
    headers: {
      Authorization: `Bearer ${cookie.value}`,
      'Content-Type': 'application/json',
    },
    body: data ? JSON.stringify(data) : undefined,
    signal,
  })
    .then(async (result) => {
      if (result.ok) {
        if (result.status === 204) {
          return [];
        }
        return [await result.json()];
      }
      return [undefined, await result.json()];
    })
    .then(([result, err]) => {
      if (err) {
        if (Array.isArray(err) && err[0]?.errorCode === 'INVALID_SESSION_ID') {
          return Promise.reject(err[0]);
        }
        return Promise.reject(err);
      }

      // cache results
      if (useCache) {
        localStorage.setItem(cacheKey, JSON.stringify(result));
      }
      return Promise.resolve(result);
    });

  return { promise, controller };
}

export type ApiCaller<T = any> = (
  url: string,
  method?: HttpMethod,
  data?: any,
) => Promise<T>;
export type QueryCaller<T = any> = (query: string) => Promise<T>;

export function makeQueryCall<T = any>({
  query,
  cookie,
}: Required<Params>): AbortablePromise<QueryResults<T>> {
  const url = new URL(`https://${cookie.domain}/services/data/v50.0/query`);
  if (query) url?.searchParams.append('q', query);
  return makeApiCall<QueryResults<T>>({ url: url.toString(), cookie });
}

export function useSalesforceApiCaller({
  cookie,
}: {
  cookie?: browser.Cookies.Cookie;
}) {
  const pendingCalls = useRef<Record<string, AbortablePromise>>({});

  const removePending = useCallback((id: string) => {
    console.log(`removing ${id}`, pendingCalls.current[id]);
    delete pendingCalls.current[id];
  }, []);

  const makeApiCall1 = useCallback(
    <T>(url: string, method: HttpMethod = 'GET', data?: any): Promise<T> => {
      if (!cookie) {
        throw new Error('no cookie!');
      }
      const id = uuid();
      const r = makeApiCall({
        url,
        cookie,
        method,
        data,
      });
      pendingCalls.current[id] = r;
      r.promise.finally(() => removePending(id));

      return r.promise;
    },
    [cookie],
  );

  const makeApiQuery = useCallback(
    <T>(query: string) => {
      if (!cookie) {
        throw new Error('no cookie!');
      }
      const id = uuid();
      const r = makeQueryCall<T>({ query, cookie, useCache: true });
      pendingCalls.current[id] = r;
      r.promise.finally(() => removePending(id));
      return r.promise;
    },
    [cookie],
  );

  useEffect(() => {
    return () => {
      console.log('removing pending calls', pendingCalls);
      for (const [key, value] of Object.entries(pendingCalls.current)) {
        console.log(`cleaning up ${key}`, value);
        value.controller.abort();
      }
    };
  }, [pendingCalls]);

  return { makeApiCall: makeApiCall1, makeApiQuery };
}

export function useSalesforceApi<
  T = any,
  TError = Array<{ errorCode: string; message: string }>,
>({
  url,
  cookie,
  useCache,
}: {
  url?: string;
} & BaseParams) {
  const [results, setResults] = useState<T | undefined>(undefined);
  const [error, setError] = useState<TError | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const { domain, onSessionExpired } = useContext(SalesforceContext);

  useEffect(() => {
    if (url && cookie) {
      const controller = new AbortController();
      const { signal } = controller;
      const finalUrl = url.startsWith('https:')
        ? url
        : new URL(url, `https://${cookie.domain}`);

      const cacheKey = `apiResult:${url.toString()}`;
      if (useCache) {
        const fromStorage = localStorage.getItem(cacheKey);
        if (fromStorage) {
          setResults(JSON.parse(fromStorage));
          return;
        }
      }

      setIsLoading(true);
      setError(undefined);
      fetch(finalUrl.toString(), {
        method: 'GET',
        headers: { Authorization: `Bearer ${cookie.value}` },
        signal,
      })
        .then(async (result) => {
          if (result.ok) {
            if (result.status === 204) {
              return [];
            }
            return [await result.json()];
          }
          return [undefined, await result.json()];
        })
        .then(([result, err]) => {
          if (signal.aborted) {
            return;
          }

          if (err) {
            if (
              Array.isArray(err) &&
              err[0]?.errorCode === 'INVALID_SESSION_ID'
            ) {
              onSessionExpired(err[0]);
            }
            setError(err);
            return;
          }

          // cache results
          if (useCache) {
            localStorage.setItem(cacheKey, JSON.stringify(result));
          }
          setResults(result);
        })
        .catch(setError)
        .finally(() => {
          if (signal.aborted) {
            return;
          }
          setIsLoading(false);
        });
      return () => controller.abort();
    } else {
      setResults(undefined);
    }
    return () => {};
  }, [url, cookie]);

  return { results, isLoading, error };
}

export function useSalesforceQueryExplain<T = any>({ query, cookie }: Params) {
  // query at: /services/data/vXX.X/query/?explain=SOQL query
  const url =
    cookie && query
      ? new URL(`https://${cookie.domain}/services/data/v50.0/query`)
      : null;
  if (query) url?.searchParams.append('explain', query);
  return useSalesforceApi<T>({ url: url?.toString(), cookie });
}

export default function useSalesforceQuery<T = any>({
  query,
  cookie,
}: Params): Results<T> {
  const url =
    cookie && query
      ? new URL(`https://${cookie.domain}/services/data/v50.0/query`)
      : null;
  if (query) url?.searchParams.append('q', query);
  return useSalesforceApi<T>({ url: url?.toString(), cookie });
}
