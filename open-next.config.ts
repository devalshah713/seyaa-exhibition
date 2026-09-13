import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// The price sheet is bundled into the app and every page is static, so the
// worker needs no incremental cache, queue or tag store.
const config = {
  ...defineCloudflareConfig(),

  // OpenNext shells out to `npm run build` by default. This project's `build`
  // script IS `opennextjs-cloudflare build` — so that Cloudflare's auto-detected
  // build command produces a worker rather than a bare Next.js build — and
  // without pinning the inner command here the two would call each other
  // forever.
  buildCommand: "next build",
};

export default config;
