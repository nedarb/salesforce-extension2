import { useEffect, useState } from 'react';
import browser from 'webextension-polyfill';

export interface Params {
  url?: string;
  name: string;
}

export default function useBrowserCookie({ url, name }: Params) {
  const [cookie, setCookie] = useState<browser.Cookies.Cookie | undefined>(
    undefined,
  );
  useEffect(() => {
    if (url) {
      browser.cookies?.get({ url, name }).then((result) => {
        setCookie(result);
      });
    }
  }, [url, name]);

  return cookie;
}
