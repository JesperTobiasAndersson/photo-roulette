import { Linking, Platform } from "react-native";

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
