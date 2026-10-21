import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { IconButton } from '@/components/ui';
import { useSettingsStore } from '@/stores/settings-store';

import { SortSheet } from './sort-sheet';

/** Botones de cabecera para ordenar y alternar lista/cuadrícula. */
export function ListControls({ sortable = true }: { sortable?: boolean }) {
  const layout = useSettingsStore((s) => s.notesLayout);
  const setLayout = useSettingsStore((s) => s.setNotesLayout);
  const [sortOpen, setSortOpen] = useState(false);
  const { t } = useTranslation();

  return (
    <>
      {sortable ? (
        <IconButton
          icon="sort"
          accessibilityLabel={t('sort.button')}
          onPress={() => setSortOpen(true)}
        />
      ) : null}
      <IconButton
        icon={layout === 'grid' ? 'list' : 'grid'}
        accessibilityLabel={layout === 'grid' ? t('sort.asList') : t('sort.asGrid')}
        onPress={() => setLayout(layout === 'grid' ? 'list' : 'grid')}
      />
      <SortSheet visible={sortOpen} onClose={() => setSortOpen(false)} />
    </>
  );
}
