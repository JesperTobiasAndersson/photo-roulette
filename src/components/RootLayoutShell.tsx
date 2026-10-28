import { Stack } from "expo-router";
import { Platform, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { PWAInstall } from "../lib/pwa-install";
import { LanguageProvider } from "../lib/i18n";
import { inject } from "@vercel/analytics";

// Anonymous visitor statistics (Vercel Web Analytics): no cookies, no personal data, so it needs
// no consent. Room and player ids are stripped from the tracked addresses. (Ad consent for
// AdSense is handled by Google's own consent message, loaded with the script in index.html.)
if (Platform.OS === "web" && typeof window !== "undefined") {
  inject({
    beforeSend: (event) => ({ ...event, url: event.url.split("?")[0] }),
  });
}

export function RootLayoutShell() {
  return (
    <SafeAreaProvider>
      <LanguageProvider>
        <View style={{ flex: 1, backgroundColor: "#070B14" }}>
          <PWAInstall>
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: "#070B14" },
                animation: Platform.OS === "ios" ? "fade_from_bottom" : "slide_from_right",
              }}
            />
          </PWAInstall>
        </View>
      </LanguageProvider>
    </SafeAreaProvider>
  );
}
