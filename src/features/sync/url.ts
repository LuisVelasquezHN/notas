/**
 * URL del proyecto de Supabase sin rutas: si se copia la del API REST (`…/rest/v1/`), el cliente
 * duplicaría la ruta y ninguna petición funcionaría.
 */
export function normalizeSupabaseUrl(value: string | undefined): string | undefined {
  return (
    value
      ?.trim()
      .replace(/\/+$/, '')
      .replace(/\/rest\/v1$/, '') || undefined
  );
}
