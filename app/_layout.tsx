
/*

import { Stack } from "expo-router";

export default function RootLayout() {
  return <Stack screenOptions={{ headerShown: true }} />;
}
*/


/* ----------UTAN WHITEBAR-------*/

import { Stack } from "expo-router";
import { PWAInstall } from "../src/lib/pwa-install";

export default function Layout() {
  return (
    <PWAInstall>
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      />
    </PWAInstall>
  );
}
 
