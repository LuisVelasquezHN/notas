import { EmptyState, Screen, Text } from '@/components/ui';
import { capabilities } from '@/lib/capabilities';
import { spacing } from '@/theme';

export default function RemindersScreen() {
  return (
    <Screen>
      <Text variant="largeTitle" style={{ paddingVertical: spacing.md }}>
        Recordatorios
      </Text>
      <EmptyState
        icon="bell"
        title="Nada pendiente"
        description={
          capabilities.localNotifications
            ? 'Aquí verás tus próximos recordatorios y los vencidos.'
            : 'Aquí verás tus próximos recordatorios. En la web no se envían notificaciones del sistema.'
        }
      />
    </Screen>
  );
}
