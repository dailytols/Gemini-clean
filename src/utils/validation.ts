import { SUPPORTED_MIME_TYPES, MAX_FILE_SIZE_MB } from './constants';

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates files uploaded into the queue.
 */
export function validateImageFile(file: File): ValidationResult {
  const fileType = file.type.toLowerCase();
  
  if (!SUPPORTED_MIME_TYPES.includes(fileType)) {
    return {
      valid: false,
      error: `"${file.name}" is not supported. Please upload PNG, JPG/JPEG, or WEBP.`,
    };
  }

  const sizeInMB = file.size / (1024 * 1024);
  if (sizeInMB > MAX_FILE_SIZE_MB) {
    return {
      valid: false,
      error: `"${file.name}" exceeds the ${MAX_FILE_SIZE_MB}MB size limit for browser processing.`,
    };
  }

  return { valid: true };
}
