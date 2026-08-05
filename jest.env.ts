/**
 * Runs before any module is imported. `src/lib/env.ts` throws when the API base
 * URL is missing, and fixtures mode keeps tests off the network entirely.
 */
process.env.NEXT_PUBLIC_API_BASE_URL ??= "http://localhost:4000/api";
process.env.NEXT_PUBLIC_API_MODE ??= "fixtures";
