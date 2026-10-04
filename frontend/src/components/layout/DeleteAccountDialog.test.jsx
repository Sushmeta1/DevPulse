import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const deleteAccount = vi.fn();
vi.mock('../../state/auth.jsx', () => ({ useAuth: () => ({ user: { login: 'Octo-Cat' }, deleteAccount }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const { DeleteAccountDialog } = await import('./DeleteAccountDialog.jsx');

describe('DeleteAccountDialog', () => {
  it('only enables the destructive button once the username is typed (case-insensitive)', async () => {
    deleteAccount.mockResolvedValue();
    render(<DeleteAccountDialog open onOpenChange={() => {}} />);
    const button = await screen.findByRole('button', { name: 'Delete everything' });
    expect(button).toBeDisabled();

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'someone-else' } });
    expect(button).toBeDisabled();
    fireEvent.change(input, { target: { value: ' octo-cat ' } });
    expect(button).toBeEnabled();

    fireEvent.click(button);
    await waitFor(() => expect(deleteAccount).toHaveBeenCalledTimes(1));
  });

  it('does not call the API when the form is submitted without a match', async () => {
    deleteAccount.mockClear();
    render(<DeleteAccountDialog open onOpenChange={() => {}} />);
    const input = await screen.findByRole('textbox');
    fireEvent.change(input, { target: { value: 'nope' } });
    fireEvent.submit(input.closest('form'));
    expect(deleteAccount).not.toHaveBeenCalled();
  });
});
