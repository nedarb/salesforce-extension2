import { useEffect, useMemo, useState } from 'react';
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
  const domain = useMemo(() => (url ? new URL(url) : undefined)?.host, [url]);
  console.debug('domain', domain);
  useEffect(() => {
    setLastUrl(url);

    if (url) {
      console.log('foobar', url, name);
      setIsLoading(true);

      browser.cookies?.get({ url, name }).then((result) => {
        setCookie(result);
      }).finally(() => setIsLoading(false));

      const onChange = (changeInfo: browser.Cookies.OnChangedChangeInfoType) => {
        const { removed, cookie: changedCookie } = changeInfo;
        const matchesUrlAndName = changedCookie?.domain === domain && changedCookie?.name === name;
        if (matchesUrlAndName) {
          console.log('changed', changeInfo);
          if (removed) {
            setCookie(undefined);
          } else {
            setCookie(changedCookie);
          }
        }
      };
      browser.cookies?.onChanged.addListener(onChange);

      return () => browser.cookies?.onChanged.removeListener(onChange);
    }

    return () => {};
  }, [url, name]);

  const isActuallyLoading = isLoading || lastUrl !== url;

  return [cookie, isActuallyLoading];
}
