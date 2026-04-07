import { useState } from "react";
import { Platform, Pressable, Text } from "react-native";
import * as Clipboard from "expo-clipboard";
import { CopyToast } from "./CopyToast";

type ShareButtonProps = {
  label: string;
  message: string;
  accentColor: string;
};

export function ShareButton({ label, message, accentColor }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  const handlePress = async () => {
    if (Platform.OS !== "web" || typeof window === "undefined") {
      await Clipboard.setStringAsync(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      return;
    }

    try {
      if (navigator.share) {
        await navigator.share({ text: message, url: window.location.href });
      } else {
        await Clipboard.setStringAsync(message);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      await Clipboard.setStringAsync(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <>
      <Pressable
        onPress={handlePress}
        style={({ pressed }) => ({
          minHeight: 52,
          borderRadius: 16,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#020617",
          borderWidth: 1,
          borderColor: accentColor,
          opacity: pressed ? 0.92 : 1,
          paddingHorizontal: 16,
        })}
      >
        <Text style={{ color: "white", fontWeight: "900", fontSize: 14, textTransform: "uppercase" }}>{label}</Text>
      </Pressable>
      <CopyToast visible={copied} />
    </>
  );
}
