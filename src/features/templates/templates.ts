import type { IconName } from '@/components/ui/icon';
import type { DocNode, EditorDoc } from '@/features/editor/doc';
import { currentLocale, t, type TFunction } from '@/i18n';

/**
 * Plantillas integradas. Cada una produce el contenido inicial de una nota nueva: un documento
 * TipTap (notas de texto) o una lista de ítems (checklists). Son funciones porque algunas dependen
 * de la fecha (Diario).
 */

export type TemplateContent =
  | { type: 'text'; title: string; doc: EditorDoc }
  | { type: 'checklist'; title: string; items: string[] };

export type TemplateId = 'meeting' | 'shopping' | 'journal' | 'project' | 'recipe' | 'packing';

/**
 * El nombre y la descripción están en el catálogo (`templates.<id>.name` / `.description`); el
 * contenido se genera en el idioma actual al crear la nota.
 */
export type NoteTemplate = {
  id: TemplateId;
  icon: IconName;
  build: (now: Date, tr?: TFunction) => TemplateContent;
};

const text = (value: string) => ({ type: 'text' as const, text: value });
const paragraph = (value = ''): DocNode =>
  value ? { type: 'paragraph', content: [text(value)] } : { type: 'paragraph' };
const heading = (value: string, level: 1 | 2 = 2): DocNode => ({
  type: 'heading',
  attrs: { level },
  content: [text(value)],
});
const bulletList = (items: string[]): DocNode => ({
  type: 'bulletList',
  content: items.map((item) => ({ type: 'listItem', content: [paragraph(item)] })),
});
const orderedList = (items: string[]): DocNode => ({
  type: 'orderedList',
  attrs: { start: 1 },
  content: items.map((item) => ({ type: 'listItem', content: [paragraph(item)] })),
});
const taskList = (items: string[]): DocNode => ({
  type: 'taskList',
  content: items.map((item) => ({
    type: 'taskItem',
    attrs: { checked: false },
    content: [paragraph(item)],
  })),
});
const doc = (...content: DocNode[]): EditorDoc => ({ type: 'doc', content });

/** Ítems de una checklist del catálogo: una línea por ítem. */
const lines = (value: string) => value.split('\n').filter((line) => line.trim());

/** "Lunes, 19 de octubre de 2026" (con mayúscula inicial), en el idioma actual. */
export function longDate(date: Date): string {
  const formatted = new Intl.DateTimeFormat(currentLocale(), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

export const TEMPLATES: NoteTemplate[] = [
  {
    id: 'meeting',
    icon: 'work',
    build: (now, tr = t) => ({
      type: 'text',
      title: tr('templates.meeting.title', { date: now.toLocaleDateString(currentLocale()) }),
      doc: doc(
        heading(tr('templates.meeting.attendees')),
        bulletList(['']),
        heading(tr('templates.meeting.topics')),
        bulletList(['']),
        heading(tr('templates.meeting.decisions')),
        bulletList(['']),
        heading(tr('templates.meeting.tasks')),
        taskList(['']),
      ),
    }),
  },
  {
    id: 'shopping',
    icon: 'cart',
    build: (_now, tr = t) => ({
      type: 'checklist',
      title: tr('templates.shopping.name'),
      items: lines(tr('templates.shopping.items')),
    }),
  },
  {
    id: 'journal',
    icon: 'book',
    build: (now, tr = t) => ({
      type: 'text',
      title: longDate(now),
      doc: doc(
        heading(tr('templates.journal.today')),
        paragraph(),
        heading(tr('templates.journal.grateful')),
        bulletList(['']),
        heading(tr('templates.journal.tomorrow')),
        paragraph(),
      ),
    }),
  },
  {
    id: 'project',
    icon: 'idea',
    build: (_now, tr = t) => ({
      type: 'text',
      title: '',
      doc: doc(
        heading(tr('templates.project.goal')),
        paragraph(),
        heading(tr('templates.project.notes')),
        bulletList(['']),
        heading(tr('templates.project.nextSteps')),
        taskList(['']),
      ),
    }),
  },
  {
    id: 'recipe',
    icon: 'heart',
    build: (_now, tr = t) => ({
      type: 'text',
      title: '',
      doc: doc(
        heading(tr('templates.recipe.ingredients')),
        bulletList(['']),
        heading(tr('templates.recipe.steps')),
        orderedList(['']),
      ),
    }),
  },
  {
    id: 'packing',
    icon: 'travel',
    build: (_now, tr = t) => ({
      type: 'checklist',
      title: tr('templates.packing.name'),
      items: lines(tr('templates.packing.items')),
    }),
  },
];

export function findTemplate(id: string): NoteTemplate | undefined {
  return TEMPLATES.find((template) => template.id === id);
}
