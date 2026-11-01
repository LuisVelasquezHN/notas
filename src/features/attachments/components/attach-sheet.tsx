import { useTranslation } from 'react-i18next';

import { Sheet, SheetItem, afterSheetClose } from '@/components/ui';
import type { Attachment } from '@/db/schema';

import { pickImages } from '../actions';

type AttachSheetProps = {
  noteId: string;
  visible: boolean;
  onClose: () => void;
  onRecord: () => void;
  /** Notas de texto: también se pueden poner imágenes dentro del texto, donde está el cursor. */
  onInlineImages?: (rows: Attachment[]) => void;
};

/** "Añadir": imágenes (en el texto o como portada, arriba) o nota de voz. */
export function AttachSheet({
  noteId,
  visible,
  onClose,
  onRecord,
  onInlineImages,
}: AttachSheetProps) {
  const { t } = useTranslation();
  // En web el selector de ficheros debe abrirse en el mismo toque: sin esperar al cierre.
  const run = (fn: () => void) => {
    onClose();
    if (process.env.EXPO_OS === 'web') fn();
    else afterSheetClose(fn);
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={t('attachments.add')}>
      {onInlineImages ? (
        <>
          <SheetItem
            icon="photoLibrary"
            label={t('attachments.inlineImages')}
            onPress={() =>
              run(() => void pickImages(noteId, 'library', 'inline').then(onInlineImages))
            }
          />
          <SheetItem
            icon="camera"
            label={t('attachments.inlinePhoto')}
            onPress={() =>
              run(() => void pickImages(noteId, 'camera', 'inline').then(onInlineImages))
            }
          />
        </>
      ) : null}
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
