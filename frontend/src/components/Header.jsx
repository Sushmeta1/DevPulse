import { useAuth } from '../App.jsx';

export default function Header() {
  const { user, signOut } = useAuth();
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-indigo-600 font-bold text-white">D</span>
          <span className="text-lg font-bold tracking-tight">DevPulse</span>
        </div>
        <div className="flex items-center gap-3">
          {user.avatarUrl && <img src={user.avatarUrl} alt="" className="h-8 w-8 rounded-full" />}
          <span className="hidden text-sm font-medium sm:inline">{user.login}</span>
          <button onClick={signOut} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100">
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
