import { useEffect, useCallback } from 'react';
import { useAppStore, api } from '@/store';

/**
 * Debug Mode Hook:
 * When mouse cursor is inside window and user presses digit 0
 * five times within 3 seconds -> toggle debug mode
 * 
 * On enter: save snapshot to backend
 * On exit: restore snapshot from backend, reset time offset
 */
export function useDebugMode() {
  const { debugMode, setDebugMode, setDebugTimeOffset } = useAppStore();

  const toggleDebugMode = useCallback(async () => {
    const newMode = !useAppStore.getState().debugMode;
    if (newMode) {
      try {
        await api('/debug/snapshot', { method: 'POST' });
      } catch {}
    } else {
      try {
        await api('/debug/restore', { method: 'POST' });
      } catch {}
      setDebugTimeOffset(0);
    }
    setDebugMode(newMode);
  }, [setDebugMode, setDebugTimeOffset]);

  useEffect(() => {
    let pressTimes: number[] = [];
    let mouseInside = false;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!mouseInside) return;
      if (e.key !== '0' && e.key !== 'Numpad0') return;

      const now = Date.now();
      pressTimes.push(now);
      pressTimes = pressTimes.filter(t => now - t <= 3000);

      if (pressTimes.length >= 5) {
        toggleDebugMode();
        pressTimes = [];
      }
    };

    const handleMouseEnter = () => { mouseInside = true; };
    const handleMouseLeave = () => { mouseInside = false; };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mouseenter', handleMouseEnter);
    document.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mouseenter', handleMouseEnter);
      document.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [toggleDebugMode]);
}