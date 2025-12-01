/**
 * Next.js Instrumentation
 * This file is loaded once when the server starts.
 * Used to initialize server-side resources like WASM management.
 */

export async function register() {
  // Only run on server (not edge runtime)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { initializeWasm } = await import('./utils/stellar/wasm-manager.js');
    await initializeWasm();
  }
}
