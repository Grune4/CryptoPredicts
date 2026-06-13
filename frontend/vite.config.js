// import { defineConfig } from 'vite'
// import react from '@vitejs/plugin-react-swc'
//
// // https://vite.dev/config/
// export default defineConfig({
//   plugins: [react()],
// })

import path from "path" // Import this at the top
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

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