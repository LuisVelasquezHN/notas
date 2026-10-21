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
  starFill: { ios: 'star.fill', android: 'star', web: 'star' },
  filter: {
    ios: 'line.3.horizontal.decrease.circle',
    android: 'filter_list',
    web: 'filter_list',
  },
  smartFolder: { ios: 'text.magnifyingglass', android: 'saved_search', web: 'saved_search' },
  selectAll: { ios: 'checkmark.circle', android: 'select_all', web: 'select_all' },
  tagAdd: { ios: 'tag.circle', android: 'new_label', web: 'new_label' },
  save: { ios: 'bookmark', android: 'bookmark', web: 'bookmark' },
  attachment: { ios: 'paperclip', android: 'attach_file', web: 'attach_file' },
  bellFill: {
    ios: 'bell.fill',
    android: 'notifications_active',
    web: 'notifications_active',
  },
  bellOff: { ios: 'bell.slash', android: 'notifications_off', web: 'notifications_off' },
  repeat: { ios: 'repeat', android: 'repeat', web: 'repeat' },
  snooze: { ios: 'zzz', android: 'snooze', web: 'snooze' },
  calendar: { ios: 'calendar', android: 'calendar_today', web: 'calendar_today' },
  clock: { ios: 'clock', android: 'schedule', web: 'schedule' },
  chevronLeft: { ios: 'chevron.left', android: 'chevron_left', web: 'chevron_left' },
  minus: { ios: 'minus', android: 'remove', web: 'remove' },
  sunset: { ios: 'sunset', android: 'wb_twilight', web: 'wb_twilight' },
  sunrise: { ios: 'sunrise', android: 'wb_sunny', web: 'wb_sunny' },
  nextWeek: { ios: 'calendar.badge.clock', android: 'date_range', web: 'date_range' },
  mic: { ios: 'mic', android: 'mic', web: 'mic' },
  image: { ios: 'photo', android: 'image', web: 'image' },
  camera: { ios: 'camera', android: 'photo_camera', web: 'photo_camera' },
  photoLibrary: { ios: 'photo.on.rectangle', android: 'photo_library', web: 'photo_library' },
  play: { ios: 'play.fill', android: 'play_arrow', web: 'play_arrow' },
  pause: { ios: 'pause.fill', android: 'pause', web: 'pause' },
  stop: { ios: 'stop.fill', android: 'stop', web: 'stop' },
  addBox: { ios: 'plus.square', android: 'add_box', web: 'add_box' },
  textFormat: { ios: 'textformat', android: 'text_format', web: 'text_format' },
  bold: { ios: 'bold', android: 'format_bold', web: 'format_bold' },
  italic: { ios: 'italic', android: 'format_italic', web: 'format_italic' },
  underline: { ios: 'underline', android: 'format_underlined', web: 'format_underlined' },
  strike: { ios: 'strikethrough', android: 'format_strikethrough', web: 'format_strikethrough' },
  listBullet: { ios: 'list.bullet', android: 'format_list_bulleted', web: 'format_list_bulleted' },
  listNumber: { ios: 'list.number', android: 'format_list_numbered', web: 'format_list_numbered' },
  quote: { ios: 'text.quote', android: 'format_quote', web: 'format_quote' },
  code: {
    ios: 'chevron.left.forwardslash.chevron.right',
    android: 'code',
    web: 'code',
  },
  formatClear: { ios: 'eraser', android: 'format_clear', web: 'format_clear' },
  template: { ios: 'doc.text', android: 'description', web: 'description' },
  lock: { ios: 'lock', android: 'lock', web: 'lock' },
  lockOpen: { ios: 'lock.open', android: 'lock_open', web: 'lock_open' },
  faceId: { ios: 'faceid', android: 'face', web: 'face' },
  fingerprint: { ios: 'touchid', android: 'fingerprint', web: 'fingerprint' },
  share: { ios: 'square.and.arrow.up', android: 'share', web: 'share' },
  markdown: { ios: 'doc.plaintext', android: 'article', web: 'article' },
  pdf: { ios: 'doc.richtext', android: 'picture_as_pdf', web: 'picture_as_pdf' },
  backup: { ios: 'externaldrive', android: 'backup', web: 'backup' },
  importFile: { ios: 'square.and.arrow.down', android: 'upload_file', web: 'upload_file' },
  language: { ios: 'globe', android: 'language', web: 'language' },
  shield: { ios: 'lock.shield', android: 'shield', web: 'shield' },
  bug: { ios: 'ladybug', android: 'bug_report', web: 'bug_report' },
  sparkles: { ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' },
  info: { ios: 'info.circle', android: 'info', web: 'info' },
} satisfies Record<string, SymbolName>;

export type IconName = keyof typeof ICONS;

export function isIconName(value: unknown): value is IconName {
  return typeof value === 'string' && value in ICONS;
}

/** Iconos que se pueden asignar a una carpeta inteligente. */
export const SMART_FOLDER_ICONS = [
  'smartFolder',
  'filter',
  'tag',
  'star',
  'checklist',
  'work',
  'home',
  'idea',
  'book',
  'cart',
] as const satisfies readonly IconName[];

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
