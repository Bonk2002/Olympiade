import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { createRoomApiApp } from './roomApi.js'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'turnier-room-api-dev',
      configureServer(server) {
        server.middlewares.use(createRoomApiApp())
      },
    },
  ],
})
