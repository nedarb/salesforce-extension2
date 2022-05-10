import React from 'react';

const url = new URL(window.location.href);

const SalesfoceContxt = React.createContext({
  domain: url.searchParams.get('domain'),
  onSessionExpired: (error?: any) => {},
});

export default SalesfoceContxt;
