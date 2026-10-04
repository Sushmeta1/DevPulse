import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { RepoCompare } from './RepoCompare.jsx';
import { SlackPreview } from './SlackPreview.jsx';
import { WaitingList } from '../dashboard/WaitingList.jsx';
import { ReviewersCard } from '../dashboard/ReviewersCard.jsx';
import { summary } from '../../test/fixtures.js';

const repo = (fullName, o = {}) => ({
  fullName, commits: 10, previousCommits: null, mergedPullRequests: 2, openPullRequests: 1, stalePullRequests: 0,
  medianMergeHours: 5, medianFirstReviewHours: 2, waitingForReview: 0, daily: [1, 2, 3], incomplete: false, ...o,
});
const names = () => screen.getAllByRole('row').slice(1).map((r) => within(r).getAllByRole('rowheader')[0].textContent);

describe('RepoCompare', () => {
  const repos = [
    repo('acme/api', { commits: 30, medianFirstReviewHours: null }),
    repo('acme/web', { commits: 50, medianFirstReviewHours: 9 }),
    repo('acme/mobile', { commits: 5, medianFirstReviewHours: 1 }),
  ];
  const view = () => render(<MemoryRouter><RepoCompare repos={repos} days={30} /></MemoryRouter>);

  it('starts with the most active repository first', () => {
    view();
    expect(names()).toEqual(['acme/web', 'acme/api', 'acme/mobile']);
  });

  it('sorts by a column and toggles direction; missing values always sort last', () => {
    view();
    fireEvent.click(screen.getByRole('button', { name: /First review/ }));
    expect(names()).toEqual(['acme/web', 'acme/mobile', 'acme/api']); // desc, null last
    fireEvent.click(screen.getByRole('button', { name: /First review/ }));
    expect(names()).toEqual(['acme/mobile', 'acme/web', 'acme/api']); // asc, null still last
    expect(screen.getByRole('columnheader', { name: /First review/ })).toHaveAttribute('aria-sort', 'ascending');
  });

  it('links each repository to its own dashboard at the same range', () => {
    view();
    expect(screen.getByRole('link', { name: /acme\/web/ })).toHaveAttribute('href', '/dashboard?repo=acme%2Fweb&range=30');
  });
});

describe('WaitingList', () => {
  it('shows the repository when asked and how long each has waited', () => {
    const items = [{ repo: 'acme/web', number: 7, title: 'Speed up build', authorLogin: 'ann', hoursWaiting: 80, htmlUrl: 'https://github.com/acme/web/pull/7' }];
    render(<WaitingList items={items} total={1} showRepo />);
    expect(screen.getByText('acme/web')).toBeInTheDocument();
    expect(screen.getByText('3.3d')).toBeInTheDocument();
  });

  it('says so when nothing is waiting', () => {
    render(<WaitingList items={[]} total={0} />);
    expect(screen.getByText('Nothing is waiting')).toBeInTheDocument();
  });

  it('counts the ones it does not list', () => {
    const items = Array.from({ length: 9 }, (_, i) => ({ number: i + 1, title: `PR ${i}`, authorLogin: 'a', hoursWaiting: 5, htmlUrl: '#' }));
    render(<WaitingList items={items} total={12} limit={4} />);
    expect(screen.getByText('and 8 more')).toBeInTheDocument();
  });
});

describe('ReviewersCard', () => {
  it('warns when one person does most of the reviews', () => {
    render(<ReviewersCard reviews={summary.reviews} />);
    expect(screen.getByText(/bob did 75% of all reviews/)).toBeInTheDocument();
  });
});

describe('SlackPreview', () => {
  const message = {
    text: 'x',
    blocks: [
      { type: 'header', text: { type: 'plain_text', text: 'Your week' } },
      { type: 'section', text: { type: 'mrkdwn', text: '*Waiting*\n• <https://github.com/a/b/pull/1|#1 Fix &amp; ship> - waiting 3h' } },
    ],
  };

  it('renders links and bold text as elements and un-escapes entities', () => {
    render(<SlackPreview message={message} />);
    expect(screen.getByRole('link', { name: '#1 Fix & ship' })).toHaveAttribute('href', 'https://github.com/a/b/pull/1');
    expect(screen.getByText('Waiting').tagName).toBe('STRONG');
  });

  it('never turns text into markup', () => {
    const evil = { blocks: [{ type: 'section', text: { type: 'mrkdwn', text: '&lt;img src=x onerror=alert(1)&gt;' } }] };
    const { container } = render(<SlackPreview message={evil} />);
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toContain('<img src=x onerror=alert(1)>');
  });
});
