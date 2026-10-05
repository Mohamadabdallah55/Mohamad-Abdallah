import { GameState, GameSyncMessage } from '../types/game';
import { broadcastP2PMessage } from './p2pSync';

const CHANNEL_NAME = 'family_feud_sync_channel';
const STORAGE_KEY = 'family_feud_saved_state';
const SOUND_STORAGE_KEY = 'family_feud_sound_event';
const CUSTOM_SYNC_SERVER_KEY = 'feud_sync_server_url';

let broadcastChannel: BroadcastChannel | null = null;

try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    broadcastChannel = new BroadcastChannel(CHANNEL_NAME);
  }
} catch (e) {
  console.warn('BroadcastChannel not initialized', e);
}

// Get the base API URL for server sync
export function getSyncServerUrl(): string {
  if (typeof window === 'undefined') return '';
  
  // 1. Check if user configured a custom sync server
  const custom = localStorage.getItem(CUSTOM_SYNC_SERVER_KEY);
  if (custom && custom.trim()) {
    return custom.trim().replace(/\/+$/, '');
  }

  // 2. If running on GitHub Pages (static host), do NOT spam relative /api which 404s
  if (window.location.hostname.includes('github.io')) {
    // If on GitHub Pages without a configured server, we stay local (BroadcastChannel)
    return '';
  }

  // 3. Normal fullstack environment (Express server running on same origin)
  return window.location.origin;
}

export function saveGameStateToStorage(state: GameState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Failed to save state to localStorage', e);
  }
}

export function loadGameStateFromStorage(): GameState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Failed to load state from localStorage', e);
  }
  return null;
}

let lastBroadcastTime = 0;
let pendingBroadcastState: { state: GameState; roomId: string } | null = null;
let broadcastTimeout: ReturnType<typeof setTimeout> | null = null;

/**
 * Broadcast state update to local tabs and remote server (debounced to eliminate UI lag)
 */
export function broadcastGameState(state: GameState, roomId: string = 'FEUD') {
  saveGameStateToStorage(state);
  const msg: GameSyncMessage = { type: 'STATE_UPDATE', state };

  // 1. Instant local broadcast (tabs on the same browser)
  if (broadcastChannel) {
    try {
      broadcastChannel.postMessage(msg);
    } catch {
      // ignore
    }
  }

  // 2. WebRTC P2P direct sync to phone/display (serverless)
  broadcastP2PMessage(msg);

  // 3. Server broadcast with throttling (avoids freezing/lagging the browser)
  const serverBase = getSyncServerUrl();
  if (!serverBase) return; // Static host without backend, skip server fetch

  const now = Date.now();
  if (now - lastBroadcastTime < 150) {
    pendingBroadcastState = { state, roomId };
    if (!broadcastTimeout) {
      broadcastTimeout = setTimeout(() => {
        broadcastTimeout = null;
        if (pendingBroadcastState) {
          const item = pendingBroadcastState;
          pendingBroadcastState = null;
          lastBroadcastTime = Date.now();
          sendServerState(item.state, item.roomId, serverBase);
        }
      }, 160);
    }
    return;
  }

  lastBroadcastTime = now;
  sendServerState(state, roomId, serverBase);
}

function sendServerState(state: GameState, roomId: string, serverBase: string) {
  try {
    fetch(`${serverBase}/api/sync/state?room=${encodeURIComponent(roomId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state, room: roomId }),
    }).catch(() => {
      // ignore network errors silently
    });
  } catch {
    // ignore
  }
}

/**
 * Broadcast sound trigger
 */
export function broadcastSound(
  sound: 'chime' | 'strike' | 'bell' | 'tick' | 'duplicate' | 'applause' | 'fanfare' | 'steal',
  roomId: string = 'FEUD'
) {
  const msg: GameSyncMessage = { type: 'TRIGGER_SOUND', sound };

  if (broadcastChannel) {
    try {
      broadcastChannel.postMessage(msg);
    } catch {
      // ignore
    }
  }

  // WebRTC P2P direct sound trigger
  broadcastP2PMessage(msg);

  const serverBase = getSyncServerUrl();
  if (!serverBase) return;

  try {
    fetch(`${serverBase}/api/sync/sound?room=${encodeURIComponent(roomId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sound, room: roomId }),
    }).catch(() => {
      // ignore
    });
  } catch {
    // ignore
  }
}

/**
 * Fetch remote state from server (with timeout to prevent freezing)
 */
export async function fetchRemoteState(roomId: string = 'FEUD'): Promise<GameState | null> {
  const serverBase = getSyncServerUrl();
  if (!serverBase) return null;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);

    const res = await fetch(`${serverBase}/api/sync/state?room=${encodeURIComponent(roomId)}`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      return (data.state as GameState) || null;
    }
  } catch {
    // Silently ignore if server is unreachable
  }
  return null;
}

/**
 * Subscribe to sync events:
 * 1. BroadcastChannel (zero overhead, instant between tabs)
 * 2. Server-Sent Events (SSE) with strict error-backoff to eliminate freezing
 */
export function subscribeToSync(
  onMessage: (msg: GameSyncMessage) => void,
  roomId: string = 'FEUD'
): () => void {
  // 1. BroadcastChannel Listener
  const channelListener = (event: MessageEvent) => {
    if (event.data) {
      onMessage(event.data as GameSyncMessage);
    }
  };

  if (broadcastChannel) {
    broadcastChannel.addEventListener('message', channelListener);
  }

  // Fallback to storage event ONLY if BroadcastChannel is not supported
  let storageListener: ((e: StorageEvent) => void) | null = null;
  if (!broadcastChannel) {
    storageListener = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          const state = JSON.parse(e.newValue) as GameState;
          onMessage({ type: 'STATE_UPDATE', state });
        } catch {
          // ignore
        }
      } else if (e.key === SOUND_STORAGE_KEY && e.newValue) {
        try {
          const data = JSON.parse(e.newValue);
          if (data.sound) {
            onMessage({ type: 'TRIGGER_SOUND', sound: data.sound });
          }
        } catch {
          // ignore
        }
      }
    };
    window.addEventListener('storage', storageListener);
  }

  // 2. Server-Sent Events (SSE) with fail-safe error cutoff
  let eventSource: EventSource | null = null;
  const serverBase = getSyncServerUrl();

  if (serverBase) {
    try {
      let consecutiveErrors = 0;
      eventSource = new EventSource(`${serverBase}/api/sync/events?room=${encodeURIComponent(roomId)}`);

      eventSource.onmessage = (event) => {
        consecutiveErrors = 0;
        try {
          const parsed = JSON.parse(event.data);
          if (parsed.type === 'STATE_UPDATE' && parsed.state) {
            onMessage({ type: 'STATE_UPDATE', state: parsed.state as GameState });
          } else if (parsed.type === 'TRIGGER_SOUND' && parsed.sound) {
            onMessage({ type: 'TRIGGER_SOUND', sound: parsed.sound });
          }
        } catch {
          // ignore
        }
      };

      eventSource.onerror = () => {
        consecutiveErrors++;
        // If server fails or doesn't support SSE (e.g. GitHub Pages 404),
        // disconnect immediately to prevent endless reconnect loops and browser lag
        if (consecutiveErrors >= 2) {
          eventSource?.close();
          eventSource = null;
        }
      };
    } catch {
      // ignore
    }
  }

  return () => {
    if (broadcastChannel) {
      broadcastChannel.removeEventListener('message', channelListener);
    }
    if (storageListener) {
      window.removeEventListener('storage', storageListener);
    }
    if (eventSource) {
      eventSource.close();
    }
  };
}
