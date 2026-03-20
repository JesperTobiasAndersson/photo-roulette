import { Stack } from "expo-router";
import { Platform, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { PWAInstall } from "../lib/pwa-install";

export function RootLayoutShell() {
  return (
    <SafeAreaProvider>
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
    </SafeAreaProvider>
  );
}
