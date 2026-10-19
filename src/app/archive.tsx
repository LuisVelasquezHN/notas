import { EmptyState, Screen } from '@/components/ui';

export default function ArchiveScreen() {
  return (
    <Screen edges={[]}>
      <EmptyState
        icon="archive"
        title="Archivo vacío"
        description="Las notas archivadas aparecerán aquí."
      />
    </Screen>
  );
}
