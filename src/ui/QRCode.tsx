import React, { useMemo } from "react";
import { View } from "react-native";
import qrcode from "qrcode-generator";

type QRCodeProps = {
  value: string;
  /** Outer size in px, including the white quiet zone. */
  size?: number;
  /** Screen-reader label; pass a translated one. */
  accessibilityLabel?: string;
};

const QUIET_ZONE = 2; // modules of white border scanners need around the code

/**
 * Pure-JS QR code drawn with plain Views, so it works the same on web and native
 * without an SVG/canvas dependency. Each row is drawn as horizontal runs to keep
 * the number of views low.
 */
export function QRCode({ value, size = 200, accessibilityLabel = "QR code" }: QRCodeProps) {
  const { count, runs } = useMemo(() => {
    const qr = qrcode(0, "M");
    qr.addData(value);
    qr.make();
    const n = qr.getModuleCount();
    const rows: Array<Array<[number, number]>> = [];
    for (let r = 0; r < n; r++) {
      const row: Array<[number, number]> = [];
      let start = -1;
      for (let c = 0; c <= n; c++) {
        const dark = c < n && qr.isDark(r, c);
        if (dark && start < 0) start = c;
        if (!dark && start >= 0) {
          row.push([start, c - start]);
          start = -1;
        }
      }
      rows.push(row);
    }
    return { count: n, runs: rows };
  }, [value]);

  // Whole-pixel modules keep edges crisp so phone cameras read it reliably.
  const cell = Math.max(1, Math.floor(size / (count + QUIET_ZONE * 2)));
  const inner = cell * count;
  const outer = inner + cell * QUIET_ZONE * 2;

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      style={{ width: outer, height: outer, backgroundColor: "#FFFFFF", padding: cell * QUIET_ZONE, borderRadius: 12 }}
    >
      <View style={{ width: inner, height: inner }}>
        {runs.map((row, r) =>
          row.map(([c, len]) => (
            <View
              key={`${r}-${c}`}
              style={{ position: "absolute", top: r * cell, left: c * cell, width: len * cell, height: cell, backgroundColor: "#000000" }}
            />
          ))
        )}
      </View>
    </View>
  );
}
