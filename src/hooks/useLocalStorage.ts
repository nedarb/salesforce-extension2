import { useCallback, useState } from 'react';

export default function useLocalStorage<T>(
  name: string,
  defaultValue?: T,
): [T | undefined, (updated: T) => void] {
  const [value, setValue] = useState<T | undefined>(() => {
    const v = localStorage.getItem(name);
    if (v) {
      return JSON.parse(v);
    }
    return defaultValue;
  });

  const actualSet = useCallback(
    (newValue?: T) => {
      const v = JSON.stringify(newValue);
      if (v === null || v === undefined) {
        localStorage.removeItem(name);
      } else {
        localStorage.setItem(name, v);
      }
      setValue(newValue);
    },
    [name],
  );

  return [value, actualSet];
}
