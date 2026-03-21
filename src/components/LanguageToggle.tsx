import React from "react";
import { Image, Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useI18n } from "../lib/i18n";

const FLAG_IMAGES = {
  sv: require("../../assets/se.png"),
  en: require("../../assets/en.png"),
} as const;

export function LanguageToggle() {
  const { language, setLanguage } = useI18n();

  return (
    <SafeAreaView
      pointerEvents="box-none"
      edges={["top", "right"]}
      style={{
        position: "absolute",
        top: 0,
        right: 0,
        zIndex: 2000,
      }}
    >
      <View
        style={{
          paddingTop: 8,
          paddingRight: 22,
          alignItems: "flex-end",
        }}
      >
        <View
          style={{
            flexDirection: "row",
            backgroundColor: "rgba(8,17,31,0.94)",
            borderRadius: 18,
            borderWidth: 1,
            borderColor: "#1E293B",
            paddingHorizontal: 5,
            paddingVertical: 5,
            gap: 4,
            alignItems: "center",
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
                  width: 42,
                  height: 36,
                  borderRadius: 14,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: active ? "#0369A1" : "#111827",
                  opacity: pressed ? 0.92 : 1,
                })}
              >
                <Image source={FLAG_IMAGES[option]} style={{ width: 22, height: 22, borderRadius: 999 }} resizeMode="cover" />
              </Pressable>
            );
          })}
        </View>
      </View>
    </SafeAreaView>
  );
}
