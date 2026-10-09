import { useCallback, useEffect, useRef, useState } from 'react';

/** Cancels stale reads so a previous account/request cannot repopulate a page. */
export default function useResource(loader) {
  const [data, setData] = useState(null); const [error, setError] = useState(null); const [loading, setLoading] = useState(true);
  const pending = useRef(null); const generation = useRef(0);
  const reload = useCallback(async () => {
    pending.current?.abort(); const controller = new AbortController(); pending.current = controller;
    const current = ++generation.current; setLoading(true); setError(null);
    try { const result = await loader(controller.signal); if (current === generation.current) setData(result); }
    catch (err) { if (current === generation.current && !err.cancelled) { setError(err); setData(null); } }
    finally { if (current === generation.current) setLoading(false); }
  }, [loader]);
  useEffect(() => { setData(null); reload(); return () => { generation.current += 1; pending.current?.abort(); }; }, [reload]);
  return { data, error, loading, reload };
}
