import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, TextInput } from 'react-native';

import { useAutoGrow } from '@/lib/use-auto-grow';
import { fonts, typography, useTheme } from '@/theme';

import { docToText, textToDoc } from './doc';
import type { EditorAdapterProps } from './types';

const MIN_HEIGHT = 240;

/** Implementación MVP del editor: texto plano sobre un `TextInput` multilínea. */
export function PlainTextEditor({
  value,
  onChange,
  editable = true,
  placeholder,
  autoFocus = false,
  textColor,
}: EditorAdapterProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const text = useMemo(() => docToText(value), [value]);
  const autoGrow = useAutoGrow(MIN_HEIGHT);

  return (
    <TextInput
      accessibilityLabel={t('editor.contentLabel')}
      value={text}
      onChangeText={(next) => onChange(textToDoc(next))}
      editable={editable}
      placeholder={placeholder ?? t('editor.placeholder')}
      placeholderTextColor={colors.textMuted}
      selectionColor={colors.primary}
      autoFocus={autoFocus}
      multiline
      // El scroll lo gestiona la pantalla (título + contenido en el mismo ScrollView).
      scrollEnabled={false}
      textAlignVertical="top"
      onContentSizeChange={autoGrow.onContentSizeChange}
      numberOfLines={autoGrow.numberOfLines}
      style={[
        styles.input,
        typography.body,
        { fontFamily: fonts.sans, color: textColor ?? colors.text },
        autoGrow.style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    minHeight: MIN_HEIGHT,
    padding: 0,
    // En web, quita el contorno de foco del navegador dentro del área de escritura.
    outlineStyle: 'none',
  } as object,
});
