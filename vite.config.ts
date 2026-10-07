import { defineConfig } from "vite";

// Configuração pensada para o Tauri 2:
// - porta fixa 1420 (definida em tauri.conf.json > build.devUrl)
// - não limpar o terminal para não esconder logs do cargo
export default defineConfig({
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
  build: {
    target: "es2021",
    minify: "esbuild",
    sourcemap: false,
    chunkSizeWarningLimit: 2200,
  },
});
