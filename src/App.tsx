import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { AudienceScreen } from './components/AudienceScreen';
import { HostController } from './components/HostController';
import { ShowLogo } from './components/ShowLogo';
import { createRoom, getAudienceState, getHostState, RoomError, sendCommand, type PrivateView } from './utils/roomClient';
import type { Command } from './utils/roomCommands';
import type { GameState } from './types/game';
import './show.css';

const roomFormat = /^[A-F0-9]{24}$/;
const tokenFormat = /^[a-f0-9]{64}$/;
const credentialKey = (room: string) => `family-feud-host:${room}`;
const getStored = (key: string) => { try { return localStorage.getItem(key) ?? ''; } catch { return ''; } };
const store = (key: string, value: string) => { try { localStorage.setItem(key, value); } catch { /* Links remain usable. */ } };
function readLocation() {
  const url = new URL(window.location.href);
  const room = url.searchParams.get('room')?.trim().toUpperCase() ?? '';
  const host = ['/host', '/admin'].includes(url.pathname) || url.searchParams.get('mode') === 'remote' || url.searchParams.get('screen') === 'host';
  const fragment = new URLSearchParams(url.hash.slice(1)).get('key') ?? '';
  // The host key never appears in an HTTP URL or on the audience page.
  let token = '';
  if (host && roomFormat.test(room)) {
    if (tokenFormat.test(fragment)) {
      token = fragment;
      store(credentialKey(room), token);
      window.history.replaceState(null, '', `/host?room=${room}`);
    } else token = getStored(credentialKey(room));
  }
  return { host, room, token };
}
const location = readLocation();

export default function App() {
  if (location.host) {
    if (roomFormat.test(location.room) && tokenFormat.test(location.token)) return <HostRoom {...location} />;
    return <SessionNotice error="افتح رابط التحكم الخاص من رمز QR على اللابتوب." />;
  }
  if (roomFormat.test(location.room)) {
    return <AudienceRoom room={location.room} token={getStored(credentialKey(location.room))} />;
  }
  return <OpenStage />;
}

function OpenStage() {
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState('');
  const [ownedRoom, setOwnedRoom] = useState<{ room: string; token: string; showCode: boolean }>();

  useEffect(() => {
    const open = async () => {
      const last = getStored('family-feud-last-room');
      const key = roomFormat.test(last) ? getStored(credentialKey(last)) : '';
      if (tokenFormat.test(key)) {
        try {
          const view = await getHostState(last, key);
          if (view.state.phase !== 'GAME_OVER') return { room: last, token: key, showCode: false };
        } catch (error) {
          if (!(error instanceof RoomError) || error.status !== 403) throw error;
        }
      }
      const created = await createRoom();
      store(credentialKey(created.roomId), created.token);
      store('family-feud-last-room', created.roomId);
      return { room: created.roomId, token: created.token, showCode: true };
    };
    void open().then(next => {
      window.history.replaceState(null, '', `/play?room=${next.room}`);
      setOwnedRoom(next);
    }).catch(err => setError(err.message));
  }, [attempt]);

  if (ownedRoom) return <AudienceRoom {...ownedRoom} />;
  return <SessionNotice error={error} onRetry={() => { setError(''); setAttempt(n => n + 1); }} />;
}

function HostRoom({ room, token }: { room: string; token: string }) {
  const [view, setView] = useState<PrivateView>();
  const latest = useRef<PrivateView | undefined>(undefined);
  const lock = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [offset, setOffset] = useState(0);
  const [pair, setPair] = useState(false);

  const receive = (next: PrivateView) => {
    if (latest.current && next.state.actionId < latest.current.state.actionId) return;
    latest.current = { ...next, questions: next.questions ?? latest.current?.questions };
    setView(latest.current);
    setOffset(next.serverNow - Date.now());
  };

  useEffect(() => {
    const abort = new AbortController();
    const refresh = () => {
      if (lock.current) return;
      void getHostState(room, token, abort.signal).then(next => {
        if (abort.signal.aborted || lock.current) return;
        if (!latest.current || next.state.actionId !== latest.current.state.actionId) receive(next);
        setError(old => old.startsWith('انقطع الاتصال') ? '' : old);
        store('family-feud-last-room', room);
      }).catch(err => { if (!abort.signal.aborted && !lock.current) setError(err.message); });
    };
    refresh();
    const interval = window.setInterval(refresh, 2500);
    window.addEventListener('focus', refresh);
    return () => { abort.abort(); window.clearInterval(interval); window.removeEventListener('focus', refresh); };
  }, [room, token]);

  async function send(command: Command) {
    if (lock.current || !latest.current) return false;
    lock.current = true;
    setPending(true); setError('');
    try {
      receive(await sendCommand(room, token, latest.current.state.actionId, command));
      return true;
    } catch (err) {
      if (err instanceof RoomError && err.view) receive(err.view);
      else if (err instanceof RoomError && err.status === 0) {
        // The command might have committed before the connection dropped. Reload before another write.
        await getHostState(room, token, AbortSignal.timeout(4000)).then(receive).catch(() => {});
      }
      setError((err as Error).message);
      return false;
    } finally { lock.current = false; setPending(false); }
  }

  if (!view) return <SessionNotice error={error} />;
  return <>
    <HostController state={view.state} questions={view.questions ?? []} canUndo={view.canUndo}
      pending={pending} error={error} onConnect={() => setPair(true)} send={send} serverOffset={offset} />
    {pair && <Pairing room={room} token={token} onClose={() => setPair(false)} />}
  </>;
}

function Pairing({ room, token, onClose, initialKind = 'audience' }: {
  room: string; token: string; onClose: () => void; initialKind?: 'audience' | 'host';
}) {
  const [origin, setOrigin] = useState(window.location.origin);
  const [kind, setKind] = useState(initialKind);
  const [image, setImage] = useState<{ url: string; data: string }>();
  const [copied, setCopied] = useState(false);
  const audienceUrl = `${origin}/play?room=${room}`;
  const hostUrl = `${origin}/host?room=${room}#key=${token}`;
  const url = kind === 'host' ? hostUrl : audienceUrl;

  useEffect(() => {
    if (!['localhost', '127.0.0.1', '[::1]', '0.0.0.0'].includes(window.location.hostname)) return;
    const abort = new AbortController();
    void fetch('/api/connect-info', { signal: abort.signal }).then(res => res.json()).then(info => {
      if (info.localUrl && !abort.signal.aborted) setOrigin(info.localUrl);
    }).catch(() => {});
    return () => abort.abort();
  }, []);
  useEffect(() => {
    let active = true;
    void QRCode.toDataURL(url, { width: 260, margin: 2 }).then(data => { if (active) setImage({ url, data }); }).catch(() => {});
    return () => { active = false; };
  }, [url]);
  return <div className="remote-backdrop" onClick={onClose}>
    <section className="remote-sheet pairing" role="dialog" aria-modal="true" aria-label="ربط الأجهزة" onClick={e => e.stopPropagation()}>
      <header><h2>ربط الأجهزة</h2><button autoFocus aria-label="إغلاق" onClick={onClose}>✕</button></header>
      <div className="remote-tools">
        <button className={kind === 'audience' ? 'remote-gold' : ''} onClick={() => { setKind('audience'); setCopied(false); }}>شاشة الجمهور</button>
        <button className={kind === 'host' ? 'remote-gold' : ''} onClick={() => { setKind('host'); setCopied(false); }}>هاتف المقدم · خاص</button>
      </div>
      <p>{kind === 'host' ? 'هذا الرمز يعطي صلاحية التحكم كاملة. امسحه بهاتف المقدم بعيدًا عن الجمهور.' : 'افتح الرابط على جهاز البروجكتر. على الشبكة المحلية وصّل الجهازين بنفس شبكة Wi‑Fi.'}</p>
      {image?.url === url && <img src={image.data} width="240" height="240" alt={kind === 'host' ? 'رمز QR خاص بالمقدم' : 'رمز QR لشاشة الجمهور'} />}
      <input aria-label="رابط الجهاز" dir="ltr" value={url} readOnly onFocus={e => e.target.select()} />
      <div className="remote-tools">
        <button onClick={async () => {
          try { await navigator.clipboard.writeText(url); setCopied(true); }
          catch { setCopied(false); }
        }}>{copied ? 'تم النسخ' : 'نسخ الرابط'}</button>
        <a href={kind === 'audience' ? `/play?room=${room}` : url} target="_blank" rel="noreferrer">فتح الرابط</a>
      </div>
    </section>
  </div>;
}

function AudienceRoom({ room, token, showCode = false }: { room: string; token: string; showCode?: boolean }) {
  const [pair, setPair] = useState(showCode);
  const canPair = tokenFormat.test(token);
  const [state, setState] = useState<GameState>();
  const [offset, setOffset] = useState(0);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState('');
  const version = useRef(-1);

  useEffect(() => {
    const abort = new AbortController();
    const receive = (data: { state: GameState; serverNow: number }) => {
      if (abort.signal.aborted || data.state.actionId <= version.current) return;
      version.current = data.state.actionId;
      setState(data.state); setOffset(data.serverNow - Date.now()); setError('');
    };
    const events = new EventSource(`/api/sync/events?room=${room}`);
    events.onopen = () => setConnected(true);
    events.onmessage = event => receive(JSON.parse(event.data));
    events.onerror = () => setConnected(false);
    const refresh = () => void getAudienceState(room, abort.signal).then(receive).catch(err => {
      if (!abort.signal.aborted) setError(err.message);
    });
    refresh();
    const fallback = window.setInterval(() => { if (events.readyState !== EventSource.OPEN) refresh(); }, 3000);
    return () => { abort.abort(); events.close(); window.clearInterval(fallback); };
  }, [room]);
  if (!state) return <SessionNotice error={error} />;
  return <>
    <AudienceScreen state={state} connected={connected} serverOffset={offset} onPair={canPair ? () => setPair(true) : undefined} />
    {canPair && pair && <Pairing room={room} token={token} initialKind="host" onClose={() => setPair(false)} />}
  </>;
}

function SessionNotice({ error, onRetry }: { error: string; onRetry?: () => void }) {
  return <main className="lobby show-space"><div className="lobby-card"><ShowLogo />
    <p role="status">{error || 'جاري تجهيز شاشة الجمهور…'}</p>
    {error && (onRetry ? <button onClick={onRetry}>حاول مرة ثانية</button> : <a href="/">العودة للرئيسية</a>)}
  </div></main>;
}
