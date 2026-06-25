import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const reactRserveLib = path.resolve(__dirname, '../../../react-rserve/lib/main.ts')
const rserveTsLib = path.resolve(__dirname, '../../../rserve-ts/dist/index.mjs')

const useLocalPackages =
  !process.env.VIT_DOCKER_BUILD &&
  fs.existsSync(reactRserveLib) &&
  fs.existsSync(rserveTsLib)

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    ...(useLocalPackages
      ? {
          alias: {
            '@tmelliott/react-rserve': reactRserveLib,
            'rserve-ts': rserveTsLib,
          },
        }
      : {}),
  },
})
