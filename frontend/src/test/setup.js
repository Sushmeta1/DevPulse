import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(cleanup);

// jsdom lacks these browser APIs.
globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
window.matchMedia = window.matchMedia || ((query) => ({
  matches: false, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {},
}));

// NumberFlow is a web component; render the plain number so tests can read it.
vi.mock('@number-flow/react', () => ({ default: ({ value }) => String(value) }));
