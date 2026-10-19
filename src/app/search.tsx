import { EmptyState, Screen } from '@/components/ui';

export default function SearchScreen() {
  return (
    <Screen edges={[]}>
      <EmptyState
        icon="search"
        title="Buscar notas"
        description="Búsqueda de texto completo en títulos, contenido y listas."
      />
    </Screen>
  );
}
