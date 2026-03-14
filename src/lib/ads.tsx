import React from "react";
import { AdSense } from "react-adsense";

export const AdSenseAd: React.FC = () => {
  return (
    <AdSense.Google
      client="ca-pub-5551520118812971" // Your AdSense publisher ID
      slot="XXXXXXXXXX" // Replace with your ad slot ID
      style={{ display: "block" }}
      format="auto"
      responsive="true"
    />
  );
};
