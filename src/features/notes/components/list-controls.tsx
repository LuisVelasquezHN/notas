import { useState } from 'react';

import { IconButton } from '@/components/ui';
import { useSettingsStore } from '@/stores/settings-store';

import { SortSheet } from './sort-sheet';

/** Botones de cabecera para ordenar y alternar lista/cuadrícula. */
export function ListControls({ sortable = true }: { sortable?: boolean }) {
  const layout = useSettingsStore((s) => s.notesLayout);
  const setLayout = useSettingsStore((s) => s.setNotesLayout);
  const [sortOpen, setSortOpen] = useState(false);

  return (
    <>
      {sortable ? (
        <IconButton icon="sort" accessibilityLabel="Ordenar" onPress={() => setSortOpen(true)} />
      ) : null}
      <IconButton
        icon={layout === 'grid' ? 'list' : 'grid'}
        accessibilityLabel={layout === 'grid' ? 'Ver como lista' : 'Ver como cuadrícula'}
        onPress={() => setLayout(layout === 'grid' ? 'list' : 'grid')}
      />
      <SortSheet visible={sortOpen} onClose={() => setSortOpen(false)} />
    </>
  );
}
