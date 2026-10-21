import { Alert, Platform } from 'react-native';

import { t } from '@/i18n';

type ConfirmOptions = {
  title: string;
  message?: string;
  confirmLabel?: string;
  destructive?: boolean;
};

/** Diálogo de confirmación multiplataforma (`Alert` no funciona en web). */
export function confirm({
  title,
  message,
  confirmLabel = t('common.ok'),
  destructive = false,
}: ConfirmOptions): Promise<boolean> {
  if (Platform.OS === 'web') {
    return Promise.resolve(window.confirm(message ? `${title}\n\n${message}` : title));
  }
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: t('common.cancel'), style: 'cancel', onPress: () => resolve(false) },
        {
          text: confirmLabel,
          style: destructive ? 'destructive' : 'default',
          onPress: () => resolve(true),
        },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}
