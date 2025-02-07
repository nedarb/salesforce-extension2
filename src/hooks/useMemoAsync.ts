import { useEffect, useMemo, useState } from 'react';

export default function useMemoAsync<T, Deps extends unknown[]>(
  factory: (...args: Deps) => Promise<T>,
  deps: Deps,
) {
  const [value, setValue] = useState<T>();
  const [error, setError] = useState<unknown>();
  const [loading, setLoading] = useState(true);

  const memoizedFactory = useMemo(() => factory, deps);

  useEffect(() => {
    let isMounted = true; // Track component mount status to prevent state updates after unmount

    const executeAsync = async () => {
      setLoading(true);
      setError(null); // Clear any previous errors

      try {
        const result = await memoizedFactory(...deps); // Execute the async factory
        if (isMounted) {
          // Check if the component is still mounted
          setValue(result);
        }
      } catch (err) {
        if (isMounted) {
          // Check if the component is still mounted
          setError(err);
        }
      } finally {
        if (isMounted) {
          // Check if the component is still mounted
          setLoading(false);
        }
      }
    };

    executeAsync();

    return () => {
      isMounted = false; // Set isMounted to false on unmount to prevent state updates
    };
  }, [memoizedFactory, ...deps]); // Use memoizedFactory in the dependency array

  return { value, error, loading };
}
