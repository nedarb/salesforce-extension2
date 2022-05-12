import React from 'react';
import browser from 'webextension-polyfill';

const url = new URL(window.location.href);

interface State {
  domain?: string;
  cookie: browser.Cookies.Cookie;
  onSessionExpired:(error?: any)=>void;
}

const SalesforceContext = React.createContext<State>({
  domain: url.searchParams.get('domain') ?? undefined,
  cookie: {} as any,
  onSessionExpired: () => {},
});

export default SalesforceContext;
