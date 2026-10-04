import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useAsync } from './useAsync.js';

const deferred = () => {
  let resolve; let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};

describe('useAsync', () => {
  it('derives loading from the key and keeps the previous value while the next one loads', async () => {
    const pending = {};
    const load = (signal, key) => (pending[key] = deferred()).promise;
    const { result, rerender } = renderHook(({ k }) => useAsync((signal) => load(signal, k), k), { initialProps: { k: 'a' } });

    expect(result.current.settled).toBe(false);
    expect(result.current.value).toBeUndefined();
    await act(async () => pending.a.resolve('A'));
    expect(result.current).toMatchObject({ settled: true, value: 'A', error: null });

    rerender({ k: 'b' });
    expect(result.current.settled).toBe(false);
    expect(result.current.value).toBe('A'); // stale value stays visible
    await act(async () => pending.b.resolve('B'));
    expect(result.current).toMatchObject({ settled: true, value: 'B' });
  });

  it('ignores a slow response for a key that is no longer current', async () => {
    const pending = {};
    const { result, rerender } = renderHook(({ k }) => useAsync(() => (pending[k] = deferred()).promise, k), { initialProps: { k: 'a' } });
    rerender({ k: 'b' });
    await act(async () => pending.b.resolve('B'));
    await act(async () => pending.a.resolve('A-late'));
    expect(result.current.value).toBe('B');
  });

  it('reports errors for the current key and keeps the last good value', async () => {
    const pending = {};
    const { result, rerender } = renderHook(({ k }) => useAsync(() => (pending[k] = deferred()).promise, k), { initialProps: { k: 'a' } });
    await act(async () => pending.a.resolve('A'));
    rerender({ k: 'b' });
    await act(async () => pending.b.reject(new Error('boom')));
    expect(result.current.error.message).toBe('boom');
    expect(result.current.value).toBe('A');
    expect(result.current.settled).toBe(true);
  });

  it('stays idle for a null key', async () => {
    let calls = 0;
    const { result } = renderHook(() => useAsync(() => { calls += 1; return Promise.resolve(1); }, null));
    await waitFor(() => expect(result.current.settled).toBe(false));
    expect(calls).toBe(0);
  });

  it('aborts the previous request when the key changes', async () => {
    const signals = [];
    const { rerender } = renderHook(({ k }) => useAsync((s) => { signals.push(s); return new Promise(() => {}); }, k), { initialProps: { k: 'a' } });
    rerender({ k: 'b' });
    expect(signals[0].aborted).toBe(true);
    expect(signals[1].aborted).toBe(false);
  });
});
