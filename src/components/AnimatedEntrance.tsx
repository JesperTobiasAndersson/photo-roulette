import React, { useEffect, useRef } from "react";
import { Animated, type StyleProp, type ViewStyle } from "react-native";

type AnimatedEntranceProps = {
  children: React.ReactNode;
  delay?: number;
  distance?: number;
  duration?: number;
  enterKey?: string | number;
  style?: StyleProp<ViewStyle>;
};

export function AnimatedEntrance({
  children,
  delay = 0,
  distance = 14,
  duration = 260,
  enterKey,
  style,
}: AnimatedEntranceProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(distance)).current;

  useEffect(() => {
    opacity.setValue(0);
    translateY.setValue(distance);

    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration,
        delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, [delay, distance, duration, enterKey, opacity, translateY]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
