/**
 * WebRTC Serverless P2P Sync using PeerJS
 * Connects Phone (Remote) directly to Display (TV/Laptop) with 0 servers needed.
 * Works across Wi-Fi and Mobile Data (4G/5G) using STUN + TURN relays.
 */
import { Peer, DataConnection } from 'peerjs';
import { GameState, GameSyncMessage } from '../types/game';
import { toAudienceState } from './audienceState';

interface P2PCallbacks {
  onStateUpdate: (state: GameState) => void;
  onSoundTrigger: (sound: 'chime' | 'strike' | 'bell' | 'tick' | 'duplicate' | 'applause' | 'fanfare' | 'steal') => void;
  onConnectionStatusChange?: (connected: boolean, count: number) => void;
  getCurrentState?: () => GameState | null;
}

let peerInstance: Peer | null = null;
const activeConnections = new Map<string, DataConnection>();
let currentStateGetter: (() => GameState | null) | null = null;

function cleanRoom(roomId: string): string {
  return roomId.toUpperCase().replace(/[^A-Z0-9_-]/g, '') || 'MAIN';
}

export function getRoomDisplayPeerId(roomId: string): string {
  return `feud-tv-${cleanRoom(roomId)}`;
}

export function getRoomRemotePeerId(roomId: string): string {
  return `feud-host-${cleanRoom(roomId)}`;
}

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
  {
    urls: 'turn:openrelay.metered.ca:80',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:443',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:443?transport=tcp',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
];

export function initP2PSync(
  roomId: string,
  role: 'display' | 'remote',
  callbacks: P2PCallbacks
): () => void {
  currentStateGetter = callbacks.getCurrentState || null;
  let disposed = false;
  let reconnectTimer: ReturnType<typeof setInterval> | null = null;
  let recreateTimer: ReturnType<typeof setTimeout> | null = null;
  let pendingConn: DataConnection | null = null;
  let pendingSince = 0;

  const displayPeerId = getRoomDisplayPeerId(roomId);
  const remotePeerId = getRoomRemotePeerId(roomId);
  const targetPeerId = role === 'remote' ? displayPeerId : remotePeerId;

  const notifyStatus = () => {
    if (disposed) return;
    // Prune closed connections
    for (const [key, conn] of activeConnections.entries()) {
      if (!conn.open) activeConnections.delete(key);
    }
    callbacks.onConnectionStatusChange?.(activeConnections.size > 0, activeConnections.size);
  };

  const cleanupPeer = () => {
    if (pendingConn) {
      try { pendingConn.close(); } catch {}
      pendingConn = null;
    }
    activeConnections.forEach((c) => {
      try { c.close(); } catch {}
    });
    activeConnections.clear();
    if (peerInstance) {
      try { peerInstance.destroy(); } catch {}
      peerInstance = null;
    }
  };

  const setupConnection = (conn: DataConnection) => {
    const connKey = conn.peer || `conn-${Math.random()}`;

    conn.on('open', () => {
      if (disposed) {
        try { conn.close(); } catch {}
        return;
      }
      if (pendingConn === conn) {
        pendingConn = null;
        pendingSince = 0;
      }
      activeConnections.set(connKey, conn);
      notifyStatus();

      // Exchange initial state immediately upon connection
      const current = currentStateGetter?.();
      if (role === 'remote' && current) {
        try {
          conn.send({ type: 'STATE_UPDATE', state: toAudienceState(current) });
        } catch {}
      } else if (role === 'display') {
        try {
          conn.send({ type: 'REQUEST_STATE', state: current ? toAudienceState(current) : undefined });
        } catch {}
      }
    });

    conn.on('data', (data: unknown) => {
      if (disposed || !data || typeof data !== 'object') return;
      const msg = data as { type: string; state?: GameState; sound?: string };

      if (msg.type === 'REQUEST_STATE' && role === 'remote') {
        const current = currentStateGetter?.();
        if (current) {
          try {
            conn.send({ type: 'STATE_UPDATE', state: toAudienceState(current) });
          } catch {}
        }
      } else if (msg.type === 'STATE_UPDATE' && msg.state) {
        callbacks.onStateUpdate(msg.state);
      } else if (msg.type === 'TRIGGER_SOUND' && msg.sound && role === 'display') {
        callbacks.onSoundTrigger(msg.sound as Parameters<typeof callbacks.onSoundTrigger>[0]);
      } else if (msg.type === 'PING') {
        try { conn.send({ type: 'PONG' }); } catch {}
      }
    });

    const handleDisconnect = () => {
      if (pendingConn === conn) {
        pendingConn = null;
        pendingSince = 0;
      }
      activeConnections.delete(connKey);
      notifyStatus();
    };

    conn.on('close', handleDisconnect);
    conn.on('error', handleDisconnect);
  };

  const tryConnectToCounterpart = () => {
    if (disposed || !peerInstance || peerInstance.destroyed || !peerInstance.open) return;
    if (activeConnections.has(targetPeerId) && activeConnections.get(targetPeerId)?.open) return;

    // Clear stale pending attempt after 3.5 seconds
    if (pendingConn) {
      if (Date.now() - pendingSince < 3500) return;
      try { pendingConn.close(); } catch {}
      pendingConn = null;
      pendingSince = 0;
    }

    try {
      const conn = peerInstance.connect(targetPeerId, { reliable: true });
      pendingConn = conn;
      pendingSince = Date.now();
      setupConnection(conn);
    } catch {
      pendingConn = null;
      pendingSince = 0;
    }
  };

  const startPeer = (useFallbackId = false) => {
    if (disposed) return;
    cleanupPeer();

    const desiredId = useFallbackId
      ? `${role === 'display' ? displayPeerId : remotePeerId}-${Math.floor(100 + Math.random() * 899)}`
      : role === 'display'
        ? displayPeerId
        : remotePeerId;

    try {
      const peer = new Peer(desiredId, {
        debug: 0,
        config: { iceServers: ICE_SERVERS },
      });
      peerInstance = peer;

      peer.on('open', () => {
        if (disposed) return;
        tryConnectToCounterpart();
      });

      peer.on('connection', (conn) => {
        if (disposed) return;
        setupConnection(conn);
      });

      peer.on('disconnected', () => {
        if (disposed || !peerInstance || peerInstance.destroyed) return;
        try {
          peerInstance.reconnect();
        } catch {}
      });

      peer.on('error', (err: { type?: string }) => {
        if (disposed) return;
        // peer-unavailable just means the counterpart hasn't opened the page yet
        if (err.type === 'peer-unavailable') {
          if (pendingConn) {
            try { pendingConn.close(); } catch {}
            pendingConn = null;
            pendingSince = 0;
          }
          return;
        }
        // If our deterministic ID is still held by a previous tab/refresh, use a fallback ID or retry
        if (err.type === 'unavailable-id') {
          if (role === 'remote' && !useFallbackId) {
            startPeer(true);
          } else {
            recreateTimer = setTimeout(() => startPeer(false), 1800);
          }
          return;
        }
        if (err.type === 'network' || err.type === 'server-error' || err.type === 'socket-error' || err.type === 'socket-closed') {
          recreateTimer = setTimeout(() => startPeer(useFallbackId), 2000);
        }
      });
    } catch {
      recreateTimer = setTimeout(() => startPeer(useFallbackId), 2000);
    }
  };

  startPeer(false);

  // Periodic reconnect & keep-alive loop
  reconnectTimer = setInterval(() => {
    if (disposed) return;
    notifyStatus();
    if (activeConnections.size === 0) {
      if (!peerInstance || peerInstance.destroyed) {
        startPeer(false);
      } else if (peerInstance.disconnected) {
        try { peerInstance.reconnect(); } catch {}
      } else {
        tryConnectToCounterpart();
      }
    } else {
      activeConnections.forEach((conn) => {
        if (conn.open) {
          try { conn.send({ type: 'PING' }); } catch {}
        }
      });
    }
  }, 2500);

  return () => {
    disposed = true;
    if (reconnectTimer) clearInterval(reconnectTimer);
    if (recreateTimer) clearTimeout(recreateTimer);
    cleanupPeer();
  };
}

/**
 * Broadcast message over WebRTC P2P to all connected peers
 */
export function broadcastP2PMessage(msg: GameSyncMessage) {
  if (activeConnections.size === 0) return;
  activeConnections.forEach((conn, key) => {
    try {
      if (conn.open) {
        conn.send(msg);
      } else {
        activeConnections.delete(key);
      }
    } catch {
      activeConnections.delete(key);
    }
  });
}

export function isP2PConnected(): boolean {
  for (const conn of activeConnections.values()) {
    if (conn.open) return true;
  }
  return false;
}
