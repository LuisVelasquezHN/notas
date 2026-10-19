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
  more: { ios: 'ellipsis', android: 'more_horiz', web: 'more_horiz' },
  undo: { ios: 'arrow.uturn.backward', android: 'undo', web: 'undo' },
  redo: { ios: 'arrow.uturn.forward', android: 'redo', web: 'redo' },
  unarchive: { ios: 'tray.and.arrow.up', android: 'unarchive', web: 'unarchive' },
  restore: {
    ios: 'arrow.counterclockwise',
    android: 'restore_from_trash',
    web: 'restore_from_trash',
  },
  copy: { ios: 'doc.on.doc', android: 'content_copy', web: 'content_copy' },
  move: { ios: 'folder.badge.gearshape', android: 'drive_file_move', web: 'drive_file_move' },
  sort: { ios: 'arrow.up.arrow.down', android: 'swap_vert', web: 'swap_vert' },
  dragHandle: { ios: 'line.3.horizontal', android: 'drag_indicator', web: 'drag_indicator' },
  checkbox: {
    ios: 'square',
    android: 'check_box_outline_blank',
    web: 'check_box_outline_blank',
  },
  checkboxChecked: { ios: 'checkmark.square.fill', android: 'check_box', web: 'check_box' },
  indent: {
    ios: 'increase.indent',
    android: 'format_indent_increase',
    web: 'format_indent_increase',
  },
  outdent: {
    ios: 'decrease.indent',
    android: 'format_indent_decrease',
    web: 'format_indent_decrease',
  },
  pinFill: { ios: 'pin.fill', android: 'keep', web: 'keep' },
  chevronDown: { ios: 'chevron.down', android: 'expand_more', web: 'expand_more' },
  edit: { ios: 'pencil', android: 'edit', web: 'edit' },
  text: { ios: 'text.alignleft', android: 'notes', web: 'notes' },
  folderAdd: { ios: 'folder.badge.plus', android: 'create_new_folder', web: 'create_new_folder' },
  home: { ios: 'house', android: 'home', web: 'home' },
  work: { ios: 'briefcase', android: 'work', web: 'work' },
  star: { ios: 'star', android: 'star', web: 'star' },
  heart: { ios: 'heart', android: 'favorite', web: 'favorite' },
  book: { ios: 'book', android: 'menu_book', web: 'menu_book' },
  cart: { ios: 'cart', android: 'shopping_cart', web: 'shopping_cart' },
  idea: { ios: 'lightbulb', android: 'lightbulb', web: 'lightbulb' },
  travel: { ios: 'airplane', android: 'flight', web: 'flight' },
  school: { ios: 'graduationcap', android: 'school', web: 'school' },
} satisfies Record<string, SymbolName>;

export type IconName = keyof typeof ICONS;

export function isIconName(value: unknown): value is IconName {
  return typeof value === 'string' && value in ICONS;
}

/** Iconos que se pueden asignar a una carpeta. */
export const FOLDER_ICONS = [
  'folder',
  'home',
  'work',
  'star',
  'heart',
  'book',
  'cart',
  'idea',
  'travel',
  'school',
] as const satisfies readonly IconName[];

type IconProps = {
  name: IconName;
  size?: number;
  color?: string;
};

export function Icon({ name, size = 22, color }: IconProps) {
  const { colors } = useTheme();
  return <SymbolView name={ICONS[name]} size={size} tintColor={color ?? colors.text} />;
}
