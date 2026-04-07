import { useEffect } from "react";
import { Platform } from "react-native";

type WebSeoProps = {
  title: string;
  description: string;
  path?: string;
  image?: string;
  lang?: string;
  keywords?: string[];
  type?: "website" | "article";
  robots?: string;
  structuredData?: Record<string, unknown> | Array<Record<string, unknown>>;
};

const DEFAULT_SITE_NAME = "Picklo";
const DEFAULT_IMAGE = "/apple-touch-icon.png";

function ensureMeta(name: string, content: string, attribute: "name" | "property" = "name") {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${name}"]`);
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, name);
    document.head.appendChild(element);
  }
  element.setAttribute("content", content);
}

function ensureLink(rel: string, href: string) {
  let element = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!element) {
    element = document.createElement("link");
    element.rel = rel;
    document.head.appendChild(element);
  }
  element.href = href;
}

function ensureJsonLd(id: string, payload: string) {
  let element = document.head.querySelector<HTMLScriptElement>(`script[data-seo-id="${id}"]`);
  if (!element) {
    element = document.createElement("script");
    element.type = "application/ld+json";
    element.dataset.seoId = id;
    document.head.appendChild(element);
  }
  element.textContent = payload;
}

export function WebSeo({
  title,
  description,
  path = "/",
  image = DEFAULT_IMAGE,
  lang,
  keywords,
  type = "website",
  robots = "index,follow",
  structuredData,
}: WebSeoProps) {
  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined" || typeof window === "undefined") {
      return;
    }

    const origin =
      process.env.EXPO_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
      window.location.origin.replace(/\/$/, "");
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    const canonicalUrl = `${origin}${normalizedPath === "/" ? "" : normalizedPath}`;
    const imageUrl = image.startsWith("http") ? image : `${origin}${image}`;

    document.title = title;
    document.documentElement.lang = lang || "en";

    ensureMeta("description", description);
    ensureMeta("robots", robots);
    ensureMeta("application-name", DEFAULT_SITE_NAME);
    ensureMeta("apple-mobile-web-app-title", DEFAULT_SITE_NAME);
    ensureMeta("og:title", title, "property");
    ensureMeta("og:description", description, "property");
    ensureMeta("og:type", type, "property");
    ensureMeta("og:url", canonicalUrl, "property");
    ensureMeta("og:site_name", DEFAULT_SITE_NAME, "property");
    ensureMeta("og:image", imageUrl, "property");
    ensureMeta("twitter:card", "summary_large_image");
    ensureMeta("twitter:title", title);
    ensureMeta("twitter:description", description);
    ensureMeta("twitter:image", imageUrl);
    if (keywords?.length) {
      ensureMeta("keywords", keywords.join(", "));
    }
    ensureLink("canonical", canonicalUrl);

    if (structuredData) {
      const payload = JSON.stringify(structuredData);
      ensureJsonLd("picklo-structured-data", payload);
    }
  }, [description, image, keywords, lang, path, robots, structuredData, title, type]);

  return null;
}
