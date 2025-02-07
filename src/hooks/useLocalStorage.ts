import { Dispatch, SetStateAction, useCallback, useState } from 'react';
import browser, { Browser, Storage } from 'webextension-polyfill';
import useAsyncState from './useAsyncState';

interface BaseStorage<T> {
  getItem(key: string, defaultValue: T): Promise<T>;
  removeItem(key: string): Promise<void>;
  setItem(key: string, value: T): Promise<void>;
}

export class LocalStorage<T> implements BaseStorage<T> {
  getItem(key: string, defaultValue: T): Promise<T> {
    const v = localStorage.getItem(key);
    if (v) {
      return JSON.parse(v);
    }
    return Promise.resolve(defaultValue);
  }
  removeItem(key: string): Promise<void> {
    localStorage.removeItem(key);
    return Promise.resolve();
  }
  setItem(key: string, value: T): Promise<void> {
    const v = JSON.stringify(value);
    localStorage.setItem(key, v);
    return Promise.resolve();
  }
}

type BrowserStorageType = keyof Pick<
  Storage.Static,
  'sync' | 'managed' | 'local'
>;

export class BrowserStorage<T> implements BaseStorage<T> {
  constructor(private readonly storageType: BrowserStorageType = 'local') {}
  async getItem(key: string, defaultValue: T): Promise<T> {
    const result = await browser.storage[this.storageType].get({
      [key]: defaultValue,
    });
    if (result[key] instanceof String) {
      return JSON.parse(result[key] as string) as T;
    }
    return defaultValue;
  }
  removeItem(key: string): Promise<void> {
    return browser.storage[this.storageType].remove(key);
  }
  setItem(key: string, value: T): Promise<void> {
    return browser.storage[this.storageType].set({
      [key]: JSON.stringify(value),
    });
  }
}

export function useStorage<T>(
  name: string,
  storage: BaseStorage<T> = new LocalStorage(),
  defaultValue: T,
): [T | undefined, Dispatch<SetStateAction<T>>] {
  const [value, , setValue] = useAsyncState(
    () => storage.getItem(name, defaultValue),
    defaultValue,
  );

  const actualSet: Dispatch<SetStateAction<T>> = useCallback(
    (newValue: SetStateAction<T>) => {
      const finalValue =
        typeof newValue === 'function'
          ? (newValue as (prevState?: T) => T)(value)
          : newValue;
      storage.setItem(name, finalValue);
      setValue(finalValue);
    },
    [name, value],
  );

  return [value, actualSet];
}

export default function useLocalStorage<T>(
  name: string,
  defaultValue?: T,
): [T | undefined, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T | undefined>(() => {
    const v = localStorage.getItem(name);
    if (v) {
      return JSON.parse(v);
    }
    return defaultValue;
  });

  const actualSet: Dispatch<SetStateAction<T>> = useCallback(
    (newValue?: SetStateAction<T>) => {
      const finalValue =
        typeof newValue === 'function'
          ? (newValue as (prevState?: T) => T)(value)
          : newValue;
      const v = JSON.stringify(finalValue);
      if (v === null || v === undefined) {
        localStorage.removeItem(name);
      } else {
        localStorage.setItem(name, v);
      }
      setValue(finalValue);
    },
    [name, value],
  );

  return [value, actualSet];
}
