import React from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useI18n } from "../lib/i18n";
import { colors, contentMaxWidth, radius, space, touch, type, webInputReset, withAlpha } from "./theme";
import { QRCode } from "./QRCode";

export type IconName = React.ComponentProps<typeof Ionicons>["name"];

function isLightColor(hex: string) {
  const h = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b) > 0.35;
}

/** Text colour that stays readable on top of `accent`. */
export function onAccent(accent: string) {
  return isLightColor(accent) ? "#04111D" : "#FFFFFF";
}

// ---------------------------------------------------------------------------
// Screen: safe-area aware page with an optional top bar and a sticky footer.
// ---------------------------------------------------------------------------

type ScreenProps = {
  children: React.ReactNode;
  topBar?: React.ReactNode;
  /** Pinned to the bottom, inside thumb reach, above the home indicator. */
  footer?: React.ReactNode;
  scroll?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  /** Vertically centres short content (entry/join screens). */
  centered?: boolean;
  maxWidth?: number;
};

export function Screen({ children, topBar, footer, scroll = true, contentStyle, centered, maxWidth = contentMaxWidth }: ScreenProps) {
  const insets = useSafeAreaInsets();
  const column: ViewStyle = { width: "100%", maxWidth, alignSelf: "center" };

  const body = scroll ? (
    <ScrollView
      style={{ flex: 1 }}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      contentContainerStyle={{
        flexGrow: 1,
        paddingHorizontal: space.lg,
        paddingTop: topBar ? space.sm : space.lg,
        paddingBottom: footer ? space.lg : Math.max(insets.bottom, space.lg) + space.lg,
        justifyContent: centered ? "center" : "flex-start",
      }}
    >
      <View style={[column, { gap: space.lg }, contentStyle]}>{children}</View>
    </ScrollView>
  ) : (
    <View style={[{ flex: 1, paddingHorizontal: space.lg, paddingTop: topBar ? space.sm : space.lg }, column, contentStyle]}>
      {children}
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      enabled={Platform.OS !== "web"}
    >
      <StatusBar style="light" />
      <View style={{ height: insets.top }} />
      {topBar ? <View style={[column, { paddingHorizontal: space.md }]}>{topBar}</View> : null}
      {body}
      {footer ? (
        <View
          style={{
            borderTopWidth: 1,
            borderTopColor: colors.border,
            backgroundColor: withAlpha(colors.bg, 0.96),
            paddingHorizontal: space.lg,
            paddingTop: space.md,
            paddingBottom: Math.max(insets.bottom, space.md) + space.xs,
          }}
        >
          <View style={[column, { gap: space.sm }]}>{footer}</View>
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

// ---------------------------------------------------------------------------
// TopBar: back chevron, title, language switch.
// ---------------------------------------------------------------------------

type TopBarProps = {
  title?: string;
  /** Where the back button goes when there is no history (e.g. deep link). Omit to hide the button. */
  backHref?: string;
  onBack?: () => void;
  right?: React.ReactNode;
  showLanguage?: boolean;
};

export function goBackOr(href: string) {
  if (router.canGoBack()) router.back();
  else router.replace(href as any);
}

export function TopBar({ title, backHref, onBack, right, showLanguage = true }: TopBarProps) {
  const { t } = useI18n();
  const hasBack = !!(onBack || backHref);
  return (
    <View style={{ height: 52, flexDirection: "row", alignItems: "center", gap: space.sm }}>
      {hasBack ? (
        <IconButton
          icon="chevron-back"
          accessibilityLabel={t("common.back")}
          onPress={onBack ?? (() => goBackOr(backHref!))}
        />
      ) : null}
      <Text numberOfLines={1} style={[type.heading, { color: colors.text, flex: 1, marginLeft: hasBack ? 0 : space.xs }]}>
        {title ?? ""}
      </Text>
      {right}
      {showLanguage ? <LanguageSwitch /> : null}
    </View>
  );
}

export function IconButton({
  icon,
  onPress,
  accessibilityLabel,
  color = colors.text,
}: {
  icon: IconName;
  onPress: () => void;
  accessibilityLabel: string;
  color?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        borderRadius: radius.pill,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: pressed ? colors.surfaceRaised : "transparent",
      })}
    >
      <Ionicons name={icon} size={24} color={color} />
    </Pressable>
  );
}

const FLAGS = {
  sv: require("../../assets/se.jpg"),
  en: require("../../assets/en.jpg"),
} as const;

/** One tap switches between English and Swedish. */
export function LanguageSwitch() {
  const { language, setLanguage } = useI18n();
  const next = language === "sv" ? "en" : "sv";
  return (
    <Pressable
      onPress={() => setLanguage(next)}
      accessibilityRole="button"
      accessibilityLabel={next === "sv" ? "Byt till svenska" : "Switch to English"}
      hitSlop={6}
      style={({ pressed }) => ({
        height: 36,
        paddingHorizontal: 10,
        borderRadius: radius.pill,
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        backgroundColor: pressed ? colors.surfaceRaised : colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
      })}
    >
      <Image source={FLAGS[language]} style={{ width: 18, height: 18, borderRadius: 9 }} />
      <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: "800" }}>{language.toUpperCase()}</Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Buttons
// ---------------------------------------------------------------------------

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  accent?: string;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  size?: "lg" | "md" | "sm";
  style?: StyleProp<ViewStyle>;
};

export function Button({
  label,
  onPress,
  variant = "primary",
  accent = colors.brand,
  icon,
  loading,
  disabled,
  size = "lg",
  style,
}: ButtonProps) {
  const height = size === "lg" ? touch.primary : size === "md" ? touch.min : 40;
  const solid = variant === "primary" || variant === "danger";
  const fill =
    disabled && solid
      ? colors.surfaceRaised
      : variant === "primary"
        ? accent
        : variant === "danger"
          ? "#B91C1C"
          : variant === "secondary"
            ? colors.surface
            : "transparent";
  const fg = disabled
    ? colors.textSubtle
    : variant === "primary"
      ? onAccent(accent)
      : variant === "danger"
        ? "#FFFFFF"
        : colors.text;
  const inactive = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      style={({ pressed }) => [
        {
          minHeight: height,
          paddingHorizontal: size === "sm" ? space.md : space.lg,
          borderRadius: size === "sm" ? radius.sm : radius.md,
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "row",
          gap: space.sm,
          backgroundColor: fill,
          borderWidth: variant === "secondary" ? 1 : 0,
          borderColor: colors.border,
          opacity: disabled && !solid ? 0.5 : pressed ? 0.85 : 1,
          transform: [{ scale: pressed && !inactive ? 0.98 : 1 }],
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : icon ? (
        <Ionicons name={icon} size={size === "sm" ? 16 : 20} color={fg} />
      ) : null}
      <Text
        numberOfLines={1}
        style={{ color: fg, fontSize: size === "lg" ? 17 : size === "md" ? 15 : 14, fontWeight: "800" }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

type TextFieldProps = TextInputProps & {
  label?: string;
  error?: string | null;
  /** Big, centred, upper-case letters for room codes. */
  code?: boolean;
  accent?: string;
};

export function TextField({ label, error, code, accent = colors.brand, style, onFocus, onBlur, ...rest }: TextFieldProps) {
  const [focused, setFocused] = React.useState(false);
  return (
    <View style={{ gap: 6 }}>
      {label ? <Text style={[type.caption, { color: colors.textMuted, textTransform: "uppercase" }]}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.textSubtle}
        autoCorrect={false}
        {...(code ? { autoCapitalize: "characters" as const, maxLength: 8 } : null)}
        {...rest}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[
          {
            height: touch.primary,
            borderRadius: radius.md,
            paddingHorizontal: space.lg,
            backgroundColor: colors.sunken,
            borderWidth: 1.5,
            borderColor: error ? colors.danger : focused ? accent : colors.border,
            color: colors.text,
            // 16px+ prevents iOS Safari from zooming into the field.
            fontSize: code ? 22 : 17,
            fontWeight: code ? "900" : "600",
            letterSpacing: code ? 6 : 0,
            textAlign: code ? "center" : "left",
          },
          webInputReset,
          style,
        ]}
      />
      {error ? <Text style={{ color: colors.danger, fontSize: 14, fontWeight: "600" }}>{error}</Text> : null}
    </View>
  );
}

type Segment<T extends string> = { value: T; label: string };

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  accent = colors.brand,
  disabled,
}: {
  options: Segment<T>[];
  value: T;
  onChange: (value: T) => void;
  accent?: string;
  disabled?: boolean;
}) {
  return (
    <View
      accessibilityRole="tablist"
      style={{
        flexDirection: "row",
        padding: 4,
        borderRadius: radius.md,
        backgroundColor: colors.sunken,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            disabled={disabled}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={{
              flex: 1,
              minHeight: 44,
              borderRadius: radius.sm,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: active ? withAlpha(accent, 0.18) : "transparent",
              borderWidth: active ? 1 : 0,
              borderColor: withAlpha(accent, 0.55),
            }}
          >
            <Text style={{ color: active ? colors.text : colors.textMuted, fontWeight: "800", fontSize: 15 }}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Surfaces & labels
// ---------------------------------------------------------------------------

export function Card({
  children,
  accent,
  style,
}: {
  children: React.ReactNode;
  accent?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        {
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: accent ? withAlpha(accent, 0.4) : colors.border,
          padding: space.lg,
          gap: space.md,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Chip({ label, color = colors.textMuted, icon }: { label: string; color?: string; icon?: IconName }) {
  return (
    <View
      style={{
        alignSelf: "flex-start",
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: radius.pill,
        backgroundColor: withAlpha(color, 0.14),
        borderWidth: 1,
        borderColor: withAlpha(color, 0.35),
      }}
    >
      {icon ? <Ionicons name={icon} size={13} color={color} /> : null}
      <Text style={{ color, fontSize: 12, fontWeight: "800" }}>{label}</Text>
    </View>
  );
}

export function SectionLabel({ children, right }: { children: string; right?: React.ReactNode }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
      <Text style={[type.caption, { color: colors.textMuted, textTransform: "uppercase" }]}>{children}</Text>
      {right}
    </View>
  );
}

/** Game artwork tile used on the home list, entry screens and lobbies. */
export function GameIcon({ source, size = 64, accent }: { source: any; size?: number; accent?: string }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.24),
        overflow: "hidden",
        borderWidth: 1,
        borderColor: accent ? withAlpha(accent, 0.6) : colors.border,
        backgroundColor: colors.surfaceRaised,
      }}
    >
      <Image source={source} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
    </View>
  );
}

/**
 * Big room code that everyone at the table can read off one phone. With `inviteUrl`
 * it also shows a QR code: scanning it opens the game with the code already filled in.
 */
export function RoomCodeBadge({
  code,
  label,
  accent = colors.brand,
  inviteUrl,
}: {
  code: string;
  label: string;
  accent?: string;
  inviteUrl?: string;
}) {
  const { language } = useI18n();
  return (
    <View style={{ alignItems: "center", gap: 2 }}>
      <Text style={[type.caption, { color: colors.textMuted, textTransform: "uppercase" }]}>{label}</Text>
      <Text selectable style={{ color: accent, fontSize: 40, lineHeight: 46, fontWeight: "900", letterSpacing: 8 }}>
        {code}
      </Text>
      {inviteUrl ? (
        <View style={{ alignItems: "center", gap: space.sm, marginTop: space.sm }}>
          <QRCode value={inviteUrl} size={196} />
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Ionicons name="scan" size={16} color={colors.textMuted} />
            <Text style={{ color: colors.textMuted, fontSize: 14, fontWeight: "600" }}>
              {language === "sv" ? "Skanna med kameran för att gå med" : "Scan with the camera to join"}
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}
