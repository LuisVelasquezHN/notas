import { useState } from 'react';
import { Platform, type TextInputContentSizeChangeEvent } from 'react-native';

/**
 * En web, un `TextInput` multilínea es un `<textarea>` de altura fija: este hook lo hace crecer
 * con el contenido. En iOS y Android ya crece solo (con `scrollEnabled={false}`), así que no hace nada.
 */
export function useAutoGrow(minHeight = 0) {
  const [height, setHeight] = useState<number | null>(null);
  if (Platform.OS !== 'web') {
    return { onContentSizeChange: undefined, numberOfLines: undefined, style: undefined };
  }
  return {
    // El `<textarea>` empieza con 2 filas y solo puede crecer: se parte de 1.
    numberOfLines: 1,
    onContentSizeChange: (e: TextInputContentSizeChangeEvent) =>
      setHeight(Math.max(minHeight, Math.ceil(e.nativeEvent.contentSize.height))),
    style: height === null ? undefined : { height },
  };
}
