import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon, Text } from '@/components/ui';
import type { Note, Tag } from '@/db/schema';
import type { AttachmentCounts } from '@/features/attachments/repository';
import { resolveUri } from '@/features/attachments/storage';
import type { ChecklistPreviewItem } from '@/features/checklist/repository';
import { ReminderChip } from '@/features/reminders/components/reminder-chip';
import { TagPill } from '@/features/tags/components/tag-pill';
import { radius, spacing, useTheme } from '@/theme';

/** Ítems que se muestran en la vista previa de una checklist. */
const PREVIEW_ITEMS = 6;
/** Etiquetas visibles en la tarjeta; el resto se resume en "+N". */
const PREVIEW_TAGS = 3;
/** Altura máxima de la miniatura (en la lista compacta, más baja). */
const THUMB_MAX_HEIGHT = 220;
const THUMB_MAX_HEIGHT_COMPACT = 140;

export type CardImage = { localUri: string; width: number | null; height: number | null };

type NoteCardProps = {
  note: Note;
  items?: ChecklistPreviewItem[];
  tags?: Tag[];
  /** Primera imagen adjunta (miniatura arriba de la tarjeta). */
  image?: CardImage;
  /** Número de adjuntos por tipo. */
  attachments?: AttachmentCounts;
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
  image: imageProp,
  attachments,
  reminder,
  now,
  meta,
  compact = false,
  selected = false,
  onPress,
  onLongPress,
}: NoteCardProps) {
  const { colors, noteColor } = useTheme();
  const { t } = useTranslation();
  const hasTitle = note.title.trim().length > 0;
  const isChecklist = note.type === 'checklist';
  // Bloqueada: solo título, etiquetas y recordatorio; nada del contenido ni de los adjuntos.
  const locked = note.isLocked;
  const image = locked ? undefined : imageProp;
  const pending = items.filter((i) => !i.isChecked);
  const done = items.length - pending.length;
  // Si quedan pendientes se muestran solo esos; si todo está hecho, los completados.
  const shown = pending.length > 0 ? pending : items;
  const preview = shown.slice(0, PREVIEW_ITEMS);
  const footer = [
    shown.length > preview.length ? t('card.more', { count: shown.length - preview.length }) : null,
    pending.length > 0 && done > 0 ? t('card.completed', { count: done }) : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const imageCount = locked ? 0 : (attachments?.image ?? 0);
  const audioCount = locked ? 0 : (attachments?.audio ?? 0);
  const isEmpty =
    !locked &&
    !hasTitle &&
    !image &&
    audioCount === 0 &&
    (isChecklist ? items.length === 0 : !note.contentText.trim());
  const thumbRatio = image?.width && image.height ? image.width / image.height : 4 / 3;

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
      {image ? (
        <View style={styles.thumbWrap}>
          <Image
            source={{ uri: resolveUri(image.localUri) }}
            style={[
              styles.thumb,
              {
                aspectRatio: Math.max(thumbRatio, 0.75),
                maxHeight: compact ? THUMB_MAX_HEIGHT_COMPACT : THUMB_MAX_HEIGHT,
                backgroundColor: colors.surfaceMuted,
              },
            ]}
            contentFit="cover"
            recyclingKey={note.id}
            transition={100}
          />
          {imageCount > 1 ? (
            <View style={styles.thumbBadge}>
              <Text variant="label" style={styles.thumbBadgeText}>
                +{imageCount - 1}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {hasTitle || note.isPinned || note.isFavorite || locked || selected ? (
        <View style={styles.header}>
          <Text variant="bodyStrong" numberOfLines={2} style={styles.title}>
            {note.title}
          </Text>
          {note.isFavorite ? <Icon name="starFill" size={14} color={colors.primary} /> : null}
          {locked ? <Icon name="lock" size={14} color={colors.textSecondary} /> : null}
          {note.isPinned ? <Icon name="pinFill" size={14} color={colors.textSecondary} /> : null}
          {selected ? <Icon name="checkboxChecked" size={18} color={colors.primary} /> : null}
        </View>
      ) : null}

      {locked ? (
        <Text tone="muted" style={styles.empty}>
          {t('card.locked')}
        </Text>
      ) : isChecklist ? (
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
          {t('card.empty')}
        </Text>
      ) : null}

      {audioCount > 0 ? (
        <View style={styles.audio}>
          <Icon name="mic" size={14} color={colors.textSecondary} />
          <Text variant="caption" tone="secondary">
            {t('card.voiceNotes', { count: audioCount })}
          </Text>
        </View>
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
    note.title || t('card.untitled'),
    note.isPinned ? t('card.a11yPinned') : null,
    note.isFavorite ? t('card.a11yFavorite') : null,
    locked ? t('card.a11yLocked') : null,
    reminder ? t('card.a11yReminder') : null,
    imageCount > 0 ? t('card.a11yImages', { count: imageCount }) : null,
    audioCount > 0 ? t('card.a11yVoice') : null,
  ]
    .filter(Boolean)
    .join(', ');

  if (!onPress) {
    return (
      <View accessible accessibilityLabel={label} aria-selected={selected} style={cardStyle}>
        {content}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      aria-selected={selected}
      accessibilityHint={t('card.a11yHint')}
      testID="note-card"
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
  // La miniatura ocupa todo el ancho de la tarjeta, pegada arriba.
  thumbWrap: {
    marginTop: -spacing.md,
    marginHorizontal: -spacing.md,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    overflow: 'hidden',
  },
  thumb: { width: '100%' },
  thumbBadge: {
    position: 'absolute',
    right: spacing.sm,
    bottom: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  thumbBadgeText: { color: '#FFFFFF' },
  audio: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
});
