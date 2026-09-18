import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["apple-touch-icon.png"],
      // Por default el plugin solo genera manifest/service worker en el
      // build de producción. Esto lo activa también en `npm run dev`,
      // para poder probarlo sin tener que buildear cada vez.
      devOptions: {
        enabled: true,
        type: "module",
      },
      manifest: {
        name: "Arena Poker",
        short_name: "Arena Poker",
        description: "Mesas vivas, listas de espera y torneos de Arena Poker.",
        theme_color: "#12071c",
        background_color: "#12071c",
        display: "standalone",
        start_url: "/",
        scope: "/",
        icons: [
          {
            src: "/icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "/icons/icon-512-maskable.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        // Precachea el "app shell" (JS/CSS/HTML) para que la app abra
        // aunque no haya conexión. A propósito NO cacheamos las
        // respuestas de la API (mesas, torneos, lista de espera): esos
        // datos tienen que ser siempre en vivo, mostrar un dato viejo de
        // caché sobre mesas/listas de espera sería directamente engañoso.
        // Si no hay red, la UI carga pero los pedidos a la API van a
        // fallar con el error normal que ya manejan las pantallas.
        globPatterns: ["**/*.{js,css,html,svg,png,ico}"],
        navigateFallbackDenylist: [/^\/(auth|tables|tournaments|waiting-list|users|audit-logs)\//],
      },
    }),
  ],
  server: {
    port: 5173,
  },
});