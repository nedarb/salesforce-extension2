import { useCallback, useEffect, useState } from 'react';

type HashChangeEventListener = (e: HashChangeEvent) => void;
export default function useHash() {
  const [hash, setHash] = useState(() => window.location.hash);
  const handleHashChange = useCallback<HashChangeEventListener>((e) => {
    setHash(window.location.hash);
  }, []);
  useEffect(() => {
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  });

  const updateHash = useCallback(
    (updatedHash: string) => {
      if (updatedHash !== hash) {
        window.location.hash = updatedHash;
      }
    },
    [hash],
  );

  const params = new URLSearchParams(hash.substring(1));

  return { hash, updateHash, hashParams: params };
}
