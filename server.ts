import express, { Request, Response } from 'express';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { toAudienceState } from './src/utils/audienceState';
import { createInitialGameState } from './src/utils/gameDefaults';
import { applyRoomCommand, type RoomMatch } from './src/utils/roomCommands';
import { QUESTION_BANK } from './src/data/questionBank';

const root = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = Number(process.env.PORT || 3000);
const dataDir = process.env.FAMILY_CHALLENGE_ROOM_DIR || path.join(root, '.room-state');
const roomPattern = /^[A-F0-9]{24}$/;
const tokenPattern = /^[a-f0-9]{64}$/;

interface SavedRoom extends RoomMatch { hostDigest: string }
const audiences = new Map<string, Set<Response>>();
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const filename = (id: string) => path.join(dataDir, `${id}.json`);
const sseData = (room: SavedRoom) => `data: ${JSON.stringify({ state: toAudienceState(room.state), serverNow: Date.now() })}\n\n`;

app.disable('x-powered-by');
app.use((_req, res, next) => {
  res.set({ 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' });
  next();
});
app.use('/api', (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
app.use(express.json({ limit: '1mb' }));

function save(room: SavedRoom) {
  fs.mkdirSync(dataDir, { recursive: true, mode: 0o700 });
  const target = filename(room.state.roomId!);
  const temp = `${target}.${process.pid}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(room), { mode: 0o600 });
  fs.renameSync(temp, target);
}

function read(req: Request): SavedRoom | null {
  const id = req.query.room;
  if (typeof id !== 'string' || !roomPattern.test(id)) return null;
  try {
    const room = JSON.parse(fs.readFileSync(filename(id), 'utf8')) as SavedRoom;
    return tokenPattern.test(room.hostDigest) && room.state.roomId === id ? room : null;
  } catch { return null; }
}

function authorized(req: Request, room: SavedRoom) {
  const token = req.get('Authorization')?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
  return !!token && timingSafeEqual(Buffer.from(hash(token), 'hex'), Buffer.from(room.hostDigest, 'hex'));
}

function privateView(room: SavedRoom, includeBank = false) {
  return {
    state: room.state, canUndo: room.history.length > 0, serverNow: Date.now(),
    ...(includeBank ? { questions: [...room.customQuestions, ...QUESTION_BANK] } : {}),
  };
}

// Keep the existing LAN discovery and SSE routes. Only the server can write game state.
app.get('/api/connect-info', (_req, res) => {
  const addresses = Object.values(os.networkInterfaces()).flatMap(entries => entries ?? [])
    .filter(entry => entry.family === 'IPv4' && !entry.internal).map(entry => entry.address);
  res.json({ localUrl: addresses.length ? `http://${addresses[0]}:${port}` : null });
});

const creationAttempts = new Map<string, number>();
app.post('/api/sync/rooms', (req, res) => {
  const now = Date.now();
  for (const [ip, expiry] of creationAttempts) if (expiry <= now) creationAttempts.delete(ip);
  const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
  if ((creationAttempts.get(ip) ?? 0) > now) return res.status(429).json({ error: 'انتظر لحظة قبل إنشاء غرفة أخرى.' });
  creationAttempts.set(ip, now + 2500);
  const id = randomBytes(12).toString('hex').toUpperCase();
  const token = randomBytes(32).toString('hex');
  const room = { state: { ...createInitialGameState(), roomId: id }, hostDigest: hash(token), history: [], customQuestions: [] };
  try { save(room); } catch { return res.status(503).json({ error: 'تعذّر حفظ الغرفة على الخادم.' }); }
  res.status(201).json({ roomId: id, token, ...privateView(room, true) });
});

app.get('/api/sync/state', (req, res) => {
  const room = read(req);
  if (!room) return res.status(404).json({ error: 'الغرفة غير موجودة.' });
  res.json({ state: toAudienceState(room.state), serverNow: Date.now() });
});

app.get('/api/sync/host', (req, res) => {
  const room = read(req);
  if (!room || !authorized(req, room)) return res.status(403).json({ error: 'افتح رابط التحكم الخاص بهالغرفة.' });
  res.json(privateView(room, true));
});

app.post('/api/sync/command', (req, res) => {
  const room = read(req);
  if (!room || !authorized(req, room)) return res.status(403).json({ error: 'أمر التحكم يحتاج مفتاح المقدم.' });
  const { expectedActionId, command } = req.body ?? {};
  if (expectedActionId !== room.state.actionId) return res.status(409).json({ ...privateView(room, true), error: 'تغيّرت حالة المباراة. راجعها وحاول مرة ثانية.' });
  const result = applyRoomCommand(room, command);
  if (result === room) return res.status(422).json({ error: 'هذا الإجراء غير متاح بهالمرحلة أو بياناته غير صالحة.' });
  const updated = { ...result, hostDigest: room.hostDigest };
  try { save(updated); } catch { return res.status(503).json({ error: 'تعذّر حفظ الإجراء. لم يتغير رصيد المباراة.' }); }
  for (const client of audiences.get(room.state.roomId!) ?? []) client.write(sseData(updated));
  res.json(privateView(updated, command?.type === 'addQuestion'));
});

app.get('/api/sync/events', (req, res) => {
  const room = read(req);
  if (!room) return res.status(404).end();
  const id = room.state.roomId!;
  const group = audiences.get(id) ?? new Set<Response>();
  if (group.size >= 24) return res.status(429).end();
  audiences.set(id, group);
  res.status(200).set({ 'Content-Type': 'text/event-stream', 'X-Accel-Buffering': 'no', Connection: 'keep-alive', 'Cache-Control': 'no-cache, no-transform' });
  res.flushHeaders();
  res.write(sseData(room));
  group.add(res);
  const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), 15000);
  res.on('close', () => {
    clearInterval(heartbeat);
    group.delete(res);
    if (!group.size) audiences.delete(id);
  });
});
app.use('/api', (_req, res) => res.status(404).json({ error: 'مسار غير متاح.' }));

// Serve the compiled client only. Vite source serving would expose the question bank.
const dist = path.join(root, 'dist');
app.use(express.static(dist));
app.get(['/', '/play', '/host', '/admin'], (_req, res) => res.sendFile(path.join(dist, 'index.html')));
app.listen(port, '0.0.0.0', () => console.log(`Family Feud: http://localhost:${port}`));
