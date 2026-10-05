import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle2, Hash, Mail, Send, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardBody, CardHeader } from '../components/ui/Card.jsx';
import { Badge } from '../components/ui/Badge.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Segmented } from '../components/ui/Segmented.jsx';
import { Skeleton } from '../components/ui/Skeleton.jsx';
import { Switch } from '../components/ui/Switch.jsx';
import { ErrorState } from '../components/ui/States.jsx';
import { RepoPicker } from '../components/team/RepoPicker.jsx';
import { SlackPreview } from '../components/team/SlackPreview.jsx';
import { useWorkspace } from '../state/workspace.jsx';
import { useAuth } from '../state/auth.jsx';
import { useAsync } from '../lib/useAsync.js';
import { useDocumentTitle } from '../lib/hooks.js';
import { api } from '../services/api.js';
import { timeAgo } from '../lib/format.js';

const MAX_DIGEST_REPOS = 10; // the server enforces the same cap
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SLACK_HINT = 'https://hooks.slack.com/services/...';

function Row({ title, hint, children }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2 py-4 first:pt-0 last:pb-0 [&:not(:last-child)]:hairline-b">
      <div className="min-w-0 basis-64 flex-1">
        <p className="text-[13px] font-medium">{title}</p>
        {hint && <p className="mt-0.5 text-xs text-fg-muted">{hint}</p>}
      </div>
      <div className="min-w-0 shrink-0">{children}</div>
    </div>
  );
}

function Preview({ repos }) {
  const [tab, setTab] = useState('email');
  const [nonce, setNonce] = useState(0);
  const res = useAsync((signal) => api.previewDigest(repos, signal), `preview|${repos.join(',')}|${nonce}`);
  const p = res.value;

  return (
    <Card>
      <CardHeader
        title="Preview"
        description={p ? `Subject: ${p.subject}` : 'Exactly what would be sent, from your current data'}
        actions={(
          <>
            <Segmented label="Preview format" size="sm" value={tab} onChange={setTab} options={[{ value: 'email', label: 'Email' }, { value: 'slack', label: 'Slack' }, { value: 'text', label: 'Plain text' }]} />
            <Button size="sm" variant="ghost" onClick={() => setNonce((n) => n + 1)} loading={!res.settled}>Refresh</Button>
          </>
        )}
      />
      <CardBody>
        {res.error && !p ? <ErrorState error={res.error} onRetry={() => setNonce((n) => n + 1)} /> : !p ? (
          <div aria-busy="true" aria-label="Rendering preview"><Skeleton className="h-4 w-1/2" /><Skeleton className="mt-3 h-64 w-full" /></div>
        ) : (
          <div className="swap" data-pending={!res.settled}>
            {p.skipped.length > 0 && <p role="status" className="mb-3 rounded-lg bg-amber-soft px-3 py-2 text-xs text-amber">{p.skipped.length} repositories left out: {p.skipped.map((s) => s.repo).join(', ')}</p>}
            {tab === 'email' && (
              <iframe
                title="E-mail preview" srcDoc={p.html} sandbox="" referrerPolicy="no-referrer"
                className="h-[640px] w-full rounded-lg bg-white shadow-[0_0_0_1px_var(--ring)]"
              />
            )}
            {tab === 'slack' && <SlackPreview message={p.slack} />}
            {tab === 'text' && <pre className="mono max-h-[640px] overflow-auto whitespace-pre-wrap rounded-lg bg-surface-2 p-4 text-xs leading-relaxed">{p.text}</pre>}
            <p className="mt-3 text-xs text-fg-faint">{p.note}</p>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function DigestForm({ config, onSaved, demo }) {
  const ws = useWorkspace();
  const [params] = useSearchParams();
  const fromUrl = (params.get('repos') || '').split(',').filter(Boolean);

  const [repos, setRepos] = useState(config.configured || !fromUrl.length ? config.repos : fromUrl);
  const [enabled, setEnabled] = useState(config.enabled);
  const [sendEmail, setSendEmail] = useState(config.sendEmail);
  const [includeAi, setIncludeAi] = useState(config.includeAi);
  const [weekday, setWeekday] = useState(config.weekday);
  const [slackUrl, setSlackUrl] = useState('');
  const [busy, setBusy] = useState('');
  const emailOk = config.channels.email.available && Boolean(config.channels.email.address);

  const body = (extra = {}) => ({ repos, enabled, sendEmail, includeAi, weekday: Number(weekday), ...(slackUrl.trim() ? { slackWebhookUrl: slackUrl.trim() } : {}), ...extra });

  const run = async (name, fn) => {
    setBusy(name);
    try { await fn(); } catch (e) { toast.error(e.message); } finally { setBusy(''); }
  };
  const save = (extra) => run('save', async () => {
    const next = await api.saveDigest(body(extra));
    setSlackUrl('');
    onSaved(next);
    toast.success('Digest settings saved');
  });
  const test = () => run('test', async () => {
    await api.sendTestDigest();
    toast.success('Test digest sent');
  });

  return (
    <div className="grid items-start gap-3 lg:grid-cols-5">
      <div className="space-y-3 lg:col-span-2">
        <Card>
          <CardHeader
            title="Weekly digest"
            description="One message with the week's delivery and review health across your repositories."
            actions={config.configured && !demo && (config.lastStatus?.startsWith('error')
              ? <Badge tone="red"><XCircle size={11} aria-hidden="true" /> Last send failed</Badge>
              : config.lastSentAt ? <Badge tone="green"><CheckCircle2 size={11} aria-hidden="true" /> Sent {timeAgo(config.lastSentAt)}</Badge> : null)}
          />
          <CardBody>
            {demo && <p className="mb-4 rounded-lg bg-accent-soft px-3 py-2 text-xs text-accent">The demo workspace can preview the digest but cannot send it. Sign in with GitHub to turn it on.</p>}
            <Row title="Repositories" hint={repos.length ? `${repos.length} selected` : `All repositories you have analyzed (up to ${MAX_DIGEST_REPOS})`}>
              <RepoPicker repos={ws.repos.list} selected={repos} onApply={setRepos} max={MAX_DIGEST_REPOS} />
            </Row>
            <Row title="Send on" hint="Covers the 7 days before, at about 07:00 UTC.">
              <select
                aria-label="Day of the week" value={weekday} onChange={(e) => setWeekday(Number(e.target.value))}
                className="h-8 rounded-lg bg-surface px-2.5 text-[13px] shadow-[0_0_0_1px_var(--ring)] outline-none focus:shadow-[0_0_0_2px_var(--accent)]"
              >
                {DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
              </select>
            </Row>
            <Row
              title="Slack" hint={config.slackConnected ? 'A webhook is connected (stored encrypted). Paste a new one to replace it.' : 'Create an incoming webhook for a channel and paste its URL.'}
            >
              <div className="w-full sm:w-64">
                <label className="sr-only" htmlFor="slack-url">Slack incoming webhook URL</label>
                <input
                  id="slack-url" type="url" value={slackUrl} onChange={(e) => setSlackUrl(e.target.value)} placeholder={config.slackConnected ? 'Replace webhook' : SLACK_HINT}
                  autoComplete="off" spellCheck={false} disabled={demo}
                  className="h-8 w-full rounded-lg bg-surface px-2.5 text-[13px] shadow-[0_0_0_1px_var(--ring)] outline-none placeholder:text-fg-faint focus:shadow-[0_0_0_2px_var(--accent)] disabled:opacity-50"
                />
                {config.slackConnected && !demo && (
                  <button onClick={() => save({ slackWebhookUrl: '' })} className="press mt-1.5 text-xs text-fg-muted hover:text-red hover:underline">Disconnect Slack</button>
                )}
              </div>
            </Row>
            <Row
              title="E-mail"
              hint={!config.channels.email.available ? 'E-mail delivery is not set up on this server.' : !config.channels.email.address ? 'Your GitHub account has no verified e-mail.' : `Sent to ${config.channels.email.address}`}
            >
              <Switch checked={sendEmail && emailOk} onCheckedChange={setSendEmail} disabled={!emailOk || demo} label={<><Mail size={14} aria-hidden="true" /> Send by e-mail</>} />
            </Row>
            <Row title="AI summary" hint="Adds a short written summary. Uses your AI quota; falls back to rule-based text.">
              <Switch checked={includeAi} onCheckedChange={setIncludeAi} disabled={demo} label="Include" />
            </Row>
            <Row title="Digest" hint="Pause without losing your settings.">
              <Switch checked={enabled} onCheckedChange={setEnabled} disabled={demo} label={enabled ? 'On' : 'Paused'} />
            </Row>
            {!demo && (
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <Button variant="primary" loading={busy === 'save'} onClick={() => save()}>Save settings</Button>
                <Button icon={Send} loading={busy === 'test'} disabled={!config.configured} onClick={test} title={config.configured ? undefined : 'Save your settings first'}>Send test now</Button>
                {config.lastStatus && <span className="basis-full text-xs text-fg-muted">Last status: {config.lastStatus}</span>}
              </div>
            )}
          </CardBody>
        </Card>
        <p className="flex items-start gap-2 px-1 text-xs text-fg-faint"><Hash size={13} className="mt-0.5 shrink-0" aria-hidden="true" />Webhook URLs and your GitHub token are encrypted at rest and never shown again after saving.</p>
      </div>
      <div className="lg:col-span-3"><Preview repos={repos} /></div>
    </div>
  );
}

export default function Digest() {
  useDocumentTitle('Weekly digest');
  const { user } = useAuth();
  const [nonce, setNonce] = useState(0);
  const [saved, setSaved] = useState(null);
  const res = useAsync((signal) => api.digest(signal), `digest|${nonce}`);
  const config = saved ?? res.value;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Weekly digest</h1>
        <p className="mt-1 text-[13px] text-fg-muted">The numbers your team should look at on Monday morning, delivered to Slack or your inbox.</p>
      </div>
      {res.error && !config ? <div className="card"><ErrorState error={res.error} onRetry={() => setNonce((n) => n + 1)} /></div> : !config ? (
        <div className="grid gap-3 lg:grid-cols-5" aria-busy="true" aria-label="Loading digest settings">
          <div className="card p-5 lg:col-span-2"><Skeleton className="h-4 w-32" /><Skeleton className="mt-4 h-48 w-full" /></div>
          <div className="card p-5 lg:col-span-3"><Skeleton className="h-4 w-24" /><Skeleton className="mt-4 h-64 w-full" /></div>
        </div>
      ) : <DigestForm config={config} onSaved={setSaved} demo={Boolean(user?.isDemo)} />}
    </div>
  );
}
