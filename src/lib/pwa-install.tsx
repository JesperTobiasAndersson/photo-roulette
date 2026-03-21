import React, { useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, Platform } from "react-native";
import { useI18n } from "./i18n";

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

function isStandaloneMode() {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(display-mode: standalone)")?.matches || (window.navigator as any)?.standalone === true;
}

export const PWAInstall: React.FC<PWAInstallProps> = ({ children }) => {
  const isWeb = Platform.OS === "web";
  const { t } = useI18n();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstall, setShowInstall] = useState(false);

  const installContext = useMemo(() => {
    if (!isWeb || typeof navigator === "undefined") {
      return {
        isMobile: false,
        isIosSafari: false,
      };
    }

    const ua = navigator.userAgent;
    const isMobile = /Android|iPhone|iPad|iPod/i.test(ua);
    const isIos = /iPhone|iPad|iPod/i.test(ua);
    const isSafari = /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua);

    return {
      isMobile,
      isIosSafari: isIos && isSafari,
    };
  }, [isWeb]);

  useEffect(() => {
    if (!isWeb || !installContext.isMobile || typeof window === "undefined") return;
    if (isStandaloneMode()) return;
    if (window.localStorage.getItem(DISMISS_KEY) === "1") return;

    if (installContext.isIosSafari) {
      setShowInstall(true);
      return;
    }

    const handleBeforeInstallPrompt = (event: BeforeInstallPromptEvent) => {
      event.preventDefault();
      setDeferredPrompt(event);
      setShowInstall(true);
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
    if (typeof window !== "undefined") {
      window.localStorage.setItem(DISMISS_KEY, "1");
    }
    setShowInstall(false);
  };

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setShowInstall(false);
    }
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
        style={{
          position: "fixed" as any,
          left: 16,
          right: 16,
          bottom: 16,
          backgroundColor: "#0F172A",
          borderRadius: 20,
          padding: 16,
          borderWidth: 1,
          borderColor: "#1E293B",
          shadowColor: "#000",
          shadowOpacity: 0.28,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 10 },
          zIndex: 1000,
          gap: 12,
        }}
      >
        <Text style={{ color: "#F8FAFC", fontSize: 16, fontWeight: "900", textAlign: "center" }}>{t("pwa.title")}</Text>

        {shouldShowIosInstructions ? (
          <Text style={{ color: "#CBD5E1", fontSize: 14, lineHeight: 21, textAlign: "center" }}>{t("pwa.ios")}</Text>
        ) : (
          <Text style={{ color: "#CBD5E1", fontSize: 14, lineHeight: 21, textAlign: "center" }}>{t("pwa.body")}</Text>
        )}

        <View style={{ flexDirection: "row", gap: 10 }}>
          {shouldShowAndroidPrompt ? (
            <Pressable
              onPress={handleInstall}
              style={({ pressed }) => ({
                flex: 1,
                minHeight: 48,
                borderRadius: 14,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "#000000",
                opacity: pressed ? 0.92 : 1,
              })}
            >
              <Text style={{ color: "white", fontWeight: "900" }}>{t("pwa.install")}</Text>
            </Pressable>
          ) : (
            <View style={{ flex: 1, minHeight: 48, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#111827", borderWidth: 1, borderColor: "#1F2937" }}>
              <Text style={{ color: "#E5E7EB", fontWeight: "900" }}>{t("pwa.safari")}</Text>
            </View>
          )}

          <Pressable
            onPress={dismiss}
            style={({ pressed }) => ({
              flex: 1,
              minHeight: 48,
              borderRadius: 14,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "#111827",
              borderWidth: 1,
              borderColor: "#1F2937",
              opacity: pressed ? 0.92 : 1,
            })}
          >
            <Text style={{ color: "#E5E7EB", fontWeight: "900" }}>{t("pwa.not_now")}</Text>
          </Pressable>
        </View>
      </View>
    </>
  );
};
