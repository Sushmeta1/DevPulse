import { Card, Empty } from './Card.jsx';

export default function Contributors({ people }) {
  const max = Math.max(1, ...people.map((p) => p.commits + p.pullRequests));
  return (
    <Card title="Top contributors">
      {people.length === 0 ? (
        <Empty>No contributors yet.</Empty>
      ) : (
        <ul className="space-y-3">
          {people.map((p) => (
            <li key={p.login}>
              <div className="flex items-center justify-between text-sm">
                <a href={`https://github.com/${p.login}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 font-medium hover:underline">
                  <img src={`https://github.com/${p.login}.png?size=48`} alt="" className="h-6 w-6 rounded-full bg-slate-200" />
                  {p.login}
                </a>
                <span className="text-slate-500">{p.commits} commits / {p.pullRequests} PRs</span>
              </div>
              <div className="mt-1 h-1.5 rounded bg-slate-100">
                <div className="h-1.5 rounded bg-indigo-500" style={{ width: `${((p.commits + p.pullRequests) / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
