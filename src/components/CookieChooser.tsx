/* eslint-disable react/require-default-props */
import browser from 'webextension-polyfill';
import { Loader, Select } from '@mantine/core';
import React, { useCallback } from 'react';
import useAsyncState from '../hooks/useAsyncState';
import urlToSalesforceMyDomain from '../common/SalesforceUtils';

async function getSalesforceSessionCookies() {
  const cookies = await browser.cookies.getAll({ name: 'sid' });
  return cookies.filter((cookie) => cookie.domain.endsWith('.my.salesforce.com'));
}

function ensureDomain(domainOrUrl?: string) : URL | undefined {
  if (domainOrUrl) {
    if (domainOrUrl.includes('://')) {
      return new URL(domainOrUrl);
    } return new URL(`https://${domainOrUrl}`);
  }
  return undefined;
}

interface Props {
  defaultDomain?: string;
  onCookieChosen: (cookie: browser.Cookies.Cookie) => void;
}

export default function CookieChooser({ defaultDomain, onCookieChosen = () => {} }: Props) {
  const normalized = urlToSalesforceMyDomain(defaultDomain);
  const url = ensureDomain(normalized);
  const [values, isLoading] = useAsyncState(getSalesforceSessionCookies);

  const handleChange = useCallback((domain: string) => {
    const cookie = values?.find((c) => c.domain === domain);
    if (cookie && onCookieChosen) { onCookieChosen(cookie); }
  }, [values]);

  if (values == null || isLoading) { return null; }
  return (
    <Select
      disabled={values == null}
      label="Instance"
      defaultValue={url?.host}
      data={(values || []).map((cookie) => ({ label: cookie.domain, value: cookie.domain }))}
      onChange={handleChange}
    />
  );
}
