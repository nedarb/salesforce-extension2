import { useEffect, useState } from 'react';
import browser from 'webextension-polyfill';

export interface Params {
  url?: string;
  name: string;
}

export default function useBrowserCookie({ url, name }: Params): [browser.Cookies.Cookie | undefined, boolean] {
  const [lastUrl, setLastUrl] = useState<string | undefined>(undefined);
  const [cookie, setCookie] = useState<browser.Cookies.Cookie | undefined>(
    undefined,
  );
  const [isLoading, setIsLoading] = useState(!!url);
  useEffect(() => {
    if (url) {
      setIsLoading(true);
      browser.cookies?.get({ url, name }).then((result) => {
        setCookie(result);
      }).finally(() => setIsLoading(false));
    }
    setLastUrl(url);
  }, [url, name]);

  const isActuallyLoading = isLoading || lastUrl !== url;

  return [cookie, isActuallyLoading];
}
