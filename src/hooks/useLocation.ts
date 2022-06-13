import { useEffect, useState } from 'react';

export default function useLocation() {
  const [state, setState] = useState({ ...window.location });

  useEffect(() => {
    const handler = () => setState({ ...window.location });
    window.addEventListener('popstate', handler);
    window.addEventListener('pushstate', handler);
    window.addEventListener('replacestate', handler);

    return () => {
      window.removeEventListener('popstate', handler);
      window.removeEventListener('pushstate', handler);
      window.removeEventListener('replacestate', handler);
    };
  }, []);

  return state;
}
