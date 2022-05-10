import { useEffect, useState } from 'react';

export default function useAsyncState<T>(generator: ()=>Promise<T>) {
  const [value, setValue] = useState<T | undefined>(undefined);

  useEffect(() => {
    generator().then(setValue);
  }, [generator]);

  return value;
}
