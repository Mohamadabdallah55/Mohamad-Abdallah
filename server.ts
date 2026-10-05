import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

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

// In-memory room storage for real-time synchronization across devices
interface RoomData {
  state: unknown;
  lastUpdated: number;
  clients: Set<Response>;
}

const rooms = new Map<string, RoomData>();

function getOrCreateRoom(roomId: string = 'MAIN'): RoomData {
  const normalizedId = roomId.toUpperCase().trim() || 'MAIN';
  let room = rooms.get(normalizedId);
  if (!room) {
    room = {
      state: null,
      lastUpdated: Date.now(),
      clients: new Set(),
    };
    rooms.set(normalizedId, room);
  }
  return room;
}

// 1. Get room state
app.get('/api/sync/state', (req: Request, res: Response) => {
  const roomId = (req.query.room as string) || 'MAIN';
  const room = getOrCreateRoom(roomId);
  res.json({ state: room.state, lastUpdated: room.lastUpdated });
});

// 2. Post room state update and broadcast to all connected devices in this room
app.post('/api/sync/state', (req: Request, res: Response) => {
  const roomId = (req.query.room as string) || req.body.room || 'MAIN';
  const { state } = req.body;

  const room = getOrCreateRoom(roomId);
  room.state = state;
  room.lastUpdated = Date.now();

  const payload = `data: ${JSON.stringify({ type: 'STATE_UPDATE', state, roomId })}\n\n`;
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
  const roomId = (req.query.room as string) || req.body.room || 'MAIN';
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
  const roomId = (req.query.room as string) || 'MAIN';
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
