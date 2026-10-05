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
      if (msg.type === 'STATE_UPDATE' && msg.state) {
        setGameState((prev) => {
          // Avoid echoing / re-rendering if update is older than or equal to current state
          if (msg.state.lastUpdated && prev.lastUpdated && msg.state.lastUpdated <= prev.lastUpdated) {
            return prev;
          }
          return msg.state;
        });
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

  const [isFullscreen, setIsFullscreen] = useState(false);

  // Sync fullscreen state with browser events
  useEffect(() => {
    const handleFsChange = () => {
      const active = Boolean(document.fullscreenElement);
      setIsFullscreen(active);
      if (!active && !isTvCleanMode) {
        // Exited fullscreen
      }
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    document.addEventListener('webkitfullscreenchange', handleFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
      document.removeEventListener('webkitfullscreenchange', handleFsChange);
    };
  }, [isTvCleanMode]);

  // Enter or exit true browser fullscreen (hides Google search bar & tabs)
  const handleToggleFullscreen = async (forceEnter?: boolean) => {
    try {
      const elem = document.documentElement as HTMLElement & {
        webkitRequestFullscreen?: () => Promise<void>;
        mozRequestFullScreen?: () => Promise<void>;
        msRequestFullscreen?: () => Promise<void>;
      };
      const doc = document as Document & {
        webkitExitFullscreen?: () => Promise<void>;
        mozCancelFullScreen?: () => Promise<void>;
        msExitFullscreen?: () => Promise<void>;
      };

      const shouldEnter = forceEnter !== undefined ? forceEnter : !document.fullscreenElement;

      if (shouldEnter) {
        setIsTvCleanMode(true);
        if (elem.requestFullscreen) {
          await elem.requestFullscreen();
        } else if (elem.webkitRequestFullscreen) {
          await elem.webkitRequestFullscreen();
        } else if (elem.mozRequestFullScreen) {
          await elem.mozRequestFullScreen();
        } else if (elem.msRequestFullscreen) {
          await elem.msRequestFullscreen();
        }
      } else {
        setIsTvCleanMode(false);
        if (document.fullscreenElement) {
          if (doc.exitFullscreen) {
            await doc.exitFullscreen();
          } else if (doc.webkitExitFullscreen) {
            await doc.webkitExitFullscreen();
          } else if (doc.mozCancelFullScreen) {
            await doc.mozCancelFullScreen();
          } else if (doc.msExitFullscreen) {
            await doc.msExitFullscreen();
          }
        }
      }
    } catch (err) {
      console.warn('Browser fullscreen error:', err);
      // Fallback: still clean UI
      setIsTvCleanMode(true);
    }
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
                onClick={() => handleToggleFullscreen(true)}
                title="إخفاء شريط العنوان وسيرش جوجل وتشغيل وضع ملء الشاشة الكامل"
                className="flex items-center gap-1.5 rounded-xl border border-amber-400/80 bg-gradient-to-r from-amber-500/30 to-amber-600/30 px-3 py-1.5 text-xs font-bold text-amber-200 hover:brightness-125 hover:text-white shadow-[0_0_12px_rgba(245,158,11,0.25)] transition-all"
              >
                <span>⛶</span>
                <span>وضع التلفزيون الكامل (ملء الشاشة)</span>
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
        /* Discreet floating buttons in TV mode */
        <div className="fixed top-2 left-2 z-50 flex items-center gap-2 opacity-25 hover:opacity-100 transition-opacity">
          <button
            onClick={() => handleToggleFullscreen(false)}
            className="flex items-center gap-1 rounded-lg bg-black/60 hover:bg-black/90 px-2.5 py-1 text-[11px] font-bold text-amber-300 hover:text-white backdrop-blur-md transition-all shadow"
          >
            <span>⛶</span>
            <span>خروج من ملء الشاشة</span>
          </button>
          <button
            onClick={() => setIsTvCleanMode(false)}
            className="rounded-lg bg-black/60 hover:bg-black/90 px-2.5 py-1 text-[11px] text-slate-300 hover:text-white backdrop-blur-md transition-all shadow"
          >
            ⚙️ إظهار الشريط
          </button>
        </div>
      )}

      {/* Screen Views */}
      {screenMode === 'audience' ? (
        <AudienceScreen
          state={gameState}
          onOpenControllerTab={() => setScreenMode('host')}
          onRestartGame={resetGame}
          onDismissGameOver={dismissGameOver}
          onToggleFullscreen={() => handleToggleFullscreen()}
          isFullscreen={isFullscreen}
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
