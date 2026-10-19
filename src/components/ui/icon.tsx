import { SymbolView, type SymbolViewProps } from 'expo-symbols';

import { useTheme } from '@/theme';

type SymbolName = Exclude<SymbolViewProps['name'], string>;

/** Iconos semánticos: SF Symbols en iOS, Material Symbols en Android y web. */
const ICONS = {
  note: { ios: 'note.text', android: 'sticky_note_2', web: 'sticky_note_2' },
  folder: { ios: 'folder', android: 'folder', web: 'folder' },
  bell: { ios: 'bell', android: 'notifications', web: 'notifications' },
  settings: { ios: 'gearshape', android: 'settings', web: 'settings' },
  add: { ios: 'plus', android: 'add', web: 'add' },
  search: { ios: 'magnifyingglass', android: 'search', web: 'search' },
  pin: { ios: 'pin', android: 'keep', web: 'keep' },
  archive: { ios: 'archivebox', android: 'archive', web: 'archive' },
  trash: { ios: 'trash', android: 'delete', web: 'delete' },
  checklist: { ios: 'checklist', android: 'checklist', web: 'checklist' },
  grid: { ios: 'square.grid.2x2', android: 'grid_view', web: 'grid_view' },
  list: { ios: 'list.bullet', android: 'view_agenda', web: 'view_agenda' },
  close: { ios: 'xmark', android: 'close', web: 'close' },
  check: { ios: 'checkmark', android: 'check', web: 'check' },
  chevronRight: { ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' },
  palette: { ios: 'paintpalette', android: 'palette', web: 'palette' },
  tag: { ios: 'tag', android: 'label', web: 'label' },
} satisfies Record<string, SymbolName>;

export type IconName = keyof typeof ICONS;

type IconProps = {
  name: IconName;
  size?: number;
  color?: string;
};

export function Icon({ name, size = 22, color }: IconProps) {
  const { colors } = useTheme();
  return <SymbolView name={ICONS[name]} size={size} tintColor={color ?? colors.text} />;
}
