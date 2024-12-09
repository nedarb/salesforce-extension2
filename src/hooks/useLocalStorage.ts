import {
  Dispatch, SetStateAction, useCallback, useState,
} from 'react';

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
