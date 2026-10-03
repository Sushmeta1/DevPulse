import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Delta } from './Delta.jsx';
import { Avatar } from './Avatar.jsx';

describe('Delta', () => {
  it('shows an increase as good by default', () => {
    render(<Delta current={15} previous={10} />);
    const el = screen.getByText('50%');
    expect(el.className).toMatch(/text-green/);
  });

  it('treats a decrease as good when lower is better (lead time)', () => {
    render(<Delta current={5} previous={10} goodWhen="down" />);
    expect(screen.getByText('50%').className).toMatch(/text-green/);
  });

  it('shows bad changes in red', () => {
    render(<Delta current={5} previous={10} />);
    expect(screen.getByText('50%').className).toMatch(/text-red/);
  });

  it('renders nothing without a comparison, and nothing for 0 -> 0', () => {
    const { container, rerender } = render(<Delta current={5} previous={null} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<Delta current={0} previous={0} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('labels growth from zero as new instead of infinity', () => {
    render(<Delta current={4} previous={0} />);
    expect(screen.getByText('New')).toBeInTheDocument();
  });
});

describe('Avatar', () => {
  it('falls back to initials when the image fails', () => {
    const { container } = render(<Avatar login="ghost-user" name="Ghost User" />);
    const img = container.querySelector('img');
    expect(img).toBeInTheDocument();
    fireEvent.error(img);
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText('GU')).toBeInTheDocument();
  });

  it('never builds an image URL from an unsafe login', () => {
    const { container } = render(<Avatar login="../evil" name="Evil" />);
    expect(container.querySelector('img')).toBeNull();
  });

  it('handles emoji-only and missing names', () => {
    render(<Avatar name="🦊" />);
    expect(screen.getByText('?')).toBeInTheDocument();
  });
});
