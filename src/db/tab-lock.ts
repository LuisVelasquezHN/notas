/**
 * En iOS y Android solo hay una instancia de la app: no hace falta coordinar nada.
 * Ver `tab-lock.web.ts`.
 */
export async function acquireDatabaseLock(_onWaiting: () => void): Promise<void> {}
