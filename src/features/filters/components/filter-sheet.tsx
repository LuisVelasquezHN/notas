import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Chip, ColorSwatch, Sheet, Text } from '@/components/ui';
import type { NoteType } from '@/db/schema';
import { foldersQuery } from '@/features/folders/repository';
import { buildFolderTree, flattenFolderTree } from '@/features/folders/tree';
import { tagsQuery } from '@/features/tags/repository';
import { NOTE_COLOR_TOKENS, spacing } from '@/theme';

import {
  MODIFIED_WITHIN,
  MODIFIED_WITHIN_LABELS,
  activeCriteriaCount,
  toggleValue,
  type NoteFilter,
} from '../filter';

/** Tipos que se pueden filtrar hoy (imágenes y voz llegan en la fase 4). */
export const FILTERABLE_TYPES: { value: NoteType; label: string }[] = [
  { value: 'text', label: 'Texto' },
  { value: 'checklist', label: 'Lista' },
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
  const { data: tags } = useLiveQuery(tagsQuery());
  const { data: folders } = useLiveQuery(foldersQuery());
  const folderRows = flattenFolderTree(buildFolderTree(folders));
  const set = (patch: Partial<NoteFilter>) => onChange({ ...filter, ...patch });

  return (
    <Sheet visible={visible} onClose={onClose} title="Filtros">
      <View style={styles.body}>
        <Section title="TIPO">
          {FILTERABLE_TYPES.map(({ value, label }) => (
            <Chip
              key={value}
              label={label}
              icon={value === 'checklist' ? 'checklist' : 'text'}
              selected={filter.types?.includes(value) ?? false}
              onPress={() => set({ types: toggleValue(filter.types, value) })}
            />
          ))}
        </Section>

        <Section title="COLOR">
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
          <Section title="ETIQUETAS">
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
          <Section title="CARPETA">
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

        <Section title="MODIFICADA">
          {MODIFIED_WITHIN.map((value) => (
            <Chip
              key={value}
              label={MODIFIED_WITHIN_LABELS[value]}
              selected={filter.modifiedWithin === value}
              onPress={() =>
                set({ modifiedWithin: filter.modifiedWithin === value ? undefined : value })
              }
            />
          ))}
        </Section>

        <Section title="OTROS">
          <Chip
            label="Favoritas"
            icon="star"
            selected={filter.favorite ?? false}
            onPress={() => set({ favorite: !filter.favorite || undefined })}
          />
          <Chip
            label="Con recordatorio"
            icon="bell"
            selected={filter.hasReminder ?? false}
            onPress={() => set({ hasReminder: !filter.hasReminder || undefined })}
          />
          <Chip
            label="Con adjuntos"
            icon="attachment"
            selected={filter.hasAttachments ?? false}
            onPress={() => set({ hasAttachments: !filter.hasAttachments || undefined })}
          />
          <Chip
            label="Incluir archivadas"
            icon="archive"
            selected={filter.includeArchived ?? false}
            onPress={() => set({ includeArchived: !filter.includeArchived || undefined })}
          />
        </Section>

        <View style={styles.footer}>
          <Button
            title="Limpiar"
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
                ? 'Listo'
                : resultCount === 1
                  ? 'Ver 1 nota'
                  : `Ver ${resultCount} notas`
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
      <Text variant="label" tone="secondary">
        {title}
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
