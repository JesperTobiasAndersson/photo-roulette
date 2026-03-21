import { Stack } from "expo-router";
import { Platform, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { LanguageToggle } from "./LanguageToggle";
import { PWAInstall } from "../lib/pwa-install";
import { LanguageProvider } from "../lib/i18n";

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
            <LanguageToggle />
          </PWAInstall>
        </View>
      </LanguageProvider>
    </SafeAreaProvider>
  );
}
