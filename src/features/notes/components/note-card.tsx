import { Pressable, StyleSheet, View } from 'react-native';

import { Icon, Text } from '@/components/ui';
import type { Note } from '@/db/schema';
import type { ChecklistPreviewItem } from '@/features/checklist/repository';
import { radius, spacing, useTheme } from '@/theme';

/** Ítems que se muestran en la vista previa de una checklist. */
const PREVIEW_ITEMS = 6;

type NoteCardProps = {
  note: Note;
  items?: ChecklistPreviewItem[];
  /** Línea inferior (fecha, días en la papelera…). */
  meta?: string;
  compact?: boolean;
  onPress: () => void;
  onLongPress?: () => void;
};

export function NoteCard({
  note,
  items = [],
  meta,
  compact = false,
  onPress,
  onLongPress,
}: NoteCardProps) {
  const { colors, noteColor } = useTheme();
  const hasTitle = note.title.trim().length > 0;
  const isChecklist = note.type === 'checklist';
  const pending = items.filter((i) => !i.isChecked);
  const done = items.length - pending.length;
  // Si quedan pendientes se muestran solo esos; si todo está hecho, los completados.
  const shown = pending.length > 0 ? pending : items;
  const preview = shown.slice(0, PREVIEW_ITEMS);
  const footer = [
    shown.length > preview.length ? `+${shown.length - preview.length} más` : null,
    pending.length > 0 && done > 0 ? `${done} completado${done === 1 ? '' : 's'}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const isEmpty = !hasTitle && (isChecklist ? items.length === 0 : !note.contentText.trim());

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={note.title || 'Nota sin título'}
      accessibilityHint="Mantén pulsado para ver más acciones"
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: noteColor(note.color),
          borderColor: note.color === 'default' ? colors.border : 'transparent',
          opacity: pressed ? 0.85 : 1,
        },
      ]}>
      {hasTitle || note.isPinned ? (
        <View style={styles.header}>
          <Text variant="bodyStrong" numberOfLines={2} style={styles.title}>
            {note.title}
          </Text>
          {note.isPinned ? <Icon name="pinFill" size={14} color={colors.textSecondary} /> : null}
        </View>
      ) : null}

      {isChecklist ? (
        <View style={styles.items}>
          {preview.map((item) => (
            <View key={item.id} style={[styles.item, item.indent > 0 && styles.itemIndented]}>
              <Icon
                name={item.isChecked ? 'checkboxChecked' : 'checkbox'}
                size={14}
                color={colors.textSecondary}
              />
              <Text
                tone={item.isChecked ? 'muted' : 'secondary'}
                numberOfLines={1}
                style={[styles.itemText, item.isChecked && styles.checked]}>
                {item.text || ' '}
              </Text>
            </View>
          ))}
          {footer ? (
            <Text variant="caption" tone="muted">
              {footer}
            </Text>
          ) : null}
        </View>
      ) : note.contentText.trim() ? (
        <Text tone="secondary" numberOfLines={compact ? 3 : 8}>
          {note.contentText.trim()}
        </Text>
      ) : null}

      {isEmpty ? (
        <Text tone="muted" style={styles.empty}>
          Nota vacía
        </Text>
      ) : null}

      {meta ? (
        <Text variant="caption" tone="muted">
          {meta}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  header: { flexDirection: 'row', gap: spacing.xs, alignItems: 'flex-start' },
  title: { flex: 1 },
  items: { gap: spacing.xs },
  item: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  itemIndented: { paddingLeft: spacing.lg },
  itemText: { flex: 1 },
  checked: { textDecorationLine: 'line-through' },
  empty: { fontStyle: 'italic' },
});
