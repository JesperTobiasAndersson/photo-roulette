import Head from "expo-router/head";
import { Platform } from "react-native";
import { siteUrl } from "../lib/site";

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

/**
 * Title, description, social cards and canonical link. Rendered into the pre-built HTML of
 * every page (so search engines and link previews see them without running the app) and kept
 * up to date in the browser by expo-router's Head. The page language is set by LanguageProvider.
 */
export function WebSeo({
  title,
  description,
  path = "/",
  image = DEFAULT_IMAGE,
  keywords,
  type = "website",
  robots = "index,follow",
  structuredData,
}: WebSeoProps) {
  if (Platform.OS !== "web") return null;

  const canonicalUrl = path === "/" ? siteUrl("/").replace(/\/$/, "") : siteUrl(path);
  const imageUrl = image.startsWith("http") ? image : siteUrl(image);

  return (
    <Head>
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta name="robots" content={robots} />
      <meta name="application-name" content={DEFAULT_SITE_NAME} />
      {keywords?.length ? <meta name="keywords" content={keywords.join(", ")} /> : null}
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content={type} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:site_name" content={DEFAULT_SITE_NAME} />
      <meta property="og:image" content={imageUrl} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={imageUrl} />
      <link rel="canonical" href={canonicalUrl} />
      {structuredData ? <script type="application/ld+json">{JSON.stringify(structuredData)}</script> : null}
    </Head>
  );
}
