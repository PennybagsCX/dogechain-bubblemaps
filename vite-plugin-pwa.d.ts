/**
 * Type declarations for vite-plugin-pwa virtual module
 */

interface RegisterSWOptions {
  onNeedRefresh?: () => void;
  onOfflineReady?: () => void;
  onRegistered?: (registration: ServiceWorkerRegistration | undefined) => void;
  onRegisterError?: (error: unknown) => void;
}

interface RegisterSW {
  (options: RegisterSWOptions): void;
}

declare module "virtual:pwa-register" {
  export const registerSW: RegisterSW;
}
