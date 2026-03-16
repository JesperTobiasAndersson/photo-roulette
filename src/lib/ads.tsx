import React, { useEffect, useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";

const isWeb = Platform.OS === "web";
const CONSENT_KEY = "picklo_ads_consent";
const ADSENSE_CLIENT = process.env.EXPO_PUBLIC_ADSENSE_CLIENT;
const ADSENSE_SLOT = process.env.EXPO_PUBLIC_ADSENSE_SLOT;

let AdSense: any = null;
try {
  AdSense = require("react-adsense").AdSense;
} catch (error) {
  console.warn("AdSense library not available:", error);
}

function getStoredConsent(): boolean {
  if (!isWeb || typeof window === "undefined") return false;
  return window.localStorage.getItem(CONSENT_KEY) === "accepted";
}

function setStoredConsent(value: "accepted" | "declined") {
  if (!isWeb || typeof window === "undefined") return;
  window.localStorage.setItem(CONSENT_KEY, value);
}

export const AdConsentBanner: React.FC = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isWeb || typeof window === "undefined") return;
    const saved = window.localStorage.getItem(CONSENT_KEY);
    setVisible(!saved);
  }, []);

  if (!isWeb || !visible) return null;

  return (
    <View
      style={{
        borderRadius: 20,
        padding: 14,
        backgroundColor: "#0B1222",
        borderWidth: 1,
        borderColor: "#1E293B",
        gap: 12,
      }}
    >
      <Text style={{ color: "#F8FAFC", fontSize: 15, fontWeight: "900" }}>Ads & privacy choices</Text>
      <Text style={{ color: "#CBD5E1", lineHeight: 21 }}>
        Picklo may use Google AdSense on the web. You can accept ad storage for personalized ads or decline and
        continue without ad personalization.
      </Text>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Pressable
          onPress={() => {
            setStoredConsent("accepted");
            setVisible(false);
          }}
          style={({ pressed }) => ({
            flex: 1,
            minHeight: 46,
            borderRadius: 14,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#000000",
            opacity: pressed ? 0.92 : 1,
          })}
        >
          <Text style={{ color: "white", fontWeight: "900" }}>Accept</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            setStoredConsent("declined");
            setVisible(false);
          }}
          style={({ pressed }) => ({
            flex: 1,
            minHeight: 46,
            borderRadius: 14,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#111827",
            borderWidth: 1,
            borderColor: "#1F2937",
            opacity: pressed ? 0.92 : 1,
          })}
        >
          <Text style={{ color: "#E5E7EB", fontWeight: "900" }}>Decline</Text>
        </Pressable>
      </View>
    </View>
  );
};

export const AdSenseAd: React.FC = () => {
  const [hasConsent, setHasConsent] = useState(false);

  useEffect(() => {
    setHasConsent(getStoredConsent());
  }, []);

  if (!isWeb || !hasConsent) return null;
  if (!ADSENSE_CLIENT || !ADSENSE_SLOT || ADSENSE_SLOT === "XXXXXXXXXX") return null;
  if (!AdSense || !AdSense.Google) return null;

  try {
    return (
      <AdSense.Google
        client={ADSENSE_CLIENT}
        slot={ADSENSE_SLOT}
        style={{ display: "block" }}
        format="auto"
        responsive="true"
      />
    );
  } catch (error) {
    console.error("AdSense component error:", error);
    return null;
  }
};
