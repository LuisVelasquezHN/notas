import type { ReactElement, ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedRef, type AnimatedRef } from 'react-native-reanimated';
import Sortable from 'react-native-sortables';

import { Text } from '@/components/ui';
import type { Note } from '@/db/schema';
import { spacing } from '@/theme';

import { neighborKeys, splitPinned } from '../reorder';
import { moveNoteBetween } from '../repository';

type SortableNoteGridProps = {
  notes: Note[];
  columns: number;
  selecting: boolean;
  renderCard: (note: Note) => ReactNode;
  onTap: (note: Note) => void;
  /** Mantener pulsada una nota sin moverla la selecciona. */
  onHold: (note: Note) => void;
  ListHeaderComponent?: ReactElement | null;
  contentStyle?: object;
};

/**
 * Orden manual: mantener pulsada una nota la levanta y se puede arrastrar. Las ancladas se ordenan
 * en su propia sección. A diferencia de la vista normal (FlashList), no está virtualizada.
 */
export function SortableNoteGrid({
  notes,
  columns,
  selecting,
  renderCard,
  onTap,
  onHold,
  ListHeaderComponent,
  contentStyle,
}: SortableNoteGridProps) {
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const { pinned, others } = splitPinned(notes);
  const titled = pinned.length > 0 && others.length > 0;

  const section = (list: Note[], title: string | null) =>
    list.length > 0 ? (
      <View style={styles.section}>
        {title ? (
          <Text variant="label" tone="secondary" style={styles.sectionTitle}>
            {title}
          </Text>
        ) : null}
        <NoteSection
          notes={list}
          columns={columns}
          selecting={selecting}
          scrollRef={scrollRef}
          renderCard={renderCard}
          onTap={onTap}
          onHold={onHold}
        />
      </View>
    ) : null;

  return (
    <Animated.ScrollView
      ref={scrollRef}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={contentStyle}>
      {ListHeaderComponent ? <View style={styles.header}>{ListHeaderComponent}</View> : null}
      {section(pinned, titled ? 'ANCLADAS' : null)}
      {section(others, titled ? 'OTRAS' : null)}
    </Animated.ScrollView>
  );
}

function NoteSection({
  notes,
  columns,
  selecting,
  scrollRef,
  renderCard,
  onTap,
  onHold,
}: Omit<SortableNoteGridProps, 'ListHeaderComponent' | 'contentStyle'> & {
  scrollRef: AnimatedRef<Animated.ScrollView>;
}) {
  return (
    <Sortable.Grid
      columns={columns}
      data={notes}
      keyExtractor={(note) => note.id}
      rowGap={spacing.sm}
      columnGap={spacing.sm}
      // En selección múltiple, mantener pulsado no arrastra: los toques marcan y desmarcan.
      sortEnabled={!selecting}
      scrollableRef={scrollRef}
      activeItemScale={1.03}
      renderItem={({ item }) => (
        <Sortable.Touchable onTap={() => onTap(item)}>{renderCard(item)}</Sortable.Touchable>
      )}
      onDragEnd={({ fromIndex, toIndex, data }) => {
        const moved = data[toIndex];
        if (fromIndex === toIndex) {
          onHold(moved);
          return;
        }
        const { before, after } = neighborKeys(data, toIndex);
        void moveNoteBetween(moved.id, before, after);
      }}
    />
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.xs, paddingBottom: spacing.sm },
  section: { gap: spacing.sm, paddingHorizontal: spacing.xs, paddingBottom: spacing.md },
  sectionTitle: { paddingHorizontal: spacing.xs },
});
