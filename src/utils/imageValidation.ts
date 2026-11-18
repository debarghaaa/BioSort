import type { ImageValidationReport } from '../types/platform';

export const ACCEPTED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png'];
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MiB
export const MIN_IMAGE_DIMENSION = 64;
export const MAX_IMAGE_DIMENSION = 8192;

async function computeSha256Hex(buffer: ArrayBuffer): Promise<string | null> {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    return null;
  }
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function readImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const dims = { width: img.naturalWidth, height: img.naturalHeight };
      URL.revokeObjectURL(objectUrl);
      resolve(dims);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Image payload could not be decoded by browser image parser.'));
    };
    img.src = objectUrl;
  });
}

export async function validateImageFile(file: File): Promise<ImageValidationReport> {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!ACCEPTED_IMAGE_MIME_TYPES.includes(file.type.toLowerCase())) {
    errors.push(
      `Unsupported MIME type "${file.type || 'unknown'}". Accepted formats: JPG, JPEG, PNG.`
    );
  }

  if (file.size === 0) {
    errors.push('Selected file is empty (0 bytes).');
  } else if (file.size > MAX_IMAGE_BYTES) {
    errors.push(
      `File size ${(file.size / (1024 * 1024)).toFixed(2)} MiB exceeds the 10 MiB limit.`
    );
  }

  let width: number | null = null;
  let height: number | null = null;

  if (errors.length === 0) {
    try {
      const dims = await readImageDimensions(file);
      width = dims.width;
      height = dims.height;

      if (width < MIN_IMAGE_DIMENSION || height < MIN_IMAGE_DIMENSION) {
        errors.push(
          `Image resolution ${width}x${height} is below minimum ${MIN_IMAGE_DIMENSION}x${MIN_IMAGE_DIMENSION} px.`
        );
      }
      if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
        errors.push(
          `Image resolution ${width}x${height} exceeds maximum ${MAX_IMAGE_DIMENSION}x${MAX_IMAGE_DIMENSION} px.`
        );
      }
      if (width < 224 || height < 224) {
        warnings.push(
          `Resolution ${width}x${height} is smaller than standard 224x224 input and will be rescaled.`
        );
      }
    } catch (err) {
      errors.push(err instanceof Error ? err.message : 'Unable to decode image dimensions.');
    }
  }

  const buffer = await file.arrayBuffer();
  const sha256 = await computeSha256Hex(buffer);

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    file_name: file.name,
    mime_type: file.type || 'unknown',
    byte_size: file.size,
    width,
    height,
    sha256,
  };
}
