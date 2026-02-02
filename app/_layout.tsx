
/*

import { Stack } from "expo-router";

export default function RootLayout() {
  return <Stack screenOptions={{ headerShown: true }} />;
}
*/


/* ----------UTAN WHITEBAR-------*/

import { Stack } from "expo-router";

export default function Layout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    />
  );
}
 
