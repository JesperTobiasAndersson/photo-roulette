import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, Text } from "react-native";

export function CopyToast({ visible, message = "Invitation link copied" }: { visible: boolean; message?: string }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-4)).current;
  const [isMounted, setIsMounted] = useState(visible);

  useEffect(() => {
    if (visible) {
      setIsMounted(true);
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 180,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 220,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
      return;
    }

    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: 180,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: -3,
        duration: 180,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        setIsMounted(false);
      }
    });
  }, [opacity, translateY, visible]);

  if (!isMounted) return null;

  return (
    <Animated.View
      style={{
        alignItems: "center",
        marginTop: 8,
        opacity,
        transform: [{ translateY }],
      }}
    >
      <Animated.View
        style={{
          minHeight: 34,
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: 999,
          backgroundColor: "rgba(15,23,42,0.96)",
          borderWidth: 1,
          borderColor: "#334155",
        }}
      >
        <Text style={{ color: "#F8FAFC", fontWeight: "900", fontSize: 12, textAlign: "center" }}>{message}</Text>
      </Animated.View>
    </Animated.View>
  );
}
