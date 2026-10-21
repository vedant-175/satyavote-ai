export interface SanitizedExifData {
  captureDate?: string | null;
  make?: string | null;
  model?: string | null;
  software?: string | null;
  hasGps: boolean;
  gpsRedacted: boolean;
  isOlderThanEvent?: boolean;
  detectedYear?: number | null;
}

/**
 * Extracts and sanitizes EXIF metadata from JPEG/TIFF image buffers.
 * Enforces privacy: extracts presence of GPS coordinates but strips raw coordinates
 * before public disclosure.
 */
export function extractAndSanitizeExif(imageBufferOrBase64: Buffer | string): SanitizedExifData {
  let buffer: Buffer;

  if (typeof imageBufferOrBase64 === "string") {
    const base64Data = imageBufferOrBase64.replace(/^data:image\/[a-z]+;base64,/, "");
    buffer = Buffer.from(base64Data, "base64");
  } else {
    buffer = imageBufferOrBase64;
  }

  const result: SanitizedExifData = {
    captureDate: null,
    make: null,
    model: null,
    software: null,
    hasGps: false,
    gpsRedacted: true,
  };

  if (!buffer || buffer.length < 16) {
    return result;
  }

  // Parse ASCII text strings inside buffer to extract standard EXIF tags
  const rawStr = buffer.toString("binary");

  // 1. Capture Date (DateTimeOriginal tag 0x9003 format: YYYY:MM:DD HH:MM:SS)
  const dateMatch = rawStr.match(/(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/);
  if (dateMatch) {
    const year = parseInt(dateMatch[1], 10);
    const month = parseInt(dateMatch[2], 10);
    const day = parseInt(dateMatch[3], 10);
    result.captureDate = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]} ${dateMatch[4]}:${dateMatch[5]}:${dateMatch[6]}`;
    result.detectedYear = year;

    // Current election cycle check (e.g. older than 2024)
    const currentYear = new Date().getFullYear();
    if (year < currentYear) {
      result.isOlderThanEvent = true;
    }
  }

  // 2. Camera Device Make / Model
  const makeMatch = rawStr.match(/(Apple|Canon|Nikon|Sony|Samsung|Google|Xiaomi|OnePlus|Huawei|Fujifilm)/i);
  if (makeMatch) {
    result.make = makeMatch[1];
  }

  const modelMatch = rawStr.match(/(iPhone\s[^\x00\r\n]{1,20}|Pixel\s\d[^\x00\r\n]{0,10}|Galaxy\s[^\x00\r\n]{1,20}|EOS\s[^\x00\r\n]{1,10})/i);
  if (modelMatch) {
    result.model = modelMatch[1].trim();
  }

  // 3. Software / Generator
  const softwareMatch = rawStr.match(/(Adobe\sPhotoshop[^\x00\r\n]{0,20}|GIMP[^\x00\r\n]{0,10}|Lightroom[^\x00\r\n]{0,15}|Midjourney|Canva|Stable\sDiffusion|DALL-E)/i);
  if (softwareMatch) {
    result.software = softwareMatch[1].trim();
  }

  // 4. GPS Tags (GPSInfo tag 0x8825 or GPSVersionID)
  // Check if GPS sub-IFD exists in the image metadata
  if (rawStr.includes("GPSVersionID") || rawStr.includes("GPSLatitude") || rawStr.includes("GPSPosition")) {
    result.hasGps = true;
    result.gpsRedacted = true; // Always true: raw coordinates are stripped for privacy
  }

  return result;
}
