import { useState, useEffect, useCallback } from 'react';
import { GameState, GameSyncMessage } from './types/game';
import { createInitialGameState } from './utils/gameDefaults';
import {
  broadcastGameState,
  broadcastSound,
  fetchRemoteState,
  loadGameStateFromStorage,
  subscribeToSync,
} from './utils/sync';
import { playSound } from './utils/audio';
import { AudienceScreen } from './components/AudienceScreen';
import { HostController } from './components/HostController';
import { DeviceConnectModal } from './components/DeviceConnectModal';

export default function App() {
  const [roomId, setRoomId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('room')?.toUpperCase() || 'FEUD';
    }
    return 'FEUD';
  });

  const [screenMode, setScreenMode] = useState<'audience' | 'host'>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const mode = params.get('mode') || params.get('screen');
      if (mode === 'audience' || mode === 'tv') return 'audience';
      if (mode === 'host' || mode === 'controller') return 'host';
    }
    return 'audience';
  });

  // Pure TV fullscreen mode (hides the top navigation switcher)
  const [isTvCleanMode, setIsTvCleanMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('screen') === 'audience' || params.get('clean') === '1';
    }
    return false;
  });

  const [showConnectModal, setShowConnectModal] = useState<boolean>(false);

  const [gameState, setGameState] = useState<GameState>(() => {
    const saved = loadGameStateFromStorage();
    if (saved) return { ...saved, roomId };
    return { ...createInitialGameState(), roomId };
  });

  // Fetch initial remote state from server
  useEffect(() => {
    fetchRemoteState(roomId).then((remote) => {
      if (remote) {
        setGameState(remote);
      }
    });
  }, [roomId]);

  // Subscribe to BroadcastChannel & Server-Sent Events (SSE)
  useEffect(() => {
    const unsubscribe = subscribeToSync((msg: GameSyncMessage) => {
      if (msg.type === 'STATE_UPDATE') {
        setGameState(msg.state);
      } else if (msg.type === 'TRIGGER_SOUND') {
        playSound(msg.sound);
      }
    }, roomId);

    return () => {
      unsubscribe();
    };
  }, [roomId]);

  // State updater that auto-broadcasts locally and to remote devices
  const updateState = useCallback(
    (updater: (prev: GameState) => GameState) => {
      setGameState((prev) => {
        const next = updater(prev);
        const withMeta = { ...next, roomId, lastUpdated: Date.now() };
        broadcastGameState(withMeta, roomId);
        return withMeta;
      });
    },
    [roomId]
  );

  // Sound trigger that plays locally and broadcasts to all devices
  const triggerSound = useCallback(
    (sound: 'chime' | 'strike' | 'bell' | 'tick' | 'duplicate' | 'applause' | 'fanfare' | 'steal') => {
      playSound(sound);
      broadcastSound(sound, roomId);
    },
    [roomId]
  );

  // Reset full game immediately without window.confirm (which blocks in iframes)
  const resetGame = () => {
    const fresh = { ...createInitialGameState(), roomId, lastUpdated: Date.now() };
    setGameState(fresh);
    broadcastGameState(fresh, roomId);
  };

  const dismissGameOver = () => {
    updateState((prev) => ({
      ...prev,
      phase: 'ROUND_OVER',
    }));
  };

  const handleRoomChange = (newRoom: string) => {
    setRoomId(newRoom);
    const url = new URL(window.location.href);
    url.searchParams.set('room', newRoom);
    window.history.replaceState({}, '', url.toString());
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-amber-500 selection:text-slate-950">
      {/* Top Floating View Switcher Bar */}
      {!isTvCleanMode ? (
        <nav className="sticky top-0 z-40 flex flex-wrap items-center justify-between border-b border-amber-500/20 bg-slate-950/95 px-3 md:px-5 py-2 backdrop-blur-md gap-2">
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="font-display font-extrabold text-amber-400 text-sm hidden sm:inline">
              FAMILY FEUD
            </span>

            {/* Mode Switcher Tabs */}
            <div className="flex items-center gap-1 rounded-xl bg-slate-900 p-1 border border-slate-800">
              <button
                onClick={() => setScreenMode('audience')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                  screenMode === 'audience'
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>📺</span>
                <span>شاشة العرض (التلفزيون)</span>
              </button>
              <button
                onClick={() => setScreenMode('host')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                  screenMode === 'host'
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>🎮</span>
                <span>شاشة التحكم (المقدم)</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Dual Device Connect Button (QR Code) */}
            <button
              onClick={() => setShowConnectModal(true)}
              className="flex items-center gap-1.5 rounded-xl border border-amber-400 bg-gradient-to-r from-amber-500/20 to-yellow-500/20 px-3 py-1.5 text-xs font-bold text-amber-300 hover:brightness-125 shadow-[0_0_12px_rgba(245,158,11,0.2)] active:scale-95 transition-all"
            >
              <span>📱</span>
              <span>ربط الجوال بالباركود (QR)</span>
            </button>

            {/* Clean TV Full View Toggle */}
            {screenMode === 'audience' && (
              <button
                onClick={() => setIsTvCleanMode(true)}
                title="إخفاء الشريط العلوي للعرض التلفزيوني الكامل"
                className="rounded-xl border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-white"
              >
                وضع التلفزيون الكامل 📺
              </button>
            )}

            {/* Reset Game Button */}
            <button
              onClick={resetGame}
              title="تصفير اللعبة وبدء مباراة جديدة"
              className="rounded-xl border border-red-500/30 bg-red-950/40 px-2.5 py-1.5 text-xs font-medium text-red-300 hover:bg-red-900/60 transition-colors"
            >
              تصفير ↺
            </button>
          </div>
        </nav>
      ) : (
        /* Discreet button to unhide bar in TV mode */
        <button
          onClick={() => setIsTvCleanMode(false)}
          className="fixed top-2 left-2 z-50 rounded-lg bg-black/40 hover:bg-black/80 px-2.5 py-1 text-[11px] text-slate-400 hover:text-white backdrop-blur-sm transition-all opacity-25 hover:opacity-100"
        >
          ⚙️ إظهار الشريط
        </button>
      )}

      {/* Screen Views */}
      {screenMode === 'audience' ? (
        <AudienceScreen
          state={gameState}
          onOpenControllerTab={() => setScreenMode('host')}
          onRestartGame={resetGame}
          onDismissGameOver={dismissGameOver}
        />
      ) : (
        <HostController
          state={gameState}
          updateState={updateState}
          triggerSound={triggerSound}
          onOpenConnectModal={() => setShowConnectModal(true)}
          onSwitchToAudience={() => setScreenMode('audience')}
        />
      )}

      {/* Two Devices Connect Modal */}
      <DeviceConnectModal
        isOpen={showConnectModal}
        onClose={() => setShowConnectModal(false)}
        roomId={roomId}
        onRoomChange={handleRoomChange}
      />
    </div>
  );
}
