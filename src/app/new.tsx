import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { createNote } from '@/features/notes/repository';
import { createNoteFromTemplate } from '@/features/templates/repository';
import { findTemplate } from '@/features/templates/templates';
import { useTheme } from '@/theme';

/**
 * Crear una nota y abrirla: destino de las acciones rápidas del icono y de enlaces como
 * `notas://new?kind=voice`.
 * - `kind`: `text` (por defecto), `checklist` o `voice` (nota de texto con la grabadora abierta).
 * - `template`: id de una plantilla integrada (tiene prioridad sobre `kind`).
 */
export default function NewNoteScreen() {
  const { colors } = useTheme();
  const { kind, template } = useLocalSearchParams<{ kind?: string; template?: string }>();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void (async () => {
      const fromTemplate = template ? findTemplate(template) : undefined;
      const note = fromTemplate
        ? await createNoteFromTemplate(fromTemplate)
        : await createNote(kind === 'checklist' ? 'checklist' : 'text');
      router.replace({
        pathname: '/note/[id]',
        params: kind === 'voice' ? { id: note.id, record: '1' } : { id: note.id },
      });
    })();
  }, [kind, template]);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
