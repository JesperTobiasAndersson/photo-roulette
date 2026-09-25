import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";

const KEY = "picklo_player_name";

/** Remembers the last name the player used so they don't retype it for every game. */
export function useRememberedName(): [string, (name: string) => void, () => void] {
  const [name, setName] = useState("");

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(KEY)
      .then((saved) => {
        if (!cancelled && saved) setName((current) => current || saved);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const persist = () => {
    const trimmed = name.trim();
    if (trimmed) AsyncStorage.setItem(KEY, trimmed).catch(() => undefined);
  };

  return [name, setName, persist];
}
