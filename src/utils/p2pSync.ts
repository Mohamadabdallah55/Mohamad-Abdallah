/**
 * WebRTC Serverless P2P Sync using PeerJS
 * Connects Phone (Remote) directly to Display (TV/Laptop) with 0 servers needed.
 * 100% compatible with GitHub Pages and static hosting.
 */
import { Peer, DataConnection } from 'peerjs';
import { GameState, GameSyncMessage } from '../types/game';

interface P2PCallbacks {
  onStateUpdate: (state: GameState) => void;
  onSoundTrigger: (sound: 'chime' | 'strike' | 'bell' | 'tick' | 'duplicate' | 'applause' | 'fanfare' | 'steal') => void;
  onConnectionStatusChange?: (connected: boolean, count: number) => void;
  getCurrentState?: () => GameState | null;
}

let peerInstance: Peer | null = null;
const activeConnections = new Set<DataConnection>();
let currentStateGetter: (() => GameState | null) | null = null;

// Unique peer ID for room host (Display)
export function getRoomHostPeerId(roomId: string): string {
  const clean = roomId.toUpperCase().replace(/[^A-Z0-9_-]/g, '') || 'MAIN';
  return `feud-room-${clean}`;
}

export function initP2PSync(
  roomId: string,
  role: 'display' | 'remote',
  callbacks: P2PCallbacks
): () => void {
  currentStateGetter = callbacks.getCurrentState || null;

  // Cleanup any old instance
  if (peerInstance) {
    try {
      peerInstance.destroy();
    } catch {
      // ignore
    }
    peerInstance = null;
  }
  activeConnections.clear();

  const hostTargetId = getRoomHostPeerId(roomId);
  const myPeerId = role === 'display' ? hostTargetId : undefined; // Display claims room ID; Remote gets unique random ID

  try {
    peerInstance = new Peer(myPeerId as unknown as string, {
      debug: 0,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
        ],
      },
    });

    peerInstance.on('open', (id) => {
      // If we are remote, initiate direct connection to the Display room
      if (role === 'remote') {
        connectToHost(hostTargetId, callbacks);
      }
    });

    peerInstance.on('connection', (conn) => {
      setupConnection(conn, callbacks, role);
    });

    peerInstance.on('error', (err) => {
      if (err.type === 'unavailable-id' && role === 'display') {
        // If room ID is taken (e.g. fast refresh), connect with unique suffix and retry
        console.warn('Host room ID occupied, retrying...');
      }
    });
  } catch (e) {
    console.warn('PeerJS init failed', e);
  }

  // Auto-reconnect loop for remote if connection drops
  let reconnectInterval: ReturnType<typeof setInterval> | null = null;
  if (role === 'remote') {
    reconnectInterval = setInterval(() => {
      if (activeConnections.size === 0 && peerInstance && !peerInstance.destroyed) {
        connectToHost(hostTargetId, callbacks);
      }
    }, 3000);
  }

  return () => {
    if (reconnectInterval) clearInterval(reconnectInterval);
    activeConnections.forEach((c) => {
      try {
        c.close();
      } catch {
        // ignore
      }
    });
    activeConnections.clear();
    if (peerInstance) {
      try {
        peerInstance.destroy();
      } catch {
        // ignore
      }
      peerInstance = null;
    }
  };
}

let isConnectingToHost = false;

function connectToHost(hostId: string, callbacks: P2PCallbacks) {
  if (!peerInstance || peerInstance.destroyed || isConnectingToHost || activeConnections.size > 0) return;
  try {
    isConnectingToHost = true;
    const conn = peerInstance.connect(hostId, {
      reliable: true,
    });
    setupConnection(conn, callbacks, 'remote');
  } catch {
    isConnectingToHost = false;
  }
}

function setupConnection(
  conn: DataConnection,
  callbacks: P2PCallbacks,
  role: 'display' | 'remote'
) {
  conn.on('open', () => {
    isConnectingToHost = false;
    activeConnections.add(conn);
    callbacks.onConnectionStatusChange?.(true, activeConnections.size);

    // If Display, immediately send current game state to the freshly connected remote
    if (role === 'display' && currentStateGetter) {
      const current = currentStateGetter();
      if (current) {
        try {
          conn.send({ type: 'STATE_UPDATE', state: current });
        } catch {
          // ignore
        }
      }
    }

    // If Remote, request current state from Display
    if (role === 'remote') {
      try {
        conn.send({ type: 'REQUEST_STATE' });
      } catch {
        // ignore
      }
    }
  });

  conn.on('data', (data: unknown) => {
    if (!data || typeof data !== 'object') return;
    const msg = data as { type: string; state?: GameState; sound?: string };

    if (msg.type === 'REQUEST_STATE' && role === 'display' && currentStateGetter) {
      const current = currentStateGetter();
      if (current) {
        conn.send({ type: 'STATE_UPDATE', state: current });
      }
    } else if (msg.type === 'STATE_UPDATE' && msg.state) {
      callbacks.onStateUpdate(msg.state);
    } else if (msg.type === 'TRIGGER_SOUND' && msg.sound) {
      callbacks.onSoundTrigger(msg.sound as unknown as Parameters<typeof callbacks.onSoundTrigger>[0]);
    }
  });

  conn.on('close', () => {
    isConnectingToHost = false;
    activeConnections.delete(conn);
    callbacks.onConnectionStatusChange?.(activeConnections.size > 0, activeConnections.size);
  });

  conn.on('error', () => {
    isConnectingToHost = false;
    activeConnections.delete(conn);
    callbacks.onConnectionStatusChange?.(activeConnections.size > 0, activeConnections.size);
  });
}

/**
 * Broadcast message over WebRTC P2P to connected peers
 */
export function broadcastP2PMessage(msg: GameSyncMessage) {
  if (activeConnections.size === 0) return;
  activeConnections.forEach((conn) => {
    try {
      if (conn.open) {
        conn.send(msg);
      }
    } catch {
      // ignore
    }
  });
}

export function isP2PConnected(): boolean {
  return activeConnections.size > 0;
}
