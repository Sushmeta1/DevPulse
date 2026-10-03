import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { shot, SAMPLE_DAILY, SAMPLE_PUNCHCARD, SAMPLE_VALUES } from './sample.js';

vi.mock('../../state/auth.jsx', () => ({
  useAuth: () => ({ config: { demo: true, githubLogin: false }, startDemo: vi.fn() }),
}));
const { CtaButtons } = await import('./CtaButtons.jsx');
const { Faq } = await import('./Faq.jsx');

describe('landing helpers', () => {
  it('picks the screenshot for the active theme', () => {
    expect(shot('hero', 'dark')).toBe('/landing/hero-dark.webp');
    expect(shot('pulls', 'light')).toBe('/landing/pulls-light.webp');
  });

  it('sample data is well-formed and varied enough to chart', () => {
    expect(SAMPLE_DAILY).toHaveLength(91);
    expect(SAMPLE_VALUES.some((v) => v === 0)).toBe(true);   // quiet days exist
    expect(SAMPLE_VALUES.some((v) => v >= 5)).toBe(true);    // and busy ones
    expect(SAMPLE_PUNCHCARD).toHaveLength(7);
    expect(SAMPLE_PUNCHCARD.every((row) => row.length === 24)).toBe(true);
    const weekdayWork = SAMPLE_PUNCHCARD[2].slice(9, 17).reduce((a, b) => a + b, 0);
    const weekendNight = SAMPLE_PUNCHCARD[0].slice(0, 6).reduce((a, b) => a + b, 0);
    expect(weekdayWork).toBeGreaterThan(weekendNight);
  });
});

describe('CtaButtons', () => {
  it('offers the demo and does not render a dead GitHub button when OAuth is not configured', () => {
    render(<MemoryRouter><CtaButtons /></MemoryRouter>);
    expect(screen.getByRole('button', { name: /Explore the live demo/ })).toBeEnabled();
    expect(screen.queryByText(/GitHub/)).toBeNull();
  });
});

describe('Faq', () => {
  it('lists every question as a button the accordion can open', () => {
    render(<Faq />);
    expect(screen.getAllByRole('button').length).toBeGreaterThanOrEqual(7);
    expect(screen.getByRole('button', { name: 'Does DevPulse read my code?' })).toHaveAttribute('aria-expanded', 'false');
  });
});
