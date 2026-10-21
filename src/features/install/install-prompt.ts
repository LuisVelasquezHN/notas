/** Instalar como app de escritorio (PWA): solo existe en web (ver `install-prompt.web.ts`). */
export function useInstallPrompt(): {
  available: boolean;
  installed: boolean;
  prompt: (() => Promise<void>) | null;
} {
  return { available: false, installed: true, prompt: null };
}
