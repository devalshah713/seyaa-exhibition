import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// The price sheet is bundled into the app and every page is static, so the
// worker needs no incremental cache, queue or tag store.
export default defineCloudflareConfig();
