import { Linking, Platform } from "react-native";
import type { MusicQuizLibraryEntry } from "./data";

export type SpotifyTrackPreview = {
  spotifyUrl: string;
  spotifyTrackId: string;
  songTitle: string;
  artistName: string;
  coverImageUrl: string | null;
  artistSpotifyUrl: string;
};

function normalizeSpotifyUrl(input: string) {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error("Enter a Spotify track link");
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error("Enter a valid Spotify track link");
  }

  const hostname = url.hostname.toLowerCase();
  if (!hostname.includes("spotify.com") && !hostname.includes("spotify.link")) {
    throw new Error("Paste a Spotify track link");
  }

  return trimmed;
}

function parseTrackIdFromUrl(input: string) {
  const normalized = normalizeSpotifyUrl(input);
  const trackMatch = normalized.match(/track\/([A-Za-z0-9]+)/i);
  if (!trackMatch?.[1]) {
    throw new Error("That link does not look like a Spotify track");
  }
  return { normalized, trackId: trackMatch[1] };
}

export async function loadSpotifyTrackPreview(input: string | MusicQuizLibraryEntry): Promise<SpotifyTrackPreview> {
  const sourceUrl = typeof input === "string" ? input : input.spotifyUrl;
  const { normalized, trackId } = parseTrackIdFromUrl(sourceUrl);
  const oembedUrl = `https://open.spotify.com/oembed?url=${encodeURIComponent(normalized)}`;
  const response = await fetch(oembedUrl);
  if (!response.ok) {
    throw new Error("Could not load that Spotify track");
  }

  const data = (await response.json()) as {
    title?: string;
    author_name?: string;
    thumbnail_url?: string;
  };

  const songTitle = typeof input === "string" ? (data.title ?? "").replace(/\s*\|\s*Spotify\s*$/i, "").trim() : input.songTitle.trim();
  const artistName = typeof input === "string" ? (data.author_name?.trim() || "Unknown artist") : input.artistName.trim();

  if (!songTitle) {
    throw new Error("Could not read the song title from Spotify");
  }

  return {
    spotifyUrl: normalized,
    spotifyTrackId: typeof input === "string" ? trackId : input.spotifyTrackId,
    songTitle,
    artistName: artistName || "Unknown artist",
    coverImageUrl: data.thumbnail_url ?? null,
    artistSpotifyUrl: typeof input === "string" ? `https://open.spotify.com/search/${encodeURIComponent(artistName || "Unknown artist")}` : input.artistSpotifyUrl,
  };
}

/**
 * Opens a track in the Spotify app (web player on computers, or when the app is missing),
 * so the host can play it for the room.
 */
export async function openSpotifyTrack(trackId: string, webUrl: string): Promise<void> {
  const appUrl = `spotify:track:${trackId}`;

  if (Platform.OS === "web") {
    const visibleDocument = typeof document !== "undefined" ? document : null;
    const visibleWindow = typeof window !== "undefined" ? window : null;

    if (!visibleWindow) return Linking.openURL(webUrl);

    // On a computer there is no Spotify app hand-off: open the web player in a new
    // tab so the host keeps the game open (still inside the click, so it isn't blocked).
    const isPhone = typeof navigator !== "undefined" && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (!isPhone) {
      visibleWindow.open(webUrl, "_blank", "noopener");
      return;
    }

    return new Promise<void>((resolve) => {
      let finished = false;
      const cleanup = () => {
        if (visibleDocument) visibleDocument.removeEventListener("visibilitychange", handleVisibilityChange);
      };
      const finish = () => {
        if (finished) return;
        finished = true;
        cleanup();
        resolve();
      };
      const handleVisibilityChange = () => {
        if (visibleDocument?.hidden) finish();
      };

      if (visibleDocument) visibleDocument.addEventListener("visibilitychange", handleVisibilityChange, { once: true });

      visibleWindow.location.href = appUrl;

      visibleWindow.setTimeout(() => {
        if (!visibleDocument?.hidden) {
          visibleWindow.location.href = webUrl;
        }
        finish();
      }, 900);
    });
  }

  if (await Linking.canOpenURL(appUrl)) return Linking.openURL(appUrl);
  return Linking.openURL(webUrl);
}
