import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  Button,
  ColorSwatch,
  FOLDER_ICONS,
  Icon,
  Sheet,
  Text,
  TextField,
  isIconName,
  type IconName,
} from '@/components/ui';
import type { Folder } from '@/db/schema';
import { NOTE_COLOR_TOKENS, radius, spacing, useTheme, type NoteColor } from '@/theme';

import { createFolder, updateFolder } from '../repository';

const ICON_LABELS: Record<(typeof FOLDER_ICONS)[number], string> = {
  folder: 'Carpeta',
  home: 'Casa',
  work: 'Trabajo',
  star: 'Estrella',
  heart: 'Corazón',
  book: 'Libro',
  cart: 'Compra',
  idea: 'Idea',
  travel: 'Viaje',
  school: 'Estudios',
};

export type FolderFormTarget =
  { mode: 'create'; parentId: string | null } | { mode: 'edit'; folder: Folder };

type FolderFormSheetProps = {
  target: FolderFormTarget | null;
  onClose: () => void;
  onSaved?: (folder: Folder | null) => void;
};

/** Crear o editar una carpeta: nombre, color e icono. */
export function FolderFormSheet({ target, onClose, onSaved }: FolderFormSheetProps) {
  return (
    <Sheet
      visible={target !== null}
      onClose={onClose}
      title={target?.mode === 'edit' ? 'Editar carpeta' : 'Nueva carpeta'}>
      {target ? (
        // Se vuelve a montar con cada destino para reiniciar el formulario.
        <FolderForm
          key={target.mode === 'edit' ? target.folder.id : `new:${target.parentId}`}
          target={target}
          onDone={(folder) => {
            onClose();
            onSaved?.(folder);
          }}
        />
      ) : null}
    </Sheet>
  );
}

function FolderForm({
  target,
  onDone,
}: {
  target: FolderFormTarget;
  onDone: (folder: Folder | null) => void;
}) {
  const { colors, noteColor } = useTheme();
  const initial = target.mode === 'edit' ? target.folder : null;
  const [name, setName] = useState(initial?.name ?? '');
  const [color, setColor] = useState<NoteColor>(initial?.color ?? 'default');
  const [icon, setIcon] = useState<IconName>(isIconName(initial?.icon) ? initial.icon : 'folder');
  const valid = name.trim().length > 0;

  async function submit() {
    if (!valid) return;
    if (target.mode === 'edit') {
      await updateFolder(target.folder.id, { name, color, icon });
      onDone(null);
    } else {
      onDone(await createFolder({ name, color, icon, parentId: target.parentId }));
    }
  }

  return (
    <View style={styles.form}>
      <TextField
        value={name}
        onChangeText={setName}
        placeholder="Nombre de la carpeta"
        accessibilityLabel="Nombre de la carpeta"
        autoFocus
        maxLength={60}
        returnKeyType="done"
        onSubmitEditing={() => void submit()}
      />

      <Text variant="label" tone="secondary">
        COLOR
      </Text>
      <View style={styles.wrap}>
        {NOTE_COLOR_TOKENS.map((token) => (
          <ColorSwatch
            key={token}
            color={token}
            selected={token === color}
            onPress={() => setColor(token)}
          />
        ))}
      </View>

      <Text variant="label" tone="secondary">
        ICONO
      </Text>
      <View style={styles.wrap}>
        {FOLDER_ICONS.map((name) => (
          <Pressable
            key={name}
            accessibilityRole="radio"
            accessibilityLabel={ICON_LABELS[name]}
            accessibilityState={{ selected: name === icon }}
            onPress={() => setIcon(name)}
            style={[
              styles.icon,
              {
                backgroundColor: noteColor(color),
                borderColor: name === icon ? colors.primary : colors.border,
                borderWidth: name === icon ? 2 : StyleSheet.hairlineWidth,
              },
            ]}>
            <Icon name={name} size={20} />
          </Pressable>
        ))}
      </View>

      <Button
        title={target.mode === 'edit' ? 'Guardar' : 'Crear carpeta'}
        disabled={!valid}
        onPress={() => void submit()}
        style={styles.submit}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  icon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submit: { marginTop: spacing.sm },
});
