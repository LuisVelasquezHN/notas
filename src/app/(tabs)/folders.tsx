import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Button, EmptyState, IconButton, Screen, Text } from '@/components/ui';
import type { Tag } from '@/db/schema';
import {
  SmartFolderFormSheet,
  type SmartFolderFormTarget,
} from '@/features/filters/components/smart-folder-form-sheet';
import { savedFiltersQuery } from '@/features/filters/repository';
import { FolderActionsSheet } from '@/features/folders/components/folder-actions-sheet';
import {
  FolderFormSheet,
  type FolderFormTarget,
} from '@/features/folders/components/folder-form-sheet';
import { FolderRow } from '@/features/folders/components/folder-row';
import { foldersQuery } from '@/features/folders/repository';
import { buildFolderTree, flattenFolderTree, type FolderNode } from '@/features/folders/tree';
import { favoriteCountQuery, folderNoteCountsQuery } from '@/features/notes/repository';
import { TagActionsSheet } from '@/features/tags/components/tag-actions-sheet';
import { TagFormSheet, type TagFormTarget } from '@/features/tags/components/tag-form-sheet';
import { tagNoteCountsQuery, tagsQuery } from '@/features/tags/repository';
import { radius, spacing, useTheme } from '@/theme';

export default function FoldersScreen() {
  const { t } = useTranslation();
  const { data: folders } = useLiveQuery(foldersQuery());
  const { data: counts } = useLiveQuery(folderNoteCountsQuery());
  const { data: smartFolders } = useLiveQuery(savedFiltersQuery());
  const { data: tags } = useLiveQuery(tagsQuery());
  const { data: tagCounts } = useLiveQuery(tagNoteCountsQuery());
  const { data: favorites } = useLiveQuery(favoriteCountQuery());
  const [form, setForm] = useState<FolderFormTarget | null>(null);
  const [menu, setMenu] = useState<FolderNode | null>(null);
  const [tagForm, setTagForm] = useState<TagFormTarget | null>(null);
  const [tagMenu, setTagMenu] = useState<Tag | null>(null);
  const [smartForm, setSmartForm] = useState<SmartFolderFormTarget | null>(null);

  const rows = useMemo(() => flattenFolderTree(buildFolderTree(folders)), [folders]);
  const countById = useMemo(
    () => new Map(counts.map((c) => [c.folderId, Number(c.count)])),
    [counts],
  );
  const tagCountById = useMemo(
    () => new Map(tagCounts.map((c) => [c.tagId, Number(c.count)])),
    [tagCounts],
  );

  return (
    <Screen scroll>
      <View style={styles.header}>
        <Text variant="largeTitle">{t('folders.title')}</Text>
        <IconButton
          icon="folderAdd"
          accessibilityLabel={t('folders.newFolder')}
          onPress={() => setForm({ mode: 'create', parentId: null })}
        />
      </View>

      {rows.length > 0 ? (
        <Group>
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
        </Group>
      ) : (
        <View style={styles.empty}>
          <EmptyState
            icon="folder"
            title={t('folders.empty')}
            description={t('folders.emptyHint')}
            action={
              <Button
                title={t('folders.create')}
                icon="folderAdd"
                onPress={() => setForm({ mode: 'create', parentId: null })}
              />
            }
          />
        </View>
      )}

      {rows.length > 0 ? (
        <Text variant="caption" tone="muted" style={styles.hint}>
          {t('folders.longPressHint')}
        </Text>
      ) : null}

      <SectionHeader
        title={t('folders.smart')}
        addLabel={t('folders.newSmart')}
        onAdd={() => setSmartForm({ mode: 'create', filter: {} })}
      />
      {smartFolders.length > 0 ? (
        <Group>
          {smartFolders.map((saved) => (
            <FolderRow
              key={saved.id}
              name={saved.name}
              icon={saved.icon ?? 'smartFolder'}
              color="default"
              onPress={() => router.push({ pathname: '/smart/[id]', params: { id: saved.id } })}
            />
          ))}
        </Group>
      ) : (
        <Text variant="caption" tone="muted" style={styles.sectionHint}>
          {t('folders.smartHint')}
        </Text>
      )}

      <SectionHeader
        title={t('folders.tags')}
        addLabel={t('folders.newTag')}
        onAdd={() => setTagForm({ mode: 'create' })}
      />
      {tags.length > 0 ? (
        <Group>
          {tags.map((tag) => (
            <FolderRow
              key={tag.id}
              name={tag.name}
              icon="tag"
              color={tag.color}
              count={tagCountById.get(tag.id)}
              onPress={() => router.push({ pathname: '/tag/[id]', params: { id: tag.id } })}
              onLongPress={() => setTagMenu(tag)}
            />
          ))}
        </Group>
      ) : (
        <Text variant="caption" tone="muted" style={styles.sectionHint}>
          {t('folders.tagsHint')}
        </Text>
      )}

      <View style={styles.system}>
        <Group>
          <FolderRow
            name={t('screens.favorites')}
            icon="star"
            color="default"
            count={Number(favorites[0]?.count ?? 0)}
            onPress={() => router.push('/favorites')}
          />
          <FolderRow
            name={t('vault.title')}
            icon="vault"
            color="default"
            onPress={() => router.push('/vault')}
          />
          <FolderRow
            name={t('screens.archive')}
            icon="archive"
            color="default"
            onPress={() => router.push('/archive')}
          />
          <FolderRow
            name={t('screens.trash')}
            icon="trash"
            color="default"
            onPress={() => router.push('/trash')}
          />
        </Group>
      </View>

      <FolderFormSheet target={form} onClose={() => setForm(null)} />
      <FolderActionsSheet folder={menu} onClose={() => setMenu(null)} onEdit={setForm} />
      <TagFormSheet target={tagForm} onClose={() => setTagForm(null)} />
      <TagActionsSheet tag={tagMenu} onClose={() => setTagMenu(null)} onEdit={setTagForm} />
      <SmartFolderFormSheet
        target={smartForm}
        onClose={() => setSmartForm(null)}
        onCreated={(saved) => router.push({ pathname: '/smart/[id]', params: { id: saved.id } })}
      />
    </Screen>
  );
}

function Group({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  return <View style={[styles.group, { backgroundColor: colors.surface }]}>{children}</View>;
}

function SectionHeader({
  title,
  addLabel,
  onAdd,
}: {
  title: string;
  addLabel: string;
  onAdd: () => void;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text variant="heading">{title}</Text>
      <IconButton icon="add" accessibilityLabel={addLabel} onPress={onAdd} />
    </View>
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
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  sectionHint: { paddingHorizontal: spacing.xs },
  system: { marginTop: spacing.xl, marginBottom: spacing.xxxl },
  empty: { minHeight: 320 },
  hint: { textAlign: 'center', marginTop: spacing.sm },
});
