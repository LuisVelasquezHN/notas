import { Sheet, SheetItem, afterSheetClose } from '@/components/ui';

import { pickImages } from '../actions';

type AttachSheetProps = {
  noteId: string;
  visible: boolean;
  onClose: () => void;
  onRecord: () => void;
};

/** "Añadir": foto, imágenes de la galería o nota de voz. */
export function AttachSheet({ noteId, visible, onClose, onRecord }: AttachSheetProps) {
  // En web el selector de ficheros debe abrirse en el mismo toque: sin esperar al cierre.
  const run = (fn: () => void) => {
    onClose();
    if (process.env.EXPO_OS === 'web') fn();
    else afterSheetClose(fn);
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Añadir">
      <SheetItem
        icon="camera"
        label="Hacer una foto"
        onPress={() => run(() => void pickImages(noteId, 'camera'))}
      />
      <SheetItem
        icon="photoLibrary"
        label="Elegir imágenes"
        onPress={() => run(() => void pickImages(noteId, 'library'))}
      />
      <SheetItem icon="mic" label="Grabar nota de voz" onPress={() => run(onRecord)} />
    </Sheet>
  );
}
