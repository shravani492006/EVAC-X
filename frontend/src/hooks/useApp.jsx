import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { checkBackend, getPlayerName, setPlayerName as persistName } from '../services/api.js';
import { sound } from '../engine/audio.js';

const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

/** Global app state: routing, backend mode (online/demo), player name, last result, sound. */
export function AppProvider({ children }) {
  const [page, setPage] = useState('landing');
  const [levelId, setLevelId] = useState('training');
  const [mode, setMode] = useState('checking');      // 'checking' | 'online' | 'demo'
  const [playerName, setName] = useState(getPlayerName());
  const [lastResult, setLastResult] = useState(null);
  const [muted, setMutedState] = useState(sound.muted);
  const [transition, setTransition] = useState(false);

  useEffect(() => { checkBackend().then(setMode); }, []);
  const retryBackend = useCallback(() => { setMode('checking'); checkBackend().then(setMode); }, []);

  const go = useCallback((p, extra) => {
    sound.play('click');
    setTransition(true);
    setTimeout(() => { if (extra && extra.levelId) setLevelId(extra.levelId); setPage(p); window.scrollTo(0, 0); setTransition(false); }, 180);
  }, []);
  const setPlayerName = (n) => { const v = n.toUpperCase().slice(0, 14); setName(v); persistName(v); };
  const toggleMute = () => { sound.setMuted(!muted); setMutedState(!muted); };

  const value = useMemo(() => ({ page, go, levelId, setLevelId, mode, retryBackend, playerName, setPlayerName, lastResult, setLastResult, muted, toggleMute, transition }),
    [page, go, levelId, mode, retryBackend, playerName, lastResult, muted, transition]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
