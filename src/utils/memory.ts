/**
 * Memory optimization utility
 */

const registeredUrls = new Set<string>();

/**
 * Registers an object URL so we can bulk-clean if needed
 */
export function registerObjectUrl(url: string): string {
  if (url.startsWith('blob:')) {
    registeredUrls.add(url);
  }
  return url;
}

/**
 * Revokes a single object URL and deletes it from our registry
 */
export function safeRevokeUrl(url: string | undefined) {
  if (!url) return;
  if (url.startsWith('blob:')) {
    try {
      URL.revokeObjectURL(url);
      registeredUrls.delete(url);
    } catch (e) {
      console.warn('Failed to revoke URL:', url, e);
    }
  }
}

/**
 * Clears all registered object URLs to free up memory
 */
export function cleanAllRegisteredUrls() {
  registeredUrls.forEach((url) => {
    try {
      URL.revokeObjectURL(url);
    } catch (e) {
      // ignore
    }
  });
  registeredUrls.clear();
}

/**
 * Force garbage collection hints or canvas size resetting to zero to free GPU memory
 */
export function releaseCanvas(canvas: HTMLCanvasElement | null) {
  if (!canvas) return;
  try {
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, 1, 1);
    }
  } catch (e) {
    // ignore
  }
}
