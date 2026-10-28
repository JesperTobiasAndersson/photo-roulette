import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useRef, useState } from "react";

const PREFIX = "picklo_local_game_";

/**
 * State for a one-phone ("pass the phone") game. Everything lives on this device; it is
 * saved after every change so a reload, or a trip to Spotify and back, continues the game.
 * `state` is null until the saved game has been read (`loaded`) and when no game is running.
 */
export function useLocalGame<T>(key: string) {
  const storageKey = PREFIX + key;
  const [state, setStateRaw] = useState<T | null>(null);
  const [loaded, setLoaded] = useState(false);
  const latest = useRef<T | null>(null);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(storageKey)
      .then((saved) => {
        if (cancelled || !saved) return;
        const parsed = JSON.parse(saved) as T;
        latest.current = parsed;
        setStateRaw(parsed);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [storageKey]);

  const setState = useCallback(
    (next: T | null | ((current: T) => T)) => {
      const value = typeof next === "function" ? (latest.current ? (next as (current: T) => T)(latest.current) : null) : next;
      latest.current = value;
      setStateRaw(value);
      if (value === null) AsyncStorage.removeItem(storageKey).catch(() => undefined);
      else AsyncStorage.setItem(storageKey, JSON.stringify(value)).catch(() => undefined);
    },
    [storageKey]
  );

  return { state, setState, loaded };
}

/** Fisher–Yates shuffle that returns a new array. */
export function shuffled<T>(items: T[]) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Simple ids for players that only exist on this phone. */
export const localPlayerId = (index: number) => `p${index + 1}`;
