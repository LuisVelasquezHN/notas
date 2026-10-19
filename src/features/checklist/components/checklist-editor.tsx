import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useRef, useState, type ComponentRef } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import type { AnimatedRef } from 'react-native-reanimated';
import Sortable from 'react-native-sortables';

import { Icon, IconButton, Text } from '@/components/ui';
import type { ChecklistItem, Note } from '@/db/schema';
import { useAutosave } from '@/features/notes/hooks/use-autosave';
import { consumeWebEnter } from '@/lib/keyboard';
import { useAutoGrow } from '@/lib/use-auto-grow';
import { showUndo } from '@/stores/snackbar-store';
import { fonts, radius, spacing, typography, useTheme } from '@/theme';

import {
  MAX_INDENT,
  addItem,
  checklistItemsQuery,
  deleteCheckedItems,
  deleteItem,
  moveItem,
  restoreItem,
  restoreItems,
  setItemChecked,
  setItemIndent,
  uncheckAll,
  updateItemText,
} from '../repository';

type InputRef = ComponentRef<typeof TextInput>;

type ChecklistEditorProps = {
  note: Note;
  editable: boolean;
  /** ScrollView que contiene la lista, para el auto-scroll al arrastrar. */
  scrollableRef?: AnimatedRef<any>;
};

/**
 * Editor de checklist: marcar, reordenar arrastrando el asa, sangría de subtareas
 * y completados agrupados al final. Cada cambio se guarda al momento.
 */
export function ChecklistEditor({ note, editable, scrollableRef }: ChecklistEditorProps) {
  const { colors } = useTheme();
  const { data: items } = useLiveQuery(checklistItemsQuery(note.id), [note.id]);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [showChecked, setShowChecked] = useState(true);
  const inputs = useRef(new Map<string, InputRef>());

  const pending = items.filter((i) => !i.isChecked);
  const checked = items.filter((i) => i.isChecked);

  async function addAfter(item: ChecklistItem | null, indent = 0) {
    const created = await addItem(note.id, item?.sortKey ?? pending.at(-1)?.sortKey ?? null, {
      indent,
    });
    setFocusId(created.id);
  }

  async function removeEmpty(item: ChecklistItem) {
    const index = pending.findIndex((i) => i.id === item.id);
    const previous = index > 0 ? pending[index - 1] : null;
    await deleteItem(item);
    if (previous) inputs.current.get(previous.id)?.focus();
  }

  async function remove(item: ChecklistItem) {
    await deleteItem(item);
    showUndo('Elemento eliminado', () => restoreItem(item));
  }

  async function removeChecked() {
    const ids = await deleteCheckedItems(note.id);
    showUndo(ids.length === 1 ? '1 elemento eliminado' : `${ids.length} elementos eliminados`, () =>
      restoreItems(note.id, ids),
    );
  }

  const renderRow = (item: ChecklistItem) => (
    <ChecklistRow
      key={item.id}
      item={item}
      editable={editable}
      autoFocus={item.id === focusId}
      draggable={editable && !item.isChecked}
      inputRef={(input) => {
        if (input) inputs.current.set(item.id, input);
        else inputs.current.delete(item.id);
      }}
      onSubmit={() => void addAfter(item, item.indent)}
      onBackspaceEmpty={() => void removeEmpty(item)}
      onDelete={() => void remove(item)}
    />
  );

  return (
    <View style={styles.root}>
      {pending.length > 0 ? (
        <Sortable.Grid
          columns={1}
          data={pending}
          keyExtractor={(item) => item.id}
          customHandle
          sortEnabled={editable}
          scrollableRef={scrollableRef}
          activeItemScale={1.02}
          renderItem={({ item }) => renderRow(item)}
          onDragEnd={({ fromIndex, toIndex, data }) => {
            if (fromIndex === toIndex) return;
            const moved = data[toIndex];
            void moveItem(moved, toIndex > 0 ? data[toIndex - 1].sortKey : null);
          }}
        />
      ) : null}

      {editable ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => void addAfter(null)}
          style={({ pressed }) => [styles.addRow, pressed && { opacity: 0.6 }]}>
          <Icon name="add" size={20} color={colors.textSecondary} />
          <Text tone="secondary">Elemento de la lista</Text>
        </Pressable>
      ) : null}

      {checked.length > 0 ? (
        <View style={[styles.checkedSection, { borderTopColor: colors.border }]}>
          <View style={styles.checkedHeader}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: showChecked }}
              onPress={() => setShowChecked((v) => !v)}
              style={styles.checkedToggle}>
              <View style={{ transform: [{ rotate: showChecked ? '0deg' : '-90deg' }] }}>
                <Icon name="chevronDown" size={16} color={colors.textSecondary} />
              </View>
              <Text tone="secondary">
                {checked.length === 1 ? '1 completado' : `${checked.length} completados`}
              </Text>
            </Pressable>
            {editable ? (
              <>
                <IconButton
                  icon="checkbox"
                  size={18}
                  color={colors.textSecondary}
                  accessibilityLabel="Desmarcar todos"
                  onPress={() => void uncheckAll(note.id)}
                />
                <IconButton
                  icon="trash"
                  size={18}
                  color={colors.textSecondary}
                  accessibilityLabel="Eliminar completados"
                  onPress={() => void removeChecked()}
                />
              </>
            ) : null}
          </View>
          {showChecked ? checked.map(renderRow) : null}
        </View>
      ) : null}
    </View>
  );
}

type ChecklistRowProps = {
  item: ChecklistItem;
  editable: boolean;
  autoFocus: boolean;
  draggable: boolean;
  inputRef: (input: InputRef | null) => void;
  onSubmit: () => void;
  onBackspaceEmpty: () => void;
  onDelete: () => void;
};

function ChecklistRow({
  item,
  editable,
  autoFocus,
  draggable,
  inputRef,
  onSubmit,
  onBackspaceEmpty,
  onDelete,
}: ChecklistRowProps) {
  const { colors } = useTheme();
  const [text, setText] = useState(item.text);
  const [focused, setFocused] = useState(false);
  const autoGrow = useAutoGrow();
  const flush = useAutosave(text, (value) => updateItemText(item, value), { delay: 400 });

  // Si el texto cambia fuera de esta fila (deshacer, otra pantalla) y no se está editando, se adopta.
  const [lastItemText, setLastItemText] = useState(item.text);
  if (item.text !== lastItemText) {
    setLastItemText(item.text);
    if (!focused) setText(item.text);
  }

  return (
    <View style={[styles.row, { paddingLeft: item.indent * spacing.xl }]}>
      {draggable ? (
        <Sortable.Handle>
          <View accessibilityLabel="Arrastrar para reordenar" style={styles.handle}>
            <Icon name="dragHandle" size={18} color={colors.textMuted} />
          </View>
        </Sortable.Handle>
      ) : (
        <View style={styles.handle} />
      )}
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: item.isChecked }}
        accessibilityLabel={item.text || 'Elemento'}
        disabled={!editable}
        hitSlop={6}
        onPress={() => {
          void flush();
          void setItemChecked(item, !item.isChecked);
        }}>
        <Icon
          name={item.isChecked ? 'checkboxChecked' : 'checkbox'}
          size={22}
          color={item.isChecked ? colors.textMuted : colors.textSecondary}
        />
      </Pressable>
      <TextInput
        ref={inputRef}
        value={text}
        onChangeText={setText}
        editable={editable}
        autoFocus={autoFocus}
        multiline
        // Intro crea el siguiente elemento en vez de un salto de línea.
        submitBehavior="submit"
        onSubmitEditing={() => {
          void flush();
          onSubmit();
        }}
        onKeyPress={(e) => {
          if (consumeWebEnter(e)) {
            void flush();
            onSubmit();
          } else if (e.nativeEvent.key === 'Backspace' && text === '') {
            onBackspaceEmpty();
          }
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          // Con retraso: en web el blur llega antes que el clic en los botones de la fila.
          setTimeout(() => setFocused(false), 200);
          void flush();
        }}
        placeholder="Elemento"
        placeholderTextColor={colors.textMuted}
        selectionColor={colors.primary}
        scrollEnabled={false}
        onContentSizeChange={autoGrow.onContentSizeChange}
        numberOfLines={autoGrow.numberOfLines}
        style={[
          styles.input,
          autoGrow.style,
          typography.body,
          {
            fontFamily: fonts.sans,
            color: item.isChecked ? colors.textMuted : colors.text,
            textDecorationLine: item.isChecked ? 'line-through' : 'none',
          },
        ]}
      />
      {editable && focused ? (
        <View style={styles.rowActions}>
          <IconButton
            icon={item.indent >= MAX_INDENT ? 'outdent' : 'indent'}
            size={18}
            color={colors.textSecondary}
            accessibilityLabel={
              item.indent >= MAX_INDENT ? 'Quitar sangría' : 'Convertir en subtarea'
            }
            onPress={() =>
              void setItemIndent(item, item.indent >= MAX_INDENT ? 0 : item.indent + 1)
            }
          />
          <IconButton
            icon="close"
            size={18}
            color={colors.textSecondary}
            accessibilityLabel="Eliminar elemento"
            onPress={onDelete}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 44,
    borderRadius: radius.sm,
  },
  handle: { width: 24, height: 36, alignItems: 'center', justifyContent: 'center' },
  input: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    outlineStyle: 'none',
  } as object,
  rowActions: { flexDirection: 'row' },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 44,
    paddingLeft: 24 + spacing.xs,
  },
  checkedSection: {
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  checkedHeader: { flexDirection: 'row', alignItems: 'center' },
  checkedToggle: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 40,
    paddingLeft: spacing.xs,
  },
});
