import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Icon, Text, type IconName } from '@/components/ui';
import { radius, spacing, useTheme } from '@/theme';

import {
  FONT_FAMILIES,
  FONT_SIZES,
  HIGHLIGHTS,
  STYLE_VALUES,
  TEXT_COLORS,
  type FormatAction,
  type FormatCommand,
  type FormatState,
  type StyleKind,
} from '../format';

type ToggleButton = { command: FormatCommand } & ({ icon: IconName } | { text: string });

const TOGGLES_BEFORE: ToggleButton[] = [
  { command: 'heading1', text: 'H1' },
  { command: 'heading2', text: 'H2' },
  { command: 'bold', icon: 'bold' },
  { command: 'italic', icon: 'italic' },
  { command: 'underline', icon: 'underline' },
  { command: 'strike', icon: 'strike' },
  { command: 'important', icon: 'important' },
];

const PANELS: { kind: StyleKind; icon: IconName }[] = [
  { kind: 'textColor', icon: 'textColor' },
  { kind: 'highlight', icon: 'highlight' },
  { kind: 'fontFamily', icon: 'fontFamily' },
  { kind: 'fontSize', icon: 'fontSize' },
];

const TOGGLES_AFTER: ToggleButton[] = [
  { command: 'bulletList', icon: 'listBullet' },
  { command: 'orderedList', icon: 'listNumber' },
  { command: 'taskList', icon: 'checklist' },
  { command: 'blockquote', icon: 'quote' },
  { command: 'code', icon: 'code' },
  { command: 'clear', icon: 'formatClear' },
];

/** Tamaño de la letra de muestra en el selector de tamaño. */
const SIZE_PREVIEW = { small: 13, normal: 16, large: 20, xlarge: 24 } as const;

type FormatBarProps = {
  state: FormatState;
  onFormat: (action: FormatAction) => void;
};

/**
 * Botones de formato del editor enriquecido; resalta los formatos activos en la selección. Color,
 * resaltado, tipo de letra y tamaño abren una fila con sus opciones en la misma barra (sin tapar
 * el texto ni cerrar el teclado).
 */
export function FormatBar({ state, onFormat }: FormatBarProps) {
  const { colors, scheme } = useTheme();
  const { t } = useTranslation();
  const [panel, setPanel] = useState<StyleKind | null>(null);

  const toggle = (button: ToggleButton) => {
    const active = button.command !== 'clear' && !!state[button.command];
    const color = active ? colors.onPrimary : colors.text;
    return (
      <BarButton
        key={button.command}
        label={t(`format.${button.command}`)}
        active={button.command === 'clear' ? undefined : active}
        onPress={() => onFormat(button.command)}>
        {'icon' in button ? (
          <Icon name={button.icon} size={20} color={color} />
        ) : (
          <Text variant="bodyStrong" style={{ color }}>
            {button.text}
          </Text>
        )}
      </BarButton>
    );
  };

  if (panel) {
    const apply = (value: string | null) => {
      onFormat({ style: panel, value } as FormatAction);
      setPanel(null);
    };
    const current = state[panel] ?? null;
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="always"
        contentContainerStyle={styles.row}>
        <BarButton label={t('format.back')} onPress={() => setPanel(null)}>
          <Icon name="chevronLeft" size={20} />
        </BarButton>
        {panel === 'textColor' || panel === 'highlight' ? (
          <>
            <BarButton
              label={t('format.noColor')}
              active={current === null}
              onPress={() => apply(null)}>
              <Icon
                name="noColor"
                size={20}
                color={current === null ? colors.onPrimary : colors.text}
              />
            </BarButton>
            {(panel === 'textColor' ? TEXT_COLORS : HIGHLIGHTS).map((token) => {
              const value =
                panel === 'textColor'
                  ? STYLE_VALUES.textColor[scheme][
                      token as keyof (typeof STYLE_VALUES.textColor)['light']
                    ]
                  : STYLE_VALUES.highlight[scheme][
                      token as keyof (typeof STYLE_VALUES.highlight)['light']
                    ];
              const selected = current === token;
              return (
                <BarButton
                  key={token}
                  label={t(`format.colors.${token}`)}
                  active={selected}
                  onPress={() => apply(token)}>
                  {panel === 'textColor' ? (
                    <Text
                      variant="bodyStrong"
                      style={{ color: selected ? colors.onPrimary : value }}>
                      A
                    </Text>
                  ) : (
                    <View
                      style={[
                        styles.swatch,
                        { backgroundColor: value, borderColor: colors.border },
                      ]}>
                      <Text variant="label" style={{ color: colors.text }}>
                        A
                      </Text>
                    </View>
                  )}
                </BarButton>
              );
            })}
          </>
        ) : null}
        {panel === 'fontFamily'
          ? FONT_FAMILIES.map((token) => {
              const selected = (current ?? 'sans') === token;
              return (
                <BarButton
                  key={token}
                  label={t(`format.fonts.${token}`)}
                  active={selected}
                  onPress={() => apply(token)}>
                  <Text style={{ color: selected ? colors.onPrimary : colors.text }}>
                    {t(`format.fonts.${token}`)}
                  </Text>
                </BarButton>
              );
            })
          : null}
        {panel === 'fontSize'
          ? FONT_SIZES.map((token) => {
              const selected = (current ?? 'normal') === token;
              return (
                <BarButton
                  key={token}
                  label={t(`format.sizes.${token}`)}
                  active={selected}
                  onPress={() => apply(token)}>
                  <Text
                    style={{
                      color: selected ? colors.onPrimary : colors.text,
                      fontSize: SIZE_PREVIEW[token],
                      lineHeight: SIZE_PREVIEW[token] + 4,
                    }}>
                    A
                  </Text>
                </BarButton>
              );
            })
          : null}
      </ScrollView>
    );
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="always"
      contentContainerStyle={styles.row}>
      {TOGGLES_BEFORE.map(toggle)}
      {PANELS.map(({ kind, icon }) => {
        const value = state[kind];
        const active = value != null && value !== 'sans' && value !== 'normal';
        return (
          <BarButton
            key={kind}
            label={t(`format.${kind}`)}
            active={active}
            onPress={() => setPanel(kind)}>
            <Icon name={icon} size={20} color={active ? colors.onPrimary : colors.text} />
          </BarButton>
        );
      })}
      {TOGGLES_AFTER.map(toggle)}
    </ScrollView>
  );
}

function BarButton({
  label,
  active,
  onPress,
  children,
}: {
  label: string;
  /** `undefined`: botón sin estado (no se anuncia como seleccionable). */
  active?: boolean;
  onPress: () => void;
  children: ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      aria-selected={active}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        active && { backgroundColor: colors.primary },
        pressed && !active && { backgroundColor: colors.surfacePressed },
      ]}>
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.xs, paddingHorizontal: spacing.sm, alignItems: 'center' },
  button: {
    minWidth: 40,
    height: 40,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatch: {
    width: 26,
    height: 26,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
