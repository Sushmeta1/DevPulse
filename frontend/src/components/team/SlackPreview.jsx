import { Fragment } from 'react';

const decode = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

/**
 * Slack "mrkdwn" -> React nodes, without innerHTML: <url|label>, *bold*, _italic_. The text came from GitHub and was
 * escaped for Slack on the server, so this only has to undo that escaping for display.
 */
function Mrkdwn({ text }) {
  const parts = [];
  const re = /<(https:\/\/[^|>\s]+)\|([^>]+)>|\*([^*\n]+)\*|_([^_\n]+)_/g;
  let last = 0; let m;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(decode(text.slice(last, m.index)));
    if (m[1]) parts.push(<a key={m.index} href={m[1]} target="_blank" rel="noreferrer" className="text-[#1264a3] hover:underline">{decode(m[2])}</a>);
    else if (m[3]) parts.push(<strong key={m.index}>{decode(m[3])}</strong>);
    else parts.push(<em key={m.index}>{decode(m[4])}</em>);
    last = re.lastIndex;
  }
  if (last < text.length) parts.push(decode(text.slice(last)));
  return parts.map((p, i) => <Fragment key={i}>{p}</Fragment>);
}

/** A faithful-enough rendering of the Block Kit message so people can see what lands in their channel. */
export function SlackPreview({ message }) {
  return (
    <div className="rounded-lg bg-white p-4 text-[#1d1c1d] shadow-[0_0_0_1px_rgb(0_0_0/0.1)]" style={{ colorScheme: 'light' }}>
      <div className="flex gap-3">
        <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-md bg-[#111827] text-sm font-bold text-white" aria-hidden="true">D</span>
        <div className="min-w-0 flex-1 text-[15px] leading-snug">
          <p className="font-bold">DevPulse <span className="ml-1 rounded bg-[#e8e8e8] px-1 text-[10px] font-semibold uppercase text-[#616061]">App</span></p>
          <div className="mt-1 space-y-2">
            {message.blocks.map((b, i) => {
              if (b.type === 'header') return <p key={i} className="text-lg font-bold">{b.text.text}</p>;
              if (b.type === 'context') return <p key={i} className="text-xs text-[#616061]"><Mrkdwn text={b.elements.map((e) => e.text).join(' ')} /></p>;
              if (b.type === 'section' && b.fields) {
                return (
                  <div key={i} className="grid grid-cols-2 gap-x-6 gap-y-2">
                    {b.fields.map((f, j) => <p key={j} className="whitespace-pre-line"><Mrkdwn text={f.text} /></p>)}
                  </div>
                );
              }
              if (b.type === 'section') return <p key={i} className="whitespace-pre-line"><Mrkdwn text={b.text.text} /></p>;
              if (b.type === 'actions') {
                return (
                  <div key={i} className="flex gap-2 pt-1">
                    {b.elements.map((e, j) => <span key={j} className="rounded-md px-3 py-1 text-sm font-semibold shadow-[0_0_0_1px_rgb(0_0_0/0.3)]">{e.text.text}</span>)}
                  </div>
                );
              }
              return null;
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
