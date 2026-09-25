import { Platform } from "react-native";

/**
 * Public address of the site, used for share links, invites and SEO metadata.
 * Set EXPO_PUBLIC_SITE_URL when the domain changes; on the web the current
 * origin is used as a fallback so links always point to where the app runs.
 */
const configured = process.env.EXPO_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");

export const SITE_URL =
  configured ||
  (Platform.OS === "web" && typeof window !== "undefined" ? window.location.origin : "https://picklo.se");

export const siteUrl = (path = "/") => `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
