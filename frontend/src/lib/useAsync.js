import { useEffect, useEffectEvent, useState } from 'react';

/**
 * Runs `load(signal)` whenever `key` changes and aborts the previous run.
 *
 * "Loading" is derived (the stored result belongs to a different key) rather than set inside the effect,
 * so there is no cascading render, and the previous value stays available while the next one loads - which
 * is what lets the dashboard dim stale numbers instead of flashing a skeleton on every range change.
 * Pass `key = null` to stay idle.
 */
export function useAsync(load, key) {
  const [state, setState] = useState({ key: undefined, value: undefined, error: null });
  const run = useEffectEvent((signal) => load(signal));

  useEffect(() => {
    if (key === null) return undefined;
    const ctrl = new AbortController();
    run(ctrl.signal).then(
      (value) => { if (!ctrl.signal.aborted) setState({ key, value, error: null }); },
      (error) => { if (!ctrl.signal.aborted) setState((s) => ({ key, value: s.value, error })); },
    );
    return () => ctrl.abort();
  }, [key]);

  const settled = key !== null && state.key === key;
  return { value: state.value, error: settled ? state.error : null, settled };
}
