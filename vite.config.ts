import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// On Vercel, switch nitro preset to "vercel" so the build outputs to .vercel/output.
// Locally and on Lovable hosting, keep the default Cloudflare preset.
const isVercel = !!process.env.VERCEL;

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  ...(isVercel ? { nitro: { preset: "vercel" } } : {}),
});
