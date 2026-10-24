import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Switch, View } from 'react-native';

import { Button, IconButton, Sheet, Text } from '@/components/ui';
import { fonts, radius, spacing, useTheme } from '@/theme';

import {
  DEFAULT_PASSWORD,
  PASSWORD_LENGTH,
  generatePassword,
  type PasswordOptions,
} from '../password';

type PasswordGeneratorSheetProps = {
  visible: boolean;
  onClose: () => void;
  onInsert: (password: string) => void;
  onCopy: (password: string) => void;
};

/** Genera una contraseña aleatoria para insertarla en la nota segura o copiarla. */
export function PasswordGeneratorSheet({
  visible,
  onClose,
  onInsert,
  onCopy,
}: PasswordGeneratorSheetProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [options, setOptions] = useState<PasswordOptions>(DEFAULT_PASSWORD);
  const [password, setPassword] = useState(() => generatePassword(DEFAULT_PASSWORD));

  const update = (next: Partial<PasswordOptions>) => {
    const merged = { ...options, ...next };
    setOptions(merged);
    setPassword(generatePassword(merged));
  };

  const toggle = (key: 'upper' | 'digits' | 'symbols', label: string) => (
    <View style={styles.option}>
      <Text style={styles.flex}>{label}</Text>
      <Switch
        value={options[key]}
        onValueChange={(value) => update({ [key]: value })}
        accessibilityLabel={label}
        trackColor={{ true: colors.primary }}
      />
    </View>
  );

  return (
    <Sheet visible={visible} onClose={onClose} title={t('vault.generator')}>
      <View style={styles.body}>
        <View style={[styles.preview, { backgroundColor: colors.surfaceMuted }]}>
          {/* Sin `selectable`: se copia con el botón, que la borra del portapapeles después. */}
          <Text style={[styles.password, { fontFamily: fonts.mono }]} testID="generated-password">
            {password}
          </Text>
        </View>
        <View style={styles.option}>
          <IconButton
            icon="minus"
            accessibilityLabel={t('vault.shorter')}
            disabled={options.length <= PASSWORD_LENGTH.min}
            onPress={() => update({ length: options.length - 1 })}
          />
          <Text style={[styles.flex, styles.center]}>
            {t('vault.length', { count: options.length })}
          </Text>
          <IconButton
            icon="add"
            accessibilityLabel={t('vault.longer')}
            disabled={options.length >= PASSWORD_LENGTH.max}
            onPress={() => update({ length: options.length + 1 })}
          />
        </View>
        {toggle('upper', t('vault.uppercase'))}
        {toggle('digits', t('vault.digits'))}
        {toggle('symbols', t('vault.symbols'))}
        <View style={styles.buttons}>
          <Button
            title={t('vault.regenerate')}
            icon="repeat"
            variant="secondary"
            onPress={() => setPassword(generatePassword(options))}
          />
          <Button
            title={t('vault.copyPassword')}
            icon="copy"
            variant="secondary"
            onPress={() => onCopy(password)}
          />
          <Button title={t('vault.insert')} onPress={() => onInsert(password)} />
        </View>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  preview: { borderRadius: radius.md, padding: spacing.md },
  password: { fontSize: 18, lineHeight: 26, letterSpacing: 0.5 },
  option: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44 },
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'flex-end' },
});
