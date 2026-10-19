import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, EmptyState, IconButton, Screen, Text } from '@/components/ui';
import { FolderActionsSheet } from '@/features/folders/components/folder-actions-sheet';
import {
  FolderFormSheet,
  type FolderFormTarget,
} from '@/features/folders/components/folder-form-sheet';
import { FolderRow } from '@/features/folders/components/folder-row';
import { foldersQuery } from '@/features/folders/repository';
import { buildFolderTree, flattenFolderTree, type FolderNode } from '@/features/folders/tree';
import { folderNoteCountsQuery } from '@/features/notes/repository';
import { radius, spacing, useTheme } from '@/theme';

export default function FoldersScreen() {
  const { colors } = useTheme();
  const { data: folders } = useLiveQuery(foldersQuery());
  const { data: counts } = useLiveQuery(folderNoteCountsQuery());
  const [form, setForm] = useState<FolderFormTarget | null>(null);
  const [menu, setMenu] = useState<FolderNode | null>(null);

  const rows = useMemo(() => flattenFolderTree(buildFolderTree(folders)), [folders]);
  const countById = useMemo(
    () => new Map(counts.map((c) => [c.folderId, Number(c.count)])),
    [counts],
  );

  return (
    <Screen scroll>
      <View style={styles.header}>
        <Text variant="largeTitle">Carpetas</Text>
        <IconButton
          icon="folderAdd"
          accessibilityLabel="Nueva carpeta"
          onPress={() => setForm({ mode: 'create', parentId: null })}
        />
      </View>

      {rows.length > 0 ? (
        <View style={[styles.group, { backgroundColor: colors.surface }]}>
          {rows.map((folder) => (
            <FolderRow
              key={folder.id}
              name={folder.name}
              icon={folder.icon}
              color={folder.color}
              depth={folder.depth}
              count={countById.get(folder.id)}
              onPress={() => router.push({ pathname: '/folder/[id]', params: { id: folder.id } })}
              onLongPress={() => setMenu(folder)}
            />
          ))}
        </View>
      ) : (
        <View style={styles.empty}>
          <EmptyState
            icon="folder"
            title="Sin carpetas"
            description="Agrupa tus notas en carpetas (hasta 3 niveles) con su propio color e icono."
            action={
              <Button
                title="Crear carpeta"
                icon="folderAdd"
                onPress={() => setForm({ mode: 'create', parentId: null })}
              />
            }
          />
        </View>
      )}

      {rows.length > 0 ? (
        <Text variant="caption" tone="muted" style={styles.hint}>
          Mantén pulsada una carpeta para editarla, crear subcarpetas o eliminarla.
        </Text>
      ) : null}

      <View style={[styles.group, styles.system, { backgroundColor: colors.surface }]}>
        <FolderRow
          name="Archivo"
          icon="archive"
          color="default"
          onPress={() => router.push('/archive')}
        />
        <FolderRow
          name="Papelera"
          icon="trash"
          color="default"
          onPress={() => router.push('/trash')}
        />
      </View>

      <FolderFormSheet target={form} onClose={() => setForm(null)} />
      <FolderActionsSheet folder={menu} onClose={() => setMenu(null)} onEdit={setForm} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
  },
  group: { borderRadius: radius.lg, padding: spacing.xs },
  system: { marginTop: spacing.xl, marginBottom: spacing.xxxl },
  empty: { minHeight: 320 },
  hint: { textAlign: 'center', marginTop: spacing.sm },
});
