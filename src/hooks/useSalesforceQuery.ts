/* eslint-disable no-restricted-syntax */
import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import browser from 'webextension-polyfill';
import { v4 as uuid } from 'uuid';
import SalesforceContext from '../contexts/SalesforceContext';

/**
 * SAMPLE API CALLS
 *
 * get search layout: /services/data/v50.0/search/layout/?q=User
 * /services/data/v55.0/ui-api/object-info/Account
 * /services/data/v55.0/ui-api/mru-list-records/Account
 * /services/data/v55.0/ui-api/related-list-info/Account/Opportunities
 * /services/data/v55.0/ui-api/lookups/{objectApiName}/{fieldApiName}/{targetApiName}
 *
 * https://developer.salesforce.com/docs/atlas.en-us.238.0.uiapi.meta/uiapi/ui_api_resources_lookup_object_get.htm?q=search
 */

type HttpMethod = 'GET' | 'PATCH' | 'POST';

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

  const cacheKey = `${cookie.domain}:apiResult:${url.toString()}`;
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
        if (Array.isArray(err) && err.length === 1) {
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

export type MakeApiCall<T = any> = (
  url: string,
  method?: HttpMethod,
  data?: any,
) => Promise<T>;
export type QueryCaller<T = any> = (query: string) => Promise<T>;

export interface ApiCaller {
  makeApiCall: <T>(url: string, method?: HttpMethod, data?: any) => Promise<T>;
  makeApiQuery: <T>(query: string) => Promise<QueryResults<T>>;
}

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
}): ApiCaller {
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

  const apiCaller: ApiCaller = useMemo(
    () => ({ makeApiCall: makeApiCall1, makeApiQuery }),
    [makeApiCall1, makeApiQuery],
  );

  return apiCaller;
}

const fetchWrapper = (() => {
  const ongoingCalls = new Map<string, Promise<Response>>();
  const myFetch = (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    const cacheKey = JSON.stringify(input);
    const existing = ongoingCalls.get(cacheKey);
    if (existing) {
      return existing;
    }

    const result = fetch(input, init);
    ongoingCalls.set(cacheKey, result);
    result.finally(() => ongoingCalls.delete(cacheKey));
    return result;
  };
  return { fetch: myFetch };
})();

export function useSalesforceApi<
  T = any,
  TError = Array<{ errorCode: string; message: string }>
>({
  url,
  cookie,
  useCache,
  method = 'GET',
  data,
}: {
  url?: string;
  method?: 'GET' | 'POST';
  data?: any;
} & BaseParams) {
  const [results, setResults] = useState<T | undefined>(undefined);
  const [error, setError] = useState<TError | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const { domain, onSessionExpired } = useContext(SalesforceContext);

  const stringifiedData = data ? JSON.stringify(data) : undefined;

  useEffect(() => {
    if (url && cookie) {
      const controller = new AbortController();
      const { signal } = controller;
      const finalUrl = url.startsWith('https:')
        ? url
        : new URL(url, `https://${cookie.domain}`);

      const cacheKey = `${cookie.domain}:apiResult:${url.toString()}`;
      if (useCache) {
        const fromStorage = localStorage.getItem(cacheKey);
        if (fromStorage) {
          setResults(JSON.parse(fromStorage));
          return;
        }
      }

      setIsLoading(true);
      setError(undefined);
      setResults(undefined);
      fetchWrapper
        .fetch(finalUrl.toString(), {
          method,
          headers: {
            Authorization: `Bearer ${cookie.value}`,
            'Content-Type': 'application/json',
          },
          signal,
          body: stringifiedData,
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

          setResults(result);

          // cache results
          if (useCache) {
            try {
              localStorage.setItem(cacheKey, JSON.stringify(result));
            } catch (e) {
              console.warn('Problem caching:', e);
            }
          }
        })
        .catch(setError)
        .finally(() => {
          if (signal.aborted) {
            return;
          }
          setIsLoading(false);
        });
      return () => controller.abort();
    }
    setResults(undefined);

    return () => {};
  }, [url, cookie, stringifiedData]);

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
