/* eslint-disable react/require-default-props */
import { Button, Paper, Text } from '@mantine/core';
import React, { ReactNode, useCallback, useState } from 'react';

import urlToSalesforceMyDomain from '../common/SalesforceUtils';
import SalesforceContext from '../contexts/SalesforceContext';
import useBrowserCookie from '../hooks/useBrowserCookie';
import useBrowserPermission from '../hooks/useBrowserPermission';

interface Props {
    domain: string;
    children: ReactNode;
    noTokenBody?: ReactNode;
}
export default function SalesforceSession ({ domain: simpleDomain, children, noTokenBody } : Props) {
  const domain = urlToSalesforceMyDomain(simpleDomain);
  const [hasPermission, onRequestPermission, onRemovePermission] =
      useBrowserPermission(domain);
  const [sessionExpired, setSessionExpired] = useState(false);

  const [cookie, isCookieLoading] = useBrowserCookie({
    url: hasPermission ? domain : undefined,
    name: 'sid',
  });

  const onSessionExpired = useCallback(
    (possibleError?: any) => {
      setSessionExpired(true);
      console.log('session expired', possibleError);
    },
    [domain],
  );

  if (!domain) {
    return (
      <Paper shadow="xs" p="md">
        <Text>Please log into a Salesforce org!</Text>
        <Button component="a" href="https://login.salesforce.com" target="_blank" rel="noreferrer">Log in</Button>
        {noTokenBody}
      </Paper>
    );
  }

  if (sessionExpired) {
    return (
      <Paper shadow="xs" p="md">
        <Text>Session has expired for {simpleDomain}</Text>
        <Button component="a" href={domain} target="_blank" rel="noreferrer">Log back in</Button>
        {noTokenBody}
      </Paper>
    );
  }

  if (hasPermission === undefined || isCookieLoading) { return null; }
  if (hasPermission === false) {
    return (
      <Paper shadow="xs" p="md">
        <Text>No permission for {domain}</Text>
        <Button onClick={onRequestPermission}>Request</Button>
        {noTokenBody}
      </Paper>
    );
  }

  if (!cookie) {
    return (
      <Paper shadow="xs" p="md">
        <Text>No cookie present for {simpleDomain}</Text>
        <Button component="a" href={domain} target="_blank" rel="noreferrer">Log back in</Button>
        {noTokenBody}
      </Paper>
    );
  }

  return (
    <SalesforceContext.Provider value={{ domain, cookie, onSessionExpired }}>
      {children}
    </SalesforceContext.Provider>
  );
}
