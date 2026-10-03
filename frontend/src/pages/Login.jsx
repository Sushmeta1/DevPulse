import { api } from '../services/api.js';

const ERRORS = {
  invalid_oauth_state: 'Your login session expired. Please try again.',
  github_login_failed: 'GitHub login failed. Please try again.',
};

const FEATURES = [
  ['Repository overview', 'Commits, pull requests and contributors in one place.'],
  ['Interactive charts', 'Spot activity trends and review bottlenecks at a glance.'],
  ['AI sprint summaries', 'Productivity insights and suggestions, generated from your data.'],
];

export default function Login() {
  const code = new URLSearchParams(window.location.search).get('error');

  return (
    <main className="grid min-h-screen place-items-center bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-600 text-lg font-bold text-white">D</span>
          <h1 className="text-2xl font-bold tracking-tight">DevPulse</h1>
        </div>
        <p className="mt-3 text-slate-600">AI-powered GitHub activity dashboard for developers and teams.</p>

        <ul className="mt-6 space-y-3">
          {FEATURES.map(([title, text]) => (
            <li key={title} className="text-sm">
              <span className="font-semibold">{title}</span>
              <span className="text-slate-500"> - {text}</span>
            </li>
          ))}
        </ul>

        {code && (
          <p role="alert" className="mt-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            {ERRORS[code] || 'Something went wrong while signing in.'}
          </p>
        )}

        <a
          href={api.loginUrl}
          className="mt-8 flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-3 font-medium text-white transition hover:bg-slate-700"
        >
          <svg viewBox="0 0 16 16" className="h-5 w-5 fill-current" aria-hidden="true">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
          </svg>
          Continue with GitHub
        </a>
      </div>
    </main>
  );
}
