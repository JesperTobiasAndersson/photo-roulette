import * as ImageManipulator from "expo-image-manipulator";

export async function compressImage(uri: string): Promise<string> {
  /**
   * Compress image aggressively to reduce Supabase storage costs
   * Target: 200-400 KB per image (from ~5 MB)
   * Savings: ~90% reduction in bandwidth and storage
   */
  try {
    const compressed = await ImageManipulator.manipulateAsync(
      uri,
      [
        // Resize by width only so the original aspect ratio is preserved.
        { resize: { width: 1200 } },
      ],
      {
        compress: 0.6,
        format: ImageManipulator.SaveFormat.JPEG,
      }
    );
    return compressed.uri;
  } catch (error) {
    console.error("Image compression failed:", error);
    return uri; // Fallback to original if compression fails
  }
}

export async function uriToArrayBuffer(uri: string): Promise<ArrayBuffer> {
  try {
    const res = await fetch(uri);
    return await res.arrayBuffer();
  } catch (error) {
    console.error("Failed to convert URI to buffer:", error);
    throw error;
  }
}
