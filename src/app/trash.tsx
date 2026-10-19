import { EmptyState, Screen } from '@/components/ui';

export default function TrashScreen() {
  return (
    <Screen edges={[]}>
      <EmptyState
        icon="trash"
        title="Papelera vacía"
        description="Las notas eliminadas se borran definitivamente a los 30 días."
      />
    </Screen>
  );
}
