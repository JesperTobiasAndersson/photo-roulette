import React, { useEffect, useMemo, useState } from "react";
import { View, Text, Platform, Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useI18n } from "./i18n";
import { Button, IconButton } from "../ui/components";
import { colors, radius, space } from "../ui/theme";

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface PWAInstallProps {
  children?: React.ReactNode;
}

const DISMISS_KEY = "picklo_install_banner_dismissed";
const VISITS_KEY = "picklo_visits";
/** Don't nag first-time visitors who came from an invite link; ask once they come back. */
const MIN_VISITS_BEFORE_PROMPT = 2;

function isStandaloneMode() {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(display-mode: standalone)")?.matches || (window.navigator as any)?.standalone === true;
}

function readStorage(key: string) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // private mode / storage disabled: the banner simply shows again next time
  }
}

function countVisit(): number {
  const visits = Number(readStorage(VISITS_KEY) ?? "0") + 1;
  writeStorage(VISITS_KEY, String(visits));
  return visits;
}

export const PWAInstall: React.FC<PWAInstallProps> = ({ children }) => {
  const isWeb = Platform.OS === "web";
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstall, setShowInstall] = useState(false);

  const installContext = useMemo(() => {
    if (!isWeb || typeof navigator === "undefined") {
      return { isMobile: false, isIosSafari: false };
    }
    const ua = navigator.userAgent;
    const isIos = /iPhone|iPad|iPod/i.test(ua);
    const isSafari = /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua);
    return {
      isMobile: /Android|iPhone|iPad|iPod/i.test(ua),
      isIosSafari: isIos && isSafari,
    };
  }, [isWeb]);

  useEffect(() => {
    if (!isWeb || !installContext.isMobile || typeof window === "undefined") return;
    if (isStandaloneMode()) return;
    if (readStorage(DISMISS_KEY) === "1") return;

    const eligible = countVisit() >= MIN_VISITS_BEFORE_PROMPT;

    if (installContext.isIosSafari) {
      if (eligible) setShowInstall(true);
      return;
    }

    const handleBeforeInstallPrompt = (event: BeforeInstallPromptEvent) => {
      event.preventDefault();
      setDeferredPrompt(event);
      if (eligible) setShowInstall(true);
    };

    const handleAppInstalled = () => {
      setShowInstall(false);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, [installContext.isIosSafari, installContext.isMobile, isWeb]);

  const dismiss = () => {
    if (typeof window !== "undefined") writeStorage(DISMISS_KEY, "1");
    setShowInstall(false);
  };

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setShowInstall(false);
    setDeferredPrompt(null);
  };

  const shouldShowIosInstructions = installContext.isIosSafari && showInstall;
  const shouldShowAndroidPrompt = !installContext.isIosSafari && !!deferredPrompt && showInstall;

  if (!isWeb || (!shouldShowIosInstructions && !shouldShowAndroidPrompt)) {
    return <>{children}</>;
  }

  return (
    <>
      {children}
      <View
        accessibilityRole="alert"
        style={{
          position: "fixed" as any,
          left: space.md,
          right: space.md,
          bottom: Math.max(insets.bottom, space.md),
          maxWidth: 520,
          alignSelf: "center",
          marginHorizontal: "auto" as any,
          backgroundColor: colors.surfaceRaised,
          borderRadius: radius.lg,
          padding: space.md,
          borderWidth: 1,
          borderColor: colors.borderStrong,
          shadowColor: "#000",
          shadowOpacity: 0.4,
          shadowRadius: 20,
          shadowOffset: { width: 0, height: 10 },
          zIndex: 1000,
          flexDirection: "row",
          alignItems: "center",
          gap: space.md,
        }}
      >
        <Image source={require("../../assets/icon.png")} style={{ width: 44, height: 44, borderRadius: 12 }} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ color: colors.text, fontSize: 15, fontWeight: "800" }}>{t("pwa.title")}</Text>
          <Text style={{ color: colors.textMuted, fontSize: 13, lineHeight: 18 }}>
            {shouldShowIosInstructions ? t("pwa.ios") : t("pwa.body")}
          </Text>
        </View>
        {shouldShowAndroidPrompt ? <Button label={t("pwa.install")} onPress={handleInstall} size="sm" /> : null}
        <IconButton icon="close" onPress={dismiss} accessibilityLabel={t("pwa.not_now")} color={colors.textMuted} />
      </View>
    </>
  );
};
