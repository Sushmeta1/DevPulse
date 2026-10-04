import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PullTable } from './PullTable.jsx';
import { ContributorsCard } from './ContributorsCard.jsx';
import { DataBanner } from './DataBanner.jsx';
import { KpiGrid } from './KpiGrid.jsx';
import { SignalsCard } from './SignalsCard.jsx';
import { summary, pulls } from '../../test/fixtures.js';

describe('PullTable', () => {
  it('filters by state and shows counts', () => {
    render(<PullTable pulls={pulls} />);
    expect(screen.getByRole('tab', { name: /All 3/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: /Merged 1/ }));
    expect(screen.getByText('Fix flaky test')).toBeInTheDocument();
    expect(screen.queryByText('Add retry logic')).toBeNull();
  });

  it('searches by title, number and author', () => {
    render(<PullTable pulls={pulls} />);
    const search = screen.getByRole('searchbox');
    fireEvent.change(search, { target: { value: 'dead' } });
    expect(screen.getAllByRole('link')).toHaveLength(1);
    fireEvent.change(search, { target: { value: 'bob' } });
    expect(screen.getByText('Fix flaky test')).toBeInTheDocument();
    fireEvent.change(search, { target: { value: 'nothing-matches' } });
    expect(screen.getByText('No matching pull requests')).toBeInTheDocument();
  });

  it('flags old open pull requests as stale', () => {
    render(<PullTable pulls={pulls} />);
    expect(screen.getByText(/Stale/)).toBeInTheDocument();
  });

  it('has a distinct empty state when there are no pull requests at all', () => {
    render(<PullTable pulls={[]} />);
    expect(screen.getByText('No pull requests in this period')).toBeInTheDocument();
  });

  it('paginates long lists', () => {
    const many = Array.from({ length: 45 }, (_, i) => ({ ...pulls[1], number: i + 100, title: `PR ${i}` }));
    render(<PullTable pulls={many} />);
    expect(screen.getAllByRole('link')).toHaveLength(20);
    fireEvent.click(screen.getByRole('button', { name: /Show 20 more/ }));
    expect(screen.getAllByRole('link')).toHaveLength(40);
  });
});

describe('ContributorsCard', () => {
  it('selects a contributor, and clears when clicked again', () => {
    const onSelect = vi.fn();
    const { rerender } = render(<ContributorsCard summary={summary} who={null} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('button', { name: /Ann Lee/ }));
    expect(onSelect).toHaveBeenLastCalledWith('ann');
    rerender(<ContributorsCard summary={summary} who="ann" onSelect={onSelect} />);
    expect(screen.getByRole('button', { name: /Ann Lee/ })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: /Ann Lee/ }));
    expect(onSelect).toHaveBeenLastCalledWith(null);
  });

  it('is honest about contributors without a linked GitHub account', () => {
    render(<ContributorsCard summary={summary} who={null} onSelect={() => {}} />);
    expect(screen.getByText('No linked GitHub account')).toBeInTheDocument();
  });
});

describe('DataBanner', () => {
  it('stays quiet for complete data', () => {
    const { container } = render(<DataBanner summary={summary} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('warns when the commit cap truncated the range', () => {
    const s = { ...summary, dataQuality: { truncated: true, incomplete: true, historyFrom: '2025-03-05T10:00:00Z' } };
    render(<DataBanner summary={s} />);
    expect(screen.getByRole('status')).toHaveTextContent(/most recent 1,000 commits/);
  });
});

describe('KpiGrid', () => {
  it('shows totals, deltas and the median time to merge', () => {
    render(<KpiGrid summary={summary} />);
    expect(screen.getByText('28')).toBeInTheDocument();
    expect(screen.getByText('100%')).toBeInTheDocument(); // commits doubled
    expect(screen.getByText('10h')).toBeInTheDocument();
    expect(screen.getByText(/Slowest 10%: 30h/)).toBeInTheDocument();
  });

  it('shows a dash instead of zero when nothing has merged', () => {
    const s = { ...summary, totals: { ...summary.totals, medianMergeHours: null, p90MergeHours: null }, previous: null };
    render(<KpiGrid summary={s} />);
    const kpi = screen.getByText('Median time to merge').parentElement;
    expect(within(kpi).getByText('-')).toBeInTheDocument();
  });
});

describe('SignalsCard', () => {
  it('summarises health in words', () => {
    render(<SignalsCard summary={summary} />);
    expect(screen.getByText('Review speed')).toBeInTheDocument();
    expect(screen.getByText('Stale pull requests')).toBeInTheDocument();
  });
});
