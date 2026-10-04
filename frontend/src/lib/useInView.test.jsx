import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Reveal } from '../components/landing/Reveal.jsx';

let observers;
beforeEach(() => {
  observers = [];
  globalThis.IntersectionObserver = class {
    constructor(cb) { this.cb = cb; this.disconnected = false; observers.push(this); }
    observe() {}
    unobserve() {}
    disconnect() { this.disconnected = true; }
    trigger(isIntersecting) { this.cb([{ isIntersecting }]); }
  };
});
afterEach(() => { delete globalThis.IntersectionObserver; vi.restoreAllMocks(); });

describe('Reveal', () => {
  it('starts hidden, reveals once when it scrolls into view, and stops observing', () => {
    render(<Reveal variant="up" delay={120}>hello</Reveal>);
    const el = screen.getByText('hello');
    expect(el).toHaveAttribute('data-in', 'false');
    expect(el).toHaveAttribute('data-reveal', 'up');
    expect(el.style.getPropertyValue('--d')).toBe('120ms');

    act(() => observers[0].trigger(false)); // scrolled past without being visible: still hidden
    expect(el).toHaveAttribute('data-in', 'false');

    act(() => observers[0].trigger(true));
    expect(el).toHaveAttribute('data-in', 'true');
    expect(observers[0].disconnected).toBe(true); // one-shot: it never re-hides and never re-animates
  });

  it('shows content immediately when IntersectionObserver is unavailable', () => {
    delete globalThis.IntersectionObserver;
    render(<Reveal>visible</Reveal>);
    expect(screen.getByText('visible')).toHaveAttribute('data-in', 'true');
  });
});
