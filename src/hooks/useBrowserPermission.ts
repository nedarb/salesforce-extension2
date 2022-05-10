import { useCallback, useEffect, useState } from 'react';
import browser from 'webextension-polyfill';

function checkPermission(origin: string) {
  return browser.permissions.contains({
    permissions: ['cookies'],
    origins: [origin],
  });
}

function removePermissions(origin: string) {
  return browser.permissions.remove({
    permissions: ['cookies'],
    origins: [origin],
  });
}

function requestPermission(origin: string): Promise<boolean> {
  if (origin) {
    return browser.permissions.request({
      permissions: ['cookies'],
      origins: [origin],
    });
  }
  throw new Error('no origin!');
}

export default function useBrowserPermission(origin?: string) {
  const [hasPermission, setHasPermission] = useState<boolean | undefined>(
    undefined,
  );

  const onRequestPermission = useCallback(() => {
    if (origin) {
      return requestPermission(origin).then((result) => {
        setHasPermission(result);
        return result;
      });
    }
    return Promise.resolve(false);
  }, [origin]);

  const onRemovePermission = useCallback(() => {
    if (origin) {
      return removePermissions(origin).then((result) => {
        setHasPermission(!result);
      });
    }
    return Promise.resolve(false);
  }, [origin]);

  useEffect(() => {
    if (origin) {
      checkPermission(origin).then(setHasPermission);
    }
  }, [origin]);

  return [hasPermission, onRequestPermission, onRemovePermission];
}
