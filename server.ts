import express, { Request, Response } from 'express';
import path from 'path';
import os from 'node:os';
import fs from 'node:fs';
import { fileURLToPath } from 'url';
import type { GameState } from './src/types/game';
import { toAudienceState } from './src/utils/audienceState';
import { isNewerState } from './src/utils/stateVersion';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for all domains so custom domains, mobile phones and TV devices can sync seamlessly
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json({ limit: '10mb' }));

// Local Express persistence. Vercel needs a configured durable backend before this API can be used there.
interface RoomData {
  state: GameState | null;
  lastUpdated: number;
  clients: Set<Response>;
}

const rooms = new Map<string, RoomData>();
const roomDataDir = process.env.FAMILY_CHALLENGE_ROOM_DIR || path.resolve(__dirname, '.room-state');
const cleanRoomId = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const room = value.toUpperCase().trim();
  return /^[A-Z0-9_-]{1,32}$/.test(room) ? room : null;
};

function validPublicState(value: unknown): value is GameState {
  if (!value || typeof value !== 'object') return false;
  const state = value as GameState;
  if (!Number.isSafeInteger(state.actionId) || state.actionId < 0 || !Number.isFinite(state.lastUpdated)) return false;
  if (!Number.isInteger(state.currentRound) || state.currentRound < 1 || state.currentRound > 4) return false;
  if (!Array.isArray(state.revealedAnswers) || !Array.isArray(state.currentQuestion?.answers)) return false;
  if (state.revealedAnswers.length !== state.currentQuestion.answers.length) return false;
  return state.currentQuestion.answers.every((answer, index) =>
    typeof answer.text === 'string' && typeof answer.points === 'number' &&
    (state.revealedAnswers[index] || (answer.text === '' && answer.points === 0))
  );
}

function roomFromRequest(req: Request): string | null {
  return cleanRoomId(req.query.room || req.body?.room || 'MAIN');
}

app.get('/api/connect-info', (_req: Request, res: Response) => {
  const addresses = Object.values(os.networkInterfaces()).flatMap((entries) => entries ?? [])
    .filter((entry) => entry.family === 'IPv4' && !entry.internal)
    .map((entry) => entry.address);
  res.json({ localUrl: addresses.length ? `http://${addresses[0]}:${PORT}` : null });
});

function getOrCreateRoom(roomId: string): RoomData {
  let room = rooms.get(roomId);
  if (!room) {
    let savedState: GameState | null = null;
    try {
      const data = JSON.parse(fs.readFileSync(path.join(roomDataDir, `${roomId}.json`), 'utf8')) as GameState;
      if (validPublicState(data) && data.roomId === roomId) savedState = data;
    } catch { /* A new room has no saved state. */ }
    room = {
      state: savedState,
      lastUpdated: savedState?.lastUpdated ?? Date.now(),
      clients: new Set(),
    };
    rooms.set(roomId, room);
  }
  return room;
}

// 1. Get room state
app.get('/api/sync/state', (req: Request, res: Response) => {
  const roomId = roomFromRequest(req);
  if (!roomId) return res.status(400).json({ error: 'Invalid room code' });
  const room = getOrCreateRoom(roomId);
  res.json({ state: room.state, lastUpdated: room.lastUpdated });
});

// 2. Post room state update and broadcast to all connected devices in this room
app.post('/api/sync/state', (req: Request, res: Response) => {
  const roomId = roomFromRequest(req);
  if (!roomId) return res.status(400).json({ error: 'Invalid room code' });
  const { state } = req.body;
  if (!validPublicState(state) || state.roomId !== roomId) {
    return res.status(400).json({ error: 'Expected audience-safe game state for this room' });
  }

  const room = getOrCreateRoom(roomId);
  if (room.state && !isNewerState(state, room.state)) {
    return res.json({ success: true, duplicate: true, lastUpdated: room.lastUpdated });
  }
  const publicState = toAudienceState(state);
  try {
    fs.mkdirSync(roomDataDir, { recursive: true });
    const target = path.join(roomDataDir, `${roomId}.json`);
    const temporary = `${target}.${process.pid}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(publicState), { mode: 0o600 });
    fs.renameSync(temporary, target);
  } catch {
    return res.status(503).json({ error: 'Could not persist room state' });
  }
  room.state = publicState;
  room.lastUpdated = publicState.lastUpdated;

  const payload = `data: ${JSON.stringify({ type: 'STATE_UPDATE', state: publicState, roomId })}\n\n`;
  room.clients.forEach((client) => {
    try {
      client.write(payload);
    } catch {
      room.clients.delete(client);
    }
  });

  res.json({ success: true, lastUpdated: room.lastUpdated });
});

// 3. Post sound event trigger and broadcast to audience screen devices
app.post('/api/sync/sound', (req: Request, res: Response) => {
  const roomId = roomFromRequest(req);
  if (!roomId) return res.status(400).json({ error: 'Invalid room code' });
  const { sound } = req.body;

  const room = getOrCreateRoom(roomId);
  const payload = `data: ${JSON.stringify({ type: 'TRIGGER_SOUND', sound, roomId })}\n\n`;

  room.clients.forEach((client) => {
    try {
      client.write(payload);
    } catch {
      room.clients.delete(client);
    }
  });

  res.json({ success: true });
});

// 4. Server-Sent Events stream for instant low-latency real-time synchronization
app.get('/api/sync/events', (req: Request, res: Response) => {
  const roomId = roomFromRequest(req);
  if (!roomId) return res.status(400).json({ error: 'Invalid room code' });
  const room = getOrCreateRoom(roomId);

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  res.write(`data: ${JSON.stringify({ type: 'CONNECTED', roomId })}\n\n`);

  // Send current state immediately on connect
  if (room.state) {
    res.write(`data: ${JSON.stringify({ type: 'STATE_UPDATE', state: room.state, roomId })}\n\n`);
  }

  room.clients.add(res);

  // Keep-alive heartbeat every 20s
  const heartbeat = setInterval(() => {
    try {
      res.write(': heartbeat\n\n');
    } catch {
      clearInterval(heartbeat);
      room.clients.delete(res);
    }
  }, 20000);

  req.on('close', () => {
    clearInterval(heartbeat);
    room.clients.delete(res);
  });
});

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    // Vite middleware in development
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`Family Feud server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
