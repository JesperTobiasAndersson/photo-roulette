import React from "react";

// Dynamically import AdSense to avoid issues if it fails to load
let AdSense: any = null;
try {
  AdSense = require("react-adsense").AdSense;
} catch (error) {
  console.warn("AdSense library not available:", error);
}

export const AdSenseAd: React.FC = () => {
  // Only render if AdSense and AdSense.Google are available
  if (!AdSense || !AdSense.Google) {
    return null; // Don't render anything if AdSense fails to load or Google component is missing
  }

  try {
    return (
      <AdSense.Google
        client="ca-pub-5551520118812971"
        slot="XXXXXXXXXX"
        style={{ display: "block" }}
        format="auto"
        responsive="true"
      />
    );
  } catch (error) {
    console.error("AdSense component error:", error);
    return null; // Fallback if component fails
  }
};
