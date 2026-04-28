/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_RSERVE_HOST?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
