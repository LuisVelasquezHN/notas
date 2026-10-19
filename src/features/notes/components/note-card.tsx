import { Pressable, StyleSheet, View } from 'react-native';

import { Icon, Text } from '@/components/ui';
import type { Note, Tag } from '@/db/schema';
import type { ChecklistPreviewItem } from '@/features/checklist/repository';
import { ReminderChip } from '@/features/reminders/components/reminder-chip';
import { TagPill } from '@/features/tags/components/tag-pill';
import { radius, spacing, useTheme } from '@/theme';

/** Ítems que se muestran en la vista previa de una checklist. */
const PREVIEW_ITEMS = 6;
/** Etiquetas visibles en la tarjeta; el resto se resume en "+N". */
const PREVIEW_TAGS = 3;

type NoteCardProps = {
  note: Note;
  items?: ChecklistPreviewItem[];
  tags?: Tag[];
  /** Próximo recordatorio activo de la nota (o de sus ítems). */
  reminder?: { fireAt: number; recurring: boolean };
  /** Hora actual, para marcar los recordatorios vencidos. */
  now?: number;
  /** Línea inferior (fecha, días en la papelera…). */
  meta?: string;
  compact?: boolean;
  /** Marcada en selección múltiple. */
  selected?: boolean;
  /** Sin `onPress` la tarjeta no gestiona toques (p. ej. dentro de la lista reordenable). */
  onPress?: () => void;
  onLongPress?: () => void;
};

export function NoteCard({
  note,
  items = [],
  tags = [],
  reminder,
  now,
  meta,
  compact = false,
  selected = false,
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

  const cardStyle = [
    styles.card,
    {
      backgroundColor: noteColor(note.color),
      borderColor: selected
        ? colors.primary
        : note.color === 'default'
          ? colors.border
          : 'transparent',
    },
    selected && styles.selected,
  ];

  const content = (
    <>
      {hasTitle || note.isPinned || note.isFavorite || selected ? (
        <View style={styles.header}>
          <Text variant="bodyStrong" numberOfLines={2} style={styles.title}>
            {note.title}
          </Text>
          {note.isFavorite ? <Icon name="starFill" size={14} color={colors.primary} /> : null}
          {note.isPinned ? <Icon name="pinFill" size={14} color={colors.textSecondary} /> : null}
          {selected ? <Icon name="checkboxChecked" size={18} color={colors.primary} /> : null}
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

      {tags.length > 0 ? (
        <View style={styles.tags}>
          {tags.slice(0, PREVIEW_TAGS).map((tag) => (
            <TagPill key={tag.id} tag={tag} onCard />
          ))}
          {tags.length > PREVIEW_TAGS ? (
            <Text variant="caption" tone="muted">
              +{tags.length - PREVIEW_TAGS}
            </Text>
          ) : null}
        </View>
      ) : null}

      {reminder && now !== undefined && note.deletedAt === null ? (
        <ReminderChip fireAt={reminder.fireAt} recurring={reminder.recurring} now={now} compact />
      ) : null}

      {meta ? (
        <Text variant="caption" tone="muted">
          {meta}
        </Text>
      ) : null}
    </>
  );

  const label = [
    note.title || 'Nota sin título',
    note.isPinned ? 'anclada' : null,
    note.isFavorite ? 'favorita' : null,
    reminder ? 'con recordatorio' : null,
  ]
    .filter(Boolean)
    .join(', ');

  if (!onPress) {
    return (
      <View
        accessible
        accessibilityLabel={label}
        accessibilityState={{ selected }}
        style={cardStyle}>
        {content}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      accessibilityHint="Mantén pulsado para seleccionar"
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      style={({ pressed }) => [cardStyle, { opacity: pressed ? 0.85 : 1 }]}>
      {content}
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
  tags: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.xs },
  selected: { borderWidth: 2, margin: -1.5 },
});
