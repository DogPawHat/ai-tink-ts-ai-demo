import { defineConfig } from "vite-plus";
import viteReact from "@vitejs/plugin-react";

// The widget is one self-contained script that a proxy injects into every page of a
// visitor's site. It carries its own React and its own CSS (in a shadow DOM).
export default defineConfig({
  plugins: [viteReact()],
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
  build: {
    lib: {
      entry: "src/widget/main.tsx",
      name: "AiTinkWidget",
      formats: ["iife"],
      fileName: () => "widget.js",
    },
    outDir: "dist",
    emptyOutDir: false,
    minify: true,
  },
});
