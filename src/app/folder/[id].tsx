import { useLocalSearchParams } from 'expo-router';

import { EmptyState, Screen } from '@/components/ui';

export default function FolderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <Screen edges={[]}>
      <EmptyState icon="folder" title="Carpeta" description={`Contenido de la carpeta ${id}.`} />
    </Screen>
  );
}
