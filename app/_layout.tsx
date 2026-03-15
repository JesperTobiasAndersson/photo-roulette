
/*

import { Stack } from "expo-router";

export default function RootLayout() {
  return <Stack screenOptions={{ headerShown: true }} />;
}
*/


/* ----------UTAN WHITEBAR-------*/

import { Stack } from "expo-router";
import { PWAInstall } from "../src/lib/pwa-install";
import { View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

export default function Layout() {
  return (
    <SafeAreaProvider>
      <View style={{ flex: 1, backgroundColor: "#070B14" }}>
        <PWAInstall>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: "#070B14" },
            }}
          />
        </PWAInstall>
      </View>
    </SafeAreaProvider>
  );
}
 
