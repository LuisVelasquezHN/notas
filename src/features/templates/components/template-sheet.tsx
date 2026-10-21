import { useTranslation } from 'react-i18next';

import { Sheet, SheetItem, Text } from '@/components/ui';

import { TEMPLATES, type NoteTemplate } from '../templates';

type TemplateSheetProps = {
  visible: boolean;
  onClose: () => void;
  onPick: (template: NoteTemplate) => void;
};

/** Elegir una plantilla para la nota nueva. */
export function TemplateSheet({ visible, onClose, onPick }: TemplateSheetProps) {
  const { t } = useTranslation();
  return (
    <Sheet visible={visible} onClose={onClose} title={t('newNote.template')}>
      {TEMPLATES.map((template) => (
        <SheetItem
          key={template.id}
          icon={template.icon}
          label={t(`templates.${template.id}.name`)}
          onPress={() => onPick(template)}
          trailing={
            <Text variant="caption" tone="muted" numberOfLines={1} style={{ maxWidth: '55%' }}>
              {t(`templates.${template.id}.description`)}
            </Text>
          }
        />
      ))}
    </Sheet>
  );
}
