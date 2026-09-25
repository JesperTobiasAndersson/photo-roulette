import { useState } from "react";
import { Platform, Share, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { Button } from "../ui/components";
import { CopyToast } from "./CopyToast";

type ShareButtonProps = {
  label: string;
  message: string;
  /** Link to share; defaults to the current page on web. */
  url?: string;
  accentColor?: string;
  variant?: "primary" | "secondary" | "ghost";
  size?: "lg" | "md" | "sm";
};

/** Opens the phone's share sheet (WhatsApp, Messenger, Snapchat…) and falls back to copying the text. */
export function ShareButton({ label, message, url, accentColor, variant = "secondary", size = "md" }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await Clipboard.setStringAsync(url && !message.includes(url) ? `${message} ${url}` : message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePress = async () => {
    try {
      if (Platform.OS === "web") {
        if (typeof navigator !== "undefined" && navigator.share) {
          await navigator.share({ text: message, url: url ?? window.location.href });
          return;
        }
        await copy();
        return;
      }
      await Share.share({ message: url && !message.includes(url) ? `${message} ${url}` : message });
    } catch (error) {
      // The user closing the share sheet throws AbortError; only fall back for real failures.
      if ((error as Error)?.name !== "AbortError") await copy();
    }
  };

  return (
    <View>
      <Button label={label} onPress={handlePress} variant={variant} size={size} icon="share-outline" accent={accentColor} />
      <CopyToast visible={copied} />
    </View>
  );
}
