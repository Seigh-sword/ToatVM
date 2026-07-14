import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// ToatVM is a static SPA. It is deployed to Cloudflare Pages, which builds
// with `npm run build` and serves the `dist/` directory. No server is needed.
export default defineConfig({
  plugins: [react()],
  base: "./",
  build: {
    outDir: "dist",
    sourcemap: false,
  },
});
