import { useEffect, useState } from 'react';
import browser from 'webextension-polyfill';

export interface Params {
  url?: string;
  name: string;
}

export default function useBrowserCookie({ url, name }: Params): [browser.Cookies.Cookie | undefined, boolean] {
  const [cookie, setCookie] = useState<browser.Cookies.Cookie | undefined>(
    undefined,
  );
  const [isLoading, setIsLoading] = useState(false);
  useEffect(() => {
    if (url) {
      setIsLoading(true);
      browser.cookies?.get({ url, name }).then((result) => {
        setCookie(result);
      }).finally(() => setIsLoading(false));
    }
  }, [url, name]);

  return [cookie, isLoading];
}
