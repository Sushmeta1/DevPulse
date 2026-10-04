import { useState } from 'react';
import { AlertDialog } from '@base-ui/react/alert-dialog';
import { toast } from 'sonner';
import { Button } from '../ui/Button.jsx';
import { useAuth } from '../../state/auth.jsx';

/** Destructive and irreversible, so it asks you to type your username - a click is too easy to fire by accident. */
export function DeleteAccountDialog({ open, onOpenChange }) {
  const { user, deleteAccount } = useAuth();
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const matches = typed.trim().toLowerCase() === user.login.toLowerCase();

  const submit = async (e) => {
    e.preventDefault();
    if (!matches) return;
    setBusy(true);
    try {
      await deleteAccount();
      toast.success('Your account and all stored data were deleted');
    } catch (err) {
      toast.error(err.message);
      setBusy(false);
    }
  };

  return (
    <AlertDialog.Root open={open} onOpenChange={(o) => { if (!busy) { onOpenChange(o); if (!o) setTyped(''); } }}>
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className="modal-backdrop fixed inset-0 z-50" />
        <AlertDialog.Popup className="modal modal-sm z-50 p-5">
          <form onSubmit={submit}>
            <AlertDialog.Title className="text-base font-semibold tracking-tight">Delete your account?</AlertDialog.Title>
            <AlertDialog.Description className="mt-2 text-[13px] leading-relaxed text-fg-muted">
              This permanently removes your profile, your stored GitHub token, every repository snapshot and all AI summaries from DevPulse,
              and revokes DevPulse&apos;s access on GitHub. Your repositories on GitHub are not touched.
            </AlertDialog.Description>
            <label className="mt-4 block text-[13px]">
              Type <span className="mono font-semibold">{user.login}</span> to confirm
              <input
                value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" autoCapitalize="off" spellCheck={false}
                className="mt-1.5 h-9 w-full rounded-lg bg-surface px-3 text-[13px] shadow-[0_0_0_1px_var(--ring)] outline-none focus:shadow-[0_0_0_2px_var(--red)]"
              />
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <AlertDialog.Close render={<Button disabled={busy}>Cancel</Button>} />
              <Button type="submit" variant="danger" loading={busy} disabled={!matches}>Delete everything</Button>
            </div>
          </form>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
