import { StyleSheet, View } from 'react-native';

import { IconButton } from '@/components/ui';
import { FormatBar } from '@/features/editor/components/format-bar';
import type { FormatCommand, FormatState } from '@/features/editor/format';
import { MAX_CONTENT_WIDTH, spacing, useTheme } from '@/theme';

type NoteToolbarProps = {
  background: string;
  bottomInset: number;
  onAttach: () => void;
  onRecord: () => void;
  /** Solo en notas de texto con editor enriquecido. */
  format?: {
    open: boolean;
    state: FormatState;
    onToggle: () => void;
    onFormat: (command: FormatCommand) => void;
  };
};

/**
 * Barra inferior del editor: añadir (imágenes, voz) y formato. Con el teclado abierto queda justo
 * encima (la pantalla usa `KeyboardAvoidingView`).
 */
export function NoteToolbar({
  background,
  bottomInset,
  onAttach,
  onRecord,
  format,
}: NoteToolbarProps) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.root,
        { backgroundColor: background, borderTopColor: colors.border, paddingBottom: bottomInset },
      ]}>
      <View style={styles.inner}>
        {format?.open ? (
          <>
            <IconButton
              icon="close"
              accessibilityLabel="Cerrar formato"
              onPress={format.onToggle}
            />
            <View style={styles.formats}>
              <FormatBar state={format.state} onFormat={format.onFormat} />
            </View>
          </>
        ) : (
          <>
            <IconButton
              icon="addBox"
              accessibilityLabel="Añadir imagen o audio"
              onPress={onAttach}
            />
            <IconButton icon="mic" accessibilityLabel="Grabar nota de voz" onPress={onRecord} />
            {format ? (
              <IconButton
                icon="textFormat"
                accessibilityLabel="Formato de texto"
                onPress={format.onToggle}
              />
            ) : null}
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { borderTopWidth: StyleSheet.hairlineWidth },
  inner: {
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    minHeight: 52,
  },
  formats: { flex: 1 },
});
