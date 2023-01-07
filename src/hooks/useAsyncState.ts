import { useEffect, useState } from 'react';

// T extends (...args: any[]
export default function useAsyncState<T>(
  generator: () => Promise<T>,
): [T | undefined, boolean] {
  const [value, setValue] = useState<T | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    generator()
      .then(setValue)
      .finally(() => setIsLoading(false));
  }, [generator]);

  return [value, isLoading];
}

type Unwrap<T> = T extends Promise<infer U>
  ? U
  : T extends (...args: any) => Promise<infer U>
  ? U
  : T extends (...args: any) => infer U
  ? U
  : T;

export function useAsyncState2<
  Fn extends (...ags: any[]) => Promise<any>,
  R extends Unwrap<Fn>,
>(generator: Fn, ...args: Parameters<Fn>): [R | undefined, boolean] {
  const [value, setValue] = useState<R | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    generator(...args)
      .then(setValue)
      .finally(() => setIsLoading(false));
  }, [generator, ...args]);

  return [value, isLoading];
}
