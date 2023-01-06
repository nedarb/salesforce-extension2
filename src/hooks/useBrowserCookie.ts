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

  const cookieApi: browser.Cookies.Static | undefined = browser.cookies;
  useEffect(() => {
    setLastUrl(url);


    if (url && cookieApi) {
      setIsLoading(true);

      cookieApi?.get({ url, name }).then((result) => {
        setCookie(result);
      }).finally(() => setIsLoading(false));

      const onChange = (changeInfo: browser.Cookies.OnChangedChangeInfoType) => {
        const { removed, cookie: changedCookie } = changeInfo;
        const matchesUrlAndName = changedCookie?.domain === domain && changedCookie?.name === name;
        if (matchesUrlAndName) {
          if (removed) {
            setCookie(undefined);
          } else {
            setCookie(changedCookie);
          }
        }
      };
      cookieApi?.onChanged.addListener(onChange);

      return () => cookieApi?.onChanged.removeListener(onChange);
    }

    return () => {};
  }, [url, name]);

  const isActuallyLoading = isLoading || lastUrl !== url;

  return [cookie, isActuallyLoading];
}
