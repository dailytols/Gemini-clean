// src/services/opencvLoader.ts

let opencvPromise: Promise<any> | null = null;
let isFailed = false;

/**
 * Controlled loader for OpenCV.js.
 * Ensures the script is loaded exactly once and resolves safely with a timeout.
 */
export function loadOpenCV(timeoutMs: number = 20000): Promise<any> {
  // If already successfully loaded, return immediately
  if ((window as any).cv && (window as any).cv.Mat) {
    return Promise.resolve((window as any).cv);
  }

  // If loading failed previously, reset and try again
  if (isFailed) {
    opencvPromise = null;
    isFailed = false;
  }

  if (opencvPromise) {
    return opencvPromise;
  }

  opencvPromise = new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      isFailed = true;
      reject(new Error('OpenCV.js loading timed out. Utilizing pixel-diffusion engine fallback.'));
    }, timeoutMs);

    // If script is already in document, just wait for its initialization
    let script = document.getElementById('opencv-js') as HTMLScriptElement | null;
    
    const checkInitialization = () => {
      let count = 0;
      const interval = setInterval(() => {
        if ((window as any).cv && (window as any).cv.Mat) {
          clearInterval(interval);
          clearTimeout(timeoutId);
          resolve((window as any).cv);
        }
        // Fail after 8 seconds of continuous checks if script loaded but Mat not available
        if (count++ > 80) {
          clearInterval(interval);
          clearTimeout(timeoutId);
          isFailed = true;
          reject(new Error('OpenCV.js script loaded but failed to initialize correctly.'));
        }
      }, 100);
    };

    if (script) {
      checkInitialization();
      return;
    }

    script = document.createElement('script');
    script.id = 'opencv-js';
    script.src = 'https://docs.opencv.org/4.5.5/opencv.js';
    script.async = true;
    script.defer = true;

    script.onload = () => {
      const cv = (window as any).cv;
      if (cv && cv.onRuntimeInitialized) {
        const originalInit = cv.onRuntimeInitialized;
        cv.onRuntimeInitialized = () => {
          if (typeof originalInit === 'function') {
            try { originalInit(); } catch (e) {}
          }
          clearTimeout(timeoutId);
          resolve(cv);
        };
      } else {
        checkInitialization();
      }
    };

    script.onerror = () => {
      clearTimeout(timeoutId);
      isFailed = true;
      reject(new Error('Failed to load OpenCV.js from the remote CDN. Utilizing custom browser-native inpainting.'));
    };

    document.body.appendChild(script);
  });

  return opencvPromise;
}
