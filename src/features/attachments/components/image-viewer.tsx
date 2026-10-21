import { Image } from 'expo-image';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FlatList,
  Modal,
  StyleSheet,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton, Text } from '@/components/ui';
import type { Attachment } from '@/db/schema';
import { useAppLocked } from '@/stores/security-store';
import { spacing } from '@/theme';

import { deleteAttachment } from '../actions';
import { resolveUri } from '../storage';

type ImageViewerProps = {
  images: Attachment[];
  /** Imagen abierta; `null` = cerrado. */
  index: number | null;
  editable: boolean;
  onClose: () => void;
};

/** Visor a pantalla completa: deslizar para pasar de imagen; borrar (cierra y ofrece deshacer). */
export function ImageViewer({ images, index, editable, onClose }: ImageViewerProps) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  // La galería vuelve a montar el visor en cada apertura (`key`): parte de la imagen tocada.
  const [current, setCurrent] = useState(index ?? 0);

  const appLocked = useAppLocked();
  const visible = index !== null && images.length > 0 && !appLocked;
  const shown = Math.min(current, images.length - 1);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const page = Math.round(e.nativeEvent.contentOffset.x / width);
    if (page !== current) setCurrent(page);
  };

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        {visible ? (
          <FlatList
            data={images}
            keyExtractor={(image) => image.id}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={Math.min(index, images.length - 1)}
            getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
            onMomentumScrollEnd={onScroll}
            onScroll={process.env.EXPO_OS === 'web' ? onScroll : undefined}
            scrollEventThrottle={64}
            renderItem={({ item }) => (
              <Image
                source={{ uri: resolveUri(item.localUri) }}
                style={{ width, height }}
                contentFit="contain"
                accessibilityIgnoresInvertColors
              />
            )}
          />
        ) : null}
        <View style={[styles.bar, { paddingTop: insets.top + spacing.sm }]}>
          <IconButton
            icon="close"
            accessibilityLabel={t('common.close')}
            color="#FFFFFF"
            onPress={onClose}
          />
          {images.length > 1 ? (
            <Text style={styles.counter}>
              {shown + 1} / {images.length}
            </Text>
          ) : (
            <View />
          )}
          {editable ? (
            <IconButton
              icon="trash"
              accessibilityLabel={t('attachments.deleteImage')}
              color="#FFFFFF"
              onPress={() => {
                const image = images[shown];
                if (!image) return;
                // Se cierra para que se vea el snackbar con "Deshacer" (queda bajo el modal).
                onClose();
                void deleteAttachment(image);
              }}
            />
          ) : (
            <View style={styles.spacer} />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  bar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.35)',
    paddingBottom: spacing.sm,
  },
  counter: { color: '#FFFFFF' },
  spacer: { width: 40 },
});
