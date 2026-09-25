import { Alert, Platform } from "react-native";

// React Native Web's Alert.alert is a no-op, so on web every error message was silently dropped.
// These helpers fall back to the browser's native dialogs there.

const isWeb = Platform.OS === "web";

export function showAlert(title: string, message?: string) {
  if (isWeb) {
    if (typeof window !== "undefined") window.alert(message ? `${title}\n\n${message}` : title);
    return;
  }
  Alert.alert(title, message);
}

export function confirmAction(
  title: string,
  message: string,
  options: { confirmLabel: string; cancelLabel: string; destructive?: boolean },
): Promise<boolean> {
  if (isWeb) {
    if (typeof window === "undefined") return Promise.resolve(false);
    return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  }
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: options.cancelLabel, style: "cancel", onPress: () => resolve(false) },
        {
          text: options.confirmLabel,
          style: options.destructive ? "destructive" : "default",
          onPress: () => resolve(true),
        },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}
