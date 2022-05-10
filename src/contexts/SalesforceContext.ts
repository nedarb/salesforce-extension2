import React from 'react';

const url = new URL(window.location.href);

const SalesfoceContxt = React.createContext<{domain?: string, onSessionExpired:(error?: any)=>void}>({
  domain: url.searchParams.get('domain') ?? undefined,
  onSessionExpired: () => {},
});

export default SalesfoceContxt;
