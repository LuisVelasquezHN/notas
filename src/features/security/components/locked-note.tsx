import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Button, Icon, Text } from '@/components/ui';
import type { Note } from '@/db/schema';
import { capabilities } from '@/lib/capabilities';
import { useSecurityStore } from '@/stores/security-store';
import { radius, spacing, useTheme } from '@/theme';

import { unlockNote } from '../actions';

/**
 * Lo que se ve al abrir una nota bloqueada: ni título ni contenido hasta verificar. En iOS y
 * Android pide el desbloqueo al entrar (si la app no está bloqueada: entonces ya hay otro diálogo);
 * en web, sin verificación posible, hace falta tocar "Desbloquear".
 */
export function LockedNote({ note }: { note: Note }) {
  const { colors, noteColor } = useTheme();
  const { t } = useTranslation();
  const background = noteColor(note.color);

  useEffect(() => {
    if (capabilities.biometrics && !useSecurityStore.getState().appLocked) void unlockNote(note);
    // Solo al entrar en la nota.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note.id]);

  return (
    <View style={[styles.root, { backgroundColor: background }]}>
      <Stack.Screen
        options={{
          title: '',
          headerStyle: { backgroundColor: background },
          headerShadowVisible: false,
          headerRight: () => null,
        }}
      />
      <View style={[styles.badge, { backgroundColor: colors.surfaceMuted }]}>
        <Icon name="lock" size={32} color={colors.text} />
      </View>
      <Text variant="title" style={styles.center}>
        {t('lock.noteLockedTitle')}
      </Text>
      <Text tone="secondary" style={styles.center}>
        {t('lock.noteLockedHint')}
      </Text>
      <Button
        title={t('lock.unlock')}
        icon="lockOpen"
        onPress={() => void unlockNote(note)}
        style={styles.button}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.xl,
  },
  badge: {
    width: 72,
    height: 72,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  center: { textAlign: 'center', maxWidth: 360 },
  button: { marginTop: spacing.md, minWidth: 220 },
});
