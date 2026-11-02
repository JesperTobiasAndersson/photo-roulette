import type { PropsWithChildren } from "react";

// The HTML shell around every pre-rendered page (web only; replaces public/index.html).
// Pages are rendered in English at build time. A visitor whose phone (or saved choice) is
// Swedish gets the page hidden until the app has switched to Swedish, so they never see a
// flash of English; LanguageProvider removes the class, with a timeout as a safety net.
const LANGUAGE_SCRIPT = `try{var l=localStorage.getItem("picklo_language");var sv=l?l==="sv":/^sv/i.test(navigator.language||"");if(sv){var d=document.documentElement;d.classList.add("picklo-lang-pending");d.lang="sv";setTimeout(function(){d.classList.remove("picklo-lang-pending")},4000)}}catch(e){}`;

const BASE_CSS = `
html, body { height: 100%; background-color: #070b14; }
body { overflow: hidden; margin: 0; overscroll-behavior: none; -webkit-tap-highlight-color: transparent; -webkit-text-size-adjust: 100%; }
#root { display: flex; height: 100%; flex: 1; background-color: #070b14; }
.picklo-lang-pending #root { visibility: hidden; }
`;

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="theme-color" content="#070B14" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Picklo" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="google-adsense-account" content="ca-pub-5551520118812971" />

        {/* Google AdSense */}
        <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-5551520118812971" crossOrigin="anonymous" />

        <script dangerouslySetInnerHTML={{ __html: LANGUAGE_SCRIPT }} />
        <style id="expo-reset" dangerouslySetInnerHTML={{ __html: BASE_CSS }} />
      </head>
      <body>
        <noscript>
          Picklo is a multiplayer party game site with MemeMatch, Mafia, Imposter, Chicago, Music Quiz and Trivia. Enable
          JavaScript to join or create a room.
        </noscript>
        {children}
      </body>
    </html>
  );
}
