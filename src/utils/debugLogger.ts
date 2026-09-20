// src/utils/debugLogger.ts

/**
 * Initializes global error and unhandled rejection event logging for easier development debugging.
 */
export function initDebugLogger(): void {
  // Only execute in development mode
  const isDev = process.env.NODE_ENV !== 'production' || window.location.hostname === 'localhost' || window.location.hostname.includes('dev');
  if (!isDev) return;

  console.log('🐞 [DEBUG MODE] Initializing developer-friendly global diagnostics...');

  window.onerror = function (message, source, lineno, colno, error) {
    console.group('%c🐞 Global Main-Thread Exception Detected', 'color: #e11d48; font-weight: bold; font-size: 13px;');
    console.error('Message:', message);
    console.error('Source:', source);
    console.error('Line/Col:', `${lineno}:${colno}`);
    if (error) {
      console.error('Stack Trace:', error.stack || error);
    }
    console.groupEnd();
    return false; // Let browser handle it as well
  };

  window.onunhandledrejection = function (event) {
    console.group('%c🐞 Unhandled Promise Rejection Detected', 'color: #f59e0b; font-weight: bold; font-size: 13px;');
    console.warn('Reason:', event.reason);
    if (event.reason && event.reason.stack) {
      console.warn('Stack Trace:', event.reason.stack);
    }
    console.groupEnd();
  };
}
