import React from "react";
import { Image, Platform, Pressable, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useI18n } from "../lib/i18n";

const FLAG_IMAGES = {
  sv: require("../../assets/se.png"),
  en: require("../../assets/en.png"),
} as const;

export function LanguageToggle() {
  const { language, setLanguage } = useI18n();
  const { width } = useWindowDimensions();
  const isMobileLayout = Platform.OS !== "web" || width < 760;

  return (
    <SafeAreaView
      pointerEvents="box-none"
      edges={isMobileLayout ? ["right", "bottom"] : ["top", "right"]}
      style={{
        position: "absolute",
        top: isMobileLayout ? undefined : 0,
        right: 0,
        bottom: isMobileLayout ? 0 : undefined,
        zIndex: 2000,
      }}
    >
      <View
        style={{
          paddingTop: isMobileLayout ? 0 : 8,
          paddingRight: isMobileLayout ? 12 : 22,
          paddingBottom: isMobileLayout ? 12 : 0,
          alignItems: "flex-end",
        }}
      >
        <View
          style={{
            flexDirection: "row",
            backgroundColor: "rgba(8,17,31,0.94)",
            borderRadius: isMobileLayout ? 16 : 18,
            borderWidth: 1,
            borderColor: "#1E293B",
            paddingHorizontal: isMobileLayout ? 4 : 5,
            paddingVertical: isMobileLayout ? 4 : 5,
            gap: 4,
            alignItems: "center",
            shadowColor: "#020617",
            shadowOpacity: 0.18,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 6 },
            elevation: 8,
          }}
        >
          {(["sv", "en"] as const).map((option) => {
            const active = language === option;
            return (
              <Pressable
                key={option}
                onPress={() => setLanguage(option)}
                hitSlop={6}
                style={({ pressed }) => ({
                  width: isMobileLayout ? 38 : 42,
                  height: isMobileLayout ? 34 : 36,
                  borderRadius: isMobileLayout ? 12 : 14,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: active ? "#0369A1" : "#111827",
                  opacity: pressed ? 0.92 : 1,
                })}
              >
                <Image
                  source={FLAG_IMAGES[option]}
                  style={{ width: isMobileLayout ? 20 : 22, height: isMobileLayout ? 20 : 22, borderRadius: 999 }}
                  resizeMode="cover"
                />
              </Pressable>
            );
          })}
        </View>
      </View>
    </SafeAreaView>
  );
}
