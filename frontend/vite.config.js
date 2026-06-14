// import { defineConfig } from 'vite'
// import react from '@vitejs/plugin-react-swc'
//
// // https://vite.dev/config/
// export default defineConfig({
//   plugins: [react()],
// })

import path from "path"
import { fileURLToPath } from "url"
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default defineConfig({
    plugins: [react()],
    server: {
        host: true, // Needed for Docker
        port: 5173,
        watch: {
            usePolling: true, // Helps with Hot Reloading on Windows/WSL
        },
    },
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
})
