import { useContext, useEffect, useState } from 'react';
import browser from 'webextension-polyfill';
import SalesforceContext from '../contexts/SalesforceContext';

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

export function useSalesforceApi<
  T = any,
  TError = Array<{ errorCode: string; message: string }>
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
