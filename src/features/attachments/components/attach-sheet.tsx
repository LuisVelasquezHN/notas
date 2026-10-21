import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation();
  // En web el selector de ficheros debe abrirse en el mismo toque: sin esperar al cierre.
  const run = (fn: () => void) => {
    onClose();
    if (process.env.EXPO_OS === 'web') fn();
    else afterSheetClose(fn);
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={t('attachments.add')}>
      <SheetItem
        icon="camera"
        label={t('attachments.takePhoto')}
        onPress={() => run(() => void pickImages(noteId, 'camera'))}
      />
      <SheetItem
        icon="photoLibrary"
        label={t('attachments.pickImages')}
        onPress={() => run(() => void pickImages(noteId, 'library'))}
      />
      <SheetItem icon="mic" label={t('attachments.recordVoice')} onPress={() => run(onRecord)} />
    </Sheet>
  );
}
