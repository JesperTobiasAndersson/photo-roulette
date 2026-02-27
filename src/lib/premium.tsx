import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "picklo_is_premium";

export async function getIsPremium(): Promise<boolean> {
  const v = await AsyncStorage.getItem(KEY);
  return v === "1";
}

export async function setIsPremium(value: boolean): Promise<void> {
  await AsyncStorage.setItem(KEY, value ? "1" : "0");
}
