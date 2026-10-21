import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Button, Chip, ColorSwatch, Sheet, Text, type IconName } from '@/components/ui';
import type { NoteType } from '@/db/schema';
import { foldersQuery } from '@/features/folders/repository';
import { buildFolderTree, flattenFolderTree } from '@/features/folders/tree';
import { tagsQuery } from '@/features/tags/repository';
import { NOTE_COLOR_TOKENS, spacing } from '@/theme';

import {
  MODIFIED_WITHIN,
  activeCriteriaCount,
  modifiedWithinLabel,
  toggleValue,
  type NoteFilter,
} from '../filter';

/** Tipos que se pueden filtrar. */
export const FILTERABLE_TYPES: { value: NoteType; icon: IconName }[] = [
  { value: 'text', icon: 'text' },
  { value: 'checklist', icon: 'checklist' },
  // Imagen y voz: notas con imágenes o audios adjuntos (ver `typesCondition`).
  { value: 'image', icon: 'image' },
  { value: 'audio', icon: 'mic' },
];

type FilterSheetProps = {
  visible: boolean;
  filter: NoteFilter;
  onChange: (filter: NoteFilter) => void;
  onClose: () => void;
  /** Número de resultados con el filtro actual (para el botón). */
  resultCount?: number;
};

/** Filtros combinables. Cada cambio se aplica al momento. */
export function FilterSheet({ visible, filter, onChange, onClose, resultCount }: FilterSheetProps) {
  const { t } = useTranslation();
  const { data: tags } = useLiveQuery(tagsQuery());
  const { data: folders } = useLiveQuery(foldersQuery());
  const folderRows = flattenFolderTree(buildFolderTree(folders));
  const set = (patch: Partial<NoteFilter>) => onChange({ ...filter, ...patch });

  return (
    <Sheet visible={visible} onClose={onClose} title={t('filters.title')}>
      <View style={styles.body}>
        <Section title={t('filters.type')}>
          {FILTERABLE_TYPES.map(({ value, icon }) => (
            <Chip
              key={value}
              label={t(`noteTypes.${value}`)}
              icon={icon}
              selected={filter.types?.includes(value) ?? false}
              onPress={() => set({ types: toggleValue(filter.types, value) })}
            />
          ))}
        </Section>

        <Section title={t('filters.color')}>
          {NOTE_COLOR_TOKENS.map((color) => (
            <ColorSwatch
              key={color}
              color={color}
              selected={filter.colors?.includes(color) ?? false}
              onPress={() => set({ colors: toggleValue(filter.colors, color) })}
            />
          ))}
        </Section>

        {tags.length > 0 ? (
          <Section title={t('filters.tags')}>
            {tags.map((tag) => (
              <Chip
                key={tag.id}
                label={tag.name}
                icon="tag"
                selected={filter.tagIds?.includes(tag.id) ?? false}
                onPress={() => set({ tagIds: toggleValue(filter.tagIds, tag.id) })}
              />
            ))}
          </Section>
        ) : null}

        {folderRows.length > 0 ? (
          <Section title={t('filters.folder')}>
            {folderRows.map((folder) => (
              <Chip
                key={folder.id}
                label={folder.name}
                icon="folder"
                selected={filter.folderIds?.includes(folder.id) ?? false}
                onPress={() => set({ folderIds: toggleValue(filter.folderIds, folder.id) })}
              />
            ))}
          </Section>
        ) : null}

        <Section title={t('filters.modifiedTitle')}>
          {MODIFIED_WITHIN.map((value) => (
            <Chip
              key={value}
              label={modifiedWithinLabel(value, t)}
              selected={filter.modifiedWithin === value}
              onPress={() =>
                set({ modifiedWithin: filter.modifiedWithin === value ? undefined : value })
              }
            />
          ))}
        </Section>

        <Section title={t('filters.other')}>
          <Chip
            label={t('filters.flags.favorite')}
            icon="star"
            selected={filter.favorite ?? false}
            onPress={() => set({ favorite: !filter.favorite || undefined })}
          />
          <Chip
            label={t('filters.flags.hasReminder')}
            icon="bell"
            selected={filter.hasReminder ?? false}
            onPress={() => set({ hasReminder: !filter.hasReminder || undefined })}
          />
          <Chip
            label={t('filters.flags.hasAttachments')}
            icon="attachment"
            selected={filter.hasAttachments ?? false}
            onPress={() => set({ hasAttachments: !filter.hasAttachments || undefined })}
          />
          <Chip
            label={t('filters.includeArchived')}
            icon="archive"
            selected={filter.includeArchived ?? false}
            onPress={() => set({ includeArchived: !filter.includeArchived || undefined })}
          />
        </Section>

        <View style={styles.footer}>
          <Button
            title={t('filters.clear')}
            variant="secondary"
            disabled={activeCriteriaCount(filter) === 0}
            onPress={() =>
              onChange({ search: filter.search, includeArchived: filter.includeArchived })
            }
            style={styles.footerButton}
          />
          <Button
            title={
              resultCount === undefined
                ? t('common.done')
                : t('filters.showResults', { count: resultCount })
            }
            onPress={onClose}
            style={styles.footerButton}
          />
        </View>
      </View>
    </Sheet>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text variant="label" tone="secondary" accessibilityRole="header">
        {title.toUpperCase()}
      </Text>
      <View style={styles.wrap}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.lg, paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  section: { gap: spacing.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  footer: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  footerButton: { flex: 1 },
});
