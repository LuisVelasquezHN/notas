import { Sheet, SheetItem, Text } from '@/components/ui';

import { TEMPLATES, type NoteTemplate } from '../templates';

type TemplateSheetProps = {
  visible: boolean;
  onClose: () => void;
  onPick: (template: NoteTemplate) => void;
};

/** Elegir una plantilla para la nota nueva. */
export function TemplateSheet({ visible, onClose, onPick }: TemplateSheetProps) {
  return (
    <Sheet visible={visible} onClose={onClose} title="Nueva desde plantilla">
      {TEMPLATES.map((template) => (
        <SheetItem
          key={template.id}
          icon={template.icon}
          label={template.name}
          onPress={() => onPick(template)}
          trailing={
            <Text variant="caption" tone="muted" numberOfLines={1} style={{ maxWidth: '55%' }}>
              {template.description}
            </Text>
          }
        />
      ))}
    </Sheet>
  );
}
