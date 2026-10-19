import { EmptyState, Screen, Text } from '@/components/ui';
import { spacing } from '@/theme';

export default function FoldersScreen() {
  return (
    <Screen>
      <Text variant="largeTitle" style={{ paddingVertical: spacing.md }}>
        Carpetas
      </Text>
      <EmptyState
        icon="folder"
        title="Sin carpetas"
        description="Organiza tus notas en carpetas y carpetas inteligentes. Disponible en la fase 1."
      />
    </Screen>
  );
}
