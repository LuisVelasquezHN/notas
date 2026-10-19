import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { Attachment } from '@/db/schema';
import { radius, spacing, useTheme } from '@/theme';

import { resolveUri } from '../storage';
import { ImageViewer } from './image-viewer';

/** Altura máxima de una imagen sola (con varias, se muestran en cuadrícula de miniaturas). */
const SINGLE_MAX_HEIGHT = 360;

type ImageGalleryProps = {
  images: Attachment[];
  editable: boolean;
};

/** Imágenes de la nota, encima del título (como en Keep). Tocar abre el visor. */
export function ImageGallery({ images, editable }: ImageGalleryProps) {
  const { colors } = useTheme();
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  if (images.length === 0) return null;

  const single = images.length === 1;
  const columns = images.length === 2 || images.length === 4 ? 2 : 3;

  return (
    <>
      <View style={styles.grid}>
        {images.map((image, index) => {
          const ratio = image.width && image.height ? image.width / image.height : 4 / 3;
          return (
            <Pressable
              key={image.id}
              accessibilityRole="imagebutton"
              accessibilityLabel={`Imagen ${index + 1} de ${images.length}`}
              onPress={() => setOpenIndex(index)}
              style={({ pressed }) => [
                single
                  ? { width: '100%', aspectRatio: ratio, maxHeight: SINGLE_MAX_HEIGHT }
                  : { width: `${100 / columns}%`, aspectRatio: 1, padding: 2 },
                pressed && { opacity: 0.8 },
              ]}>
              <Image
                source={{ uri: resolveUri(image.localUri) }}
                style={[styles.image, { backgroundColor: colors.surfaceMuted }]}
                contentFit="cover"
                transition={150}
                recyclingKey={image.id}
              />
            </Pressable>
          );
        })}
      </View>
      <ImageViewer
        key={openIndex ?? 'closed'}
        images={images}
        index={openIndex}
        editable={editable}
        onClose={() => setOpenIndex(null)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    margin: -2,
    borderRadius: radius.md,
    overflow: 'hidden',
    marginBottom: spacing.xs,
  },
  image: { flex: 1, borderRadius: radius.sm },
});
