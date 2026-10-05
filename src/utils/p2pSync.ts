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
  onConnectionStatusChange?: (connected: boolean, peerCount: number) => void;
}

let peerInstance: Peer | null = null;
const activeConnections = new Set<DataConnection>();
let currentRoomId = '';
let currentRole: 'display' | 'remote' = 'display';

function sanitizePeerId(roomId: string, role: 'display' | 'remote'): string {
  const cleanRoom = roomId.toLowerCase().replace(/[^a-z0-9_-]/g, '') || 'main';
  return `ff-${role}-${cleanRoom}`;
}

export function initP2PSync(
  roomId: string,
  role: 'display' | 'remote',
  callbacks: P2PCallbacks
): () => void {
  currentRoomId = roomId;
  currentRole = role;

  // Clean up any existing peer
  if (peerInstance) {
    try {
      peerInstance.destroy();
    } catch {
      // ignore
    }
    peerInstance = null;
    activeConnections.clear();
  }

  const myPeerId = sanitizePeerId(roomId, role);
  const targetPeerId = sanitizePeerId(roomId, role === 'display' ? 'remote' : 'display');

  try {
    // Connect to PeerJS free public cloud broker
    peerInstance = new Peer(myPeerId, {
      debug: 0,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
        ],
      },
    });

    // Handle peer opened
    peerInstance.on('open', () => {
      // If we are the remote, try connecting to the display peer
      if (role === 'remote') {
        connectToTarget(targetPeerId, callbacks);
      }
    });

    // Handle incoming connections from other devices
    peerInstance.on('connection', (conn) => {
      setupConnection(conn, callbacks);
    });

    // Handle errors (e.g. ID already taken or target offline)
    peerInstance.on('error', (err) => {
      if (err.type === 'unavailable-id') {
        // ID in use (e.g. reload), connect with random ID and target the other peer
        const randomId = `${myPeerId}-${Math.floor(Math.random() * 1000)}`;
        try {
          peerInstance?.destroy();
          peerInstance = new Peer(randomId, { debug: 0 });
          peerInstance.on('open', () => {
            connectToTarget(targetPeerId, callbacks);
          });
          peerInstance.on('connection', (c) => setupConnection(c, callbacks));
        } catch {
          // ignore
        }
      }
    });
  } catch (err) {
    console.warn('P2P WebRTC failed to initialize', err);
  }

  // Periodic heartbeat / retry connection for remote if not connected
  const intervalId = setInterval(() => {
    if (currentRole === 'remote' && activeConnections.size === 0 && peerInstance && !peerInstance.destroyed) {
      connectToTarget(targetPeerId, callbacks);
    }
  }, 4000);

  return () => {
    clearInterval(intervalId);
    activeConnections.forEach((conn) => {
      try {
        conn.close();
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

function connectToTarget(targetId: string, callbacks: P2PCallbacks) {
  if (!peerInstance || peerInstance.destroyed) return;
  try {
    const conn = peerInstance.connect(targetId, {
      reliable: true,
    });
    setupConnection(conn, callbacks);
  } catch {
    // ignore
  }
}

function setupConnection(conn: DataConnection, callbacks: P2PCallbacks) {
  conn.on('open', () => {
    activeConnections.add(conn);
    callbacks.onConnectionStatusChange?.(true, activeConnections.size);
  });

  conn.on('data', (data: unknown) => {
    if (!data || typeof data !== 'object') return;
    const msg = data as GameSyncMessage;
    if (msg.type === 'STATE_UPDATE' && msg.state) {
      callbacks.onStateUpdate(msg.state);
    } else if (msg.type === 'TRIGGER_SOUND' && msg.sound) {
      callbacks.onSoundTrigger(msg.sound);
    }
  });

  conn.on('close', () => {
    activeConnections.delete(conn);
    callbacks.onConnectionStatusChange?.(activeConnections.size > 0, activeConnections.size);
  });

  conn.on('error', () => {
    activeConnections.delete(conn);
    callbacks.onConnectionStatusChange?.(activeConnections.size > 0, activeConnections.size);
  });
}

/**
 * Broadcast message over WebRTC P2P DataChannels to all connected devices
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
