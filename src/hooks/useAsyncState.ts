import { useEffect, useState } from 'react';

export default function useAsyncState<T>(generator: ()=>Promise<T>): [T | undefined, boolean] {
  const [value, setValue] = useState<T | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    generator().then(setValue).finally(() => setIsLoading(false));
  }, [generator]);

  return [value, isLoading];
}
