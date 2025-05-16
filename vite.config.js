import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // Это обеспечит, что 'global' будет заменен на 'window' во время сборки
    // для кода, который ожидает 'global' (например, в sockjs-client).
    global: 'window',
  }
})
