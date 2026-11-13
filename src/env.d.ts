/// <reference types="vite/client" />

/**
 * Build-time constant injected by `define: { __APP_VERSION__ }` in
 * vite.config.ts. It is the `version` field of package.json, so the header
 * badge and the release tag can never disagree.
 */
declare const __APP_VERSION__: string;
