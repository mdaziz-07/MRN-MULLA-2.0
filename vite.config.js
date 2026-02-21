import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Access env vars
  const appMode = process.env.VITE_APP_MODE || 'customer (default)'
  console.log('--------------------------------------------------')
  console.log(`🏗️  BUILDING MODE: ${appMode}`)
  console.log('--------------------------------------------------')

  return {
    plugins: [
      react(),
      tailwindcss(),
    ],
    server: {
      port: 5173,
      host: true,
      allowedHosts: true, // Allow request from any host (needed for localtunnel/ngrok)
    },
  }
})
