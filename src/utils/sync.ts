import { GameState, GameSyncMessage } from '../types/game';

const CHANNEL_NAME = 'family_feud_sync_channel';
const STORAGE_KEY = 'family_feud_saved_state';
const SOUND_STORAGE_KEY = 'family_feud_sound_event';

let broadcastChannel: BroadcastChannel | null = null;

try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    broadcastChannel = new BroadcastChannel(CHANNEL_NAME);
  }
} catch (e) {
  console.warn('BroadcastChannel not initialized', e);
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

/**
 * Broadcast state update to both local tabs (via BroadcastChannel)
 * AND remote devices (via Backend Server API)
 */
export async function broadcastGameState(state: GameState, roomId: string = 'FEUD') {
  saveGameStateToStorage(state);
  const msg: GameSyncMessage = { type: 'STATE_UPDATE', state };

  // 1. Local broadcast
  if (broadcastChannel) {
    try {
      broadcastChannel.postMessage(msg);
    } catch {
      // ignore
    }
  }

  // 2. Server broadcast to other devices
  try {
    fetch(`/api/sync/state?room=${encodeURIComponent(roomId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state, room: roomId }),
    }).catch(() => {
      // ignore network errors if offline
    });
  } catch {
    // ignore
  }
}

/**
 * Broadcast sound trigger to both local tabs and remote devices
 */
export async function broadcastSound(
  sound: 'chime' | 'strike' | 'bell' | 'tick' | 'duplicate' | 'applause' | 'fanfare' | 'steal',
  roomId: string = 'FEUD'
) {
  const msg: GameSyncMessage = { type: 'TRIGGER_SOUND', sound };

  // 1. Local broadcast
  if (broadcastChannel) {
    try {
      broadcastChannel.postMessage(msg);
    } catch {
      // ignore
    }
  }

  try {
    localStorage.setItem(SOUND_STORAGE_KEY, JSON.stringify({ sound, t: Date.now() }));
  } catch {
    // ignore
  }

  // 2. Server broadcast to other devices
  try {
    fetch(`/api/sync/sound?room=${encodeURIComponent(roomId)}`, {
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
 * Fetch remote state from server
 */
export async function fetchRemoteState(roomId: string = 'FEUD'): Promise<GameState | null> {
  try {
    const res = await fetch(`/api/sync/state?room=${encodeURIComponent(roomId)}`);
    if (res.ok) {
      const data = await res.json();
      return (data.state as GameState) || null;
    }
  } catch (e) {
    console.warn('Could not fetch remote state', e);
  }
  return null;
}

/**
 * Subscribe to sync events:
 * 1. Server-Sent Events (SSE) for cross-device synchronization (phone, laptop, TV)
 * 2. BroadcastChannel for same-device tabs
 * 3. localStorage storage event fallback
 */
export function subscribeToSync(
  onMessage: (msg: GameSyncMessage) => void,
  roomId: string = 'FEUD'
): () => void {
  // 1. Local BroadcastChannel
  const channelListener = (event: MessageEvent) => {
    if (event.data) {
      onMessage(event.data as GameSyncMessage);
    }
  };

  if (broadcastChannel) {
    broadcastChannel.addEventListener('message', channelListener);
  }

  // 2. Storage event
  const storageListener = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY && e.newValue) {
      try {
        const state = JSON.parse(e.newValue) as GameState;
        onMessage({ type: 'STATE_UPDATE', state });
      } catch (err) {
        console.error('Error parsing storage state', err);
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

  // 3. Server-Sent Events for Cross-Device Synchronization
  let eventSource: EventSource | null = null;
  try {
    eventSource = new EventSource(`/api/sync/events?room=${encodeURIComponent(roomId)}`);

    eventSource.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        if (parsed.type === 'STATE_UPDATE' && parsed.state) {
          onMessage({ type: 'STATE_UPDATE', state: parsed.state as GameState });
        } else if (parsed.type === 'TRIGGER_SOUND' && parsed.sound) {
          onMessage({ type: 'TRIGGER_SOUND', sound: parsed.sound });
        }
      } catch (err) {
        console.warn('Error handling SSE message', err);
      }
    };

    eventSource.onerror = () => {
      // Reconnects automatically by browser
    };
  } catch (err) {
    console.warn('SSE not supported or failed to connect', err);
  }

  return () => {
    if (broadcastChannel) {
      broadcastChannel.removeEventListener('message', channelListener);
    }
    window.removeEventListener('storage', storageListener);
    if (eventSource) {
      eventSource.close();
    }
  };
}
