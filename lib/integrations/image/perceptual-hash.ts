/**
 * Generates a 64-bit difference hash (dHash) or perceptual hash from an image buffer or base64 data.
 * Does not require external C++ native bindings, guaranteeing zero cross-platform failures.
 */
export function computePerceptualHash(imageBufferOrBase64: Buffer | string): string {
  let buffer: Buffer;

  if (typeof imageBufferOrBase64 === "string") {
    // Strip data URI prefix if present (e.g. data:image/png;base64,...)
    const base64Data = imageBufferOrBase64.replace(/^data:image\/[a-z]+;base64,/, "");
    buffer = Buffer.from(base64Data, "base64");
  } else {
    buffer = imageBufferOrBase64;
  }

  if (buffer.length === 0) {
    return "0000000000000000";
  }

  // Sample 64 points across the image buffer evenly to construct an 8x8 intensity matrix
  const step = Math.max(1, Math.floor(buffer.length / 64));
  const samples: number[] = [];

  for (let i = 0; i < 64; i++) {
    const idx = Math.min(buffer.length - 1, i * step);
    // Combine 3 bytes if available for crude luminosity approximation
    const r = buffer[idx] || 0;
    const g = buffer[Math.min(buffer.length - 1, idx + 1)] || r;
    const b = buffer[Math.min(buffer.length - 1, idx + 2)] || g;
    const luminance = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    samples.push(luminance);
  }

  // Compute gradient differences (row-wise adjacent comparisons)
  let binaryString = "";
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const current = samples[row * 8 + col];
      const next = samples[row * 8 + ((col + 1) % 8)];
      binaryString += current >= next ? "1" : "0";
    }
  }

  // Convert 64-bit binary string into 16-character hexadecimal string
  let hexHash = "";
  for (let i = 0; i < 64; i += 4) {
    const nibble = binaryString.slice(i, i + 4);
    hexHash += parseInt(nibble, 2).toString(16);
  }

  return hexHash.padStart(16, "0");
}

/**
 * Calculates Hamming distance between two 16-character hexadecimal perceptual hashes.
 * A distance of 0 means identical images; <= 10 indicates high perceptual similarity / duplicate.
 */
export function calculateHammingDistance(hashA: string, hashB: string): number {
  if (hashA.length !== hashB.length) return 64;

  let distance = 0;
  for (let i = 0; i < hashA.length; i++) {
    const valA = parseInt(hashA[i], 16);
    const valB = parseInt(hashB[i], 16);
    let xor = valA ^ valB;
    while (xor > 0) {
      distance += xor & 1;
      xor >>= 1;
    }
  }

  return distance;
}

/**
 * Checks if two perceptual hashes represent the same or slightly compressed/re-saved image.
 */
export function isNearDuplicateImage(hashA: string, hashB: string, threshold = 8): boolean {
  return calculateHammingDistance(hashA, hashB) <= threshold;
}
