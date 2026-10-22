import { useMemo, type Ref } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { fonts, typography, useTheme } from '@/theme';

import TipTapDom, { type TipTapHandle, type TipTapTheme } from './rich-text/tiptap-dom';
import type { EditorAdapterProps } from './types';

const MIN_HEIGHT = 240;

/** Fuente de la webview: la del sistema (en web, la misma que el resto de la app). */
const WEB_FONT = process.env.EXPO_OS === 'web' ? fonts.sans : undefined;
const SYSTEM_FONT = '-apple-system, system-ui, Roboto, "Segoe UI", sans-serif';

/**
 * Editor enriquecido (fase 4): TipTap en un DOM component. En iOS y Android vive en una webview
 * que crece con el contenido (`matchContents`), sin scroll propio: el scroll es el de la pantalla.
 */
export function RichTextEditor({
  ref,
  value,
  onChange,
  editable = true,
  placeholder,
  autoFocus = false,
  textColor,
  onFormatChange,
  onFocusChange,
  onCaret,
}: EditorAdapterProps) {
  const { colors, scheme } = useTheme();
  const { t } = useTranslation();
  const theme = useMemo<TipTapTheme>(
    () => ({
      scheme,
      text: textColor ?? colors.text,
      muted: colors.textMuted,
      primary: colors.primary,
      codeBackground: colors.surfaceMuted,
      fontFamily: WEB_FONT ?? SYSTEM_FONT,
      fontSize: typography.body.fontSize,
      lineHeight: typography.body.lineHeight,
      minHeight: MIN_HEIGHT,
    }),
    [textColor, colors, scheme],
  );

  return (
    <View style={styles.root}>
      <TipTapDom
        // `EditorHandle` es la misma forma, con el comando ya tipado.
        ref={ref as Ref<TipTapHandle> | undefined}
        dom={{
          matchContents: true,
          scrollEnabled: false,
          style: styles.webview,
          containerStyle: styles.webview,
          // El teclado lo gestiona la pantalla.
          hideKeyboardAccessoryView: true,
          keyboardDisplayRequiresUserAction: false,
        }}
        content={value}
        editable={editable}
        placeholder={placeholder ?? t('editor.placeholder')}
        label={t('editor.contentLabel')}
        autoFocus={autoFocus}
        theme={theme}
        onChange={onChange}
        onFormatChange={(state) => onFormatChange?.(state)}
        onFocusChange={(focused) => onFocusChange?.(focused)}
        onCaret={(bottom) => onCaret?.(bottom)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { minHeight: MIN_HEIGHT },
  webview: { backgroundColor: 'transparent', minHeight: MIN_HEIGHT },
});
