import { Alert } from "react-native";

export async function showEndOfGameAd(): Promise<void> {
  // Mock: visa popup istället för riktig ad
  await new Promise<void>((resolve) => {
    Alert.alert("Annons (mock)", "Här hade en interstitial visats.", [{ text: "OK", onPress: () => resolve() }]);
  });
}
