import { useMemo, useState, type Ref } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, StyleSheet, View } from 'react-native';

import { useSettingsStore } from '@/stores/settings-store';
import { EDITOR_TEXT_SIZES, fonts, useTheme } from '@/theme';

import TipTapDom, { type TipTapHandle, type TipTapTheme } from './rich-text/tiptap-dom';
import type { EditorAdapterProps } from './types';

const MIN_HEIGHT = 240;

/** Fuente de la webview: la del sistema (en web, la misma que el resto de la app). */
const WEB_FONT = process.env.EXPO_OS === 'web' ? fonts.sans : undefined;
const SYSTEM_FONT = '-apple-system, system-ui, Roboto, "Segoe UI", sans-serif';

/**
 * Editor enriquecido (fase 4): TipTap en un DOM component. En iOS y Android vive en una webview
 * del alto justo de su contenido (lo mide el propio editor, `onHeight`) y sin scroll propio: el
 * scroll es el de la pantalla. Con `maxHeight`, si el contenido no cabe, la webview se queda en
 * ese alto y se desplaza por dentro: una webview más alta que la pantalla se dibuja en blanco en
 * Android y el final de las notas largas quedaba inalcanzable.
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
  onSelectionText,
  maxHeight,
}: EditorAdapterProps) {
  const [contentHeight, setContentHeight] = useState(MIN_HEIGHT);
  const { colors, scheme } = useTheme();
  const textSize =
    EDITOR_TEXT_SIZES[useSettingsStore((s) => s.editorTextSize)] ?? EDITOR_TEXT_SIZES.normal;
  const { t } = useTranslation();
  const theme = useMemo<TipTapTheme>(
    () => ({
      scheme,
      text: textColor ?? colors.text,
      muted: colors.textMuted,
      primary: colors.primary,
      codeBackground: colors.surfaceMuted,
      fontFamily: WEB_FONT ?? SYSTEM_FONT,
      fontSize: textSize.fontSize,
      lineHeight: textSize.lineHeight,
      minHeight: MIN_HEIGHT,
    }),
    [textColor, colors, scheme, textSize],
  );

  const native = Platform.OS !== 'web';
  const limit = maxHeight && maxHeight > MIN_HEIGHT ? maxHeight : Infinity;
  const overflow = native && contentHeight > limit;
  const height = native ? Math.max(MIN_HEIGHT, Math.min(contentHeight, limit)) : undefined;

  return (
    <View style={[styles.root, height !== undefined && { height }]}>
      <TipTapDom
        // `EditorHandle` es la misma forma, con el comando ya tipado.
        ref={ref as Ref<TipTapHandle> | undefined}
        dom={{
          scrollEnabled: overflow,
          style: [styles.webview, height !== undefined && { height }],
          containerStyle: [styles.webview, height !== undefined && { height }],
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
        onSelectionText={(text) => onSelectionText?.(text)}
        onHeight={setContentHeight}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { minHeight: MIN_HEIGHT },
  webview: { backgroundColor: 'transparent', minHeight: MIN_HEIGHT },
});
