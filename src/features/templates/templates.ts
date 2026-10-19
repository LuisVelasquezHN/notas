import type { IconName } from '@/components/ui/icon';
import type { DocNode, EditorDoc } from '@/features/editor/doc';

/**
 * Plantillas integradas. Cada una produce el contenido inicial de una nota nueva: un documento
 * TipTap (notas de texto) o una lista de ítems (checklists). Son funciones porque algunas dependen
 * de la fecha (Diario).
 */

export type TemplateContent =
  | { type: 'text'; title: string; doc: EditorDoc }
  | { type: 'checklist'; title: string; items: string[] };

export type NoteTemplate = {
  id: string;
  name: string;
  description: string;
  icon: IconName;
  build: (now: Date) => TemplateContent;
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

/** "lunes, 19 de octubre de 2026" (con mayúscula inicial). */
export function longDate(date: Date): string {
  const formatted = new Intl.DateTimeFormat('es', {
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
    name: 'Reunión',
    description: 'Asistentes, temas, acuerdos y tareas',
    icon: 'work',
    build: (now) => ({
      type: 'text',
      title: `Reunión · ${now.toLocaleDateString('es')}`,
      doc: doc(
        heading('Asistentes'),
        bulletList(['']),
        heading('Temas'),
        bulletList(['']),
        heading('Acuerdos'),
        bulletList(['']),
        heading('Tareas'),
        taskList(['']),
      ),
    }),
  },
  {
    id: 'shopping',
    name: 'Lista de la compra',
    description: 'Checklist con lo básico',
    icon: 'cart',
    build: () => ({
      type: 'checklist',
      title: 'Lista de la compra',
      items: ['Pan', 'Leche', 'Huevos', 'Fruta', 'Verdura'],
    }),
  },
  {
    id: 'journal',
    name: 'Diario',
    description: 'La entrada de hoy, con tres preguntas',
    icon: 'book',
    build: (now) => ({
      type: 'text',
      title: longDate(now),
      doc: doc(
        heading('¿Qué ha pasado hoy?'),
        paragraph(),
        heading('Hoy agradezco'),
        bulletList(['']),
        heading('Mañana quiero'),
        paragraph(),
      ),
    }),
  },
  {
    id: 'project',
    name: 'Proyecto o idea',
    description: 'Objetivo, notas y próximos pasos',
    icon: 'idea',
    build: () => ({
      type: 'text',
      title: '',
      doc: doc(
        heading('Objetivo'),
        paragraph(),
        heading('Notas'),
        bulletList(['']),
        heading('Próximos pasos'),
        taskList(['']),
      ),
    }),
  },
  {
    id: 'recipe',
    name: 'Receta',
    description: 'Ingredientes y pasos',
    icon: 'heart',
    build: () => ({
      type: 'text',
      title: '',
      doc: doc(heading('Ingredientes'), bulletList(['']), heading('Pasos'), orderedList([''])),
    }),
  },
  {
    id: 'packing',
    name: 'Equipaje',
    description: 'Checklist para un viaje',
    icon: 'travel',
    build: () => ({
      type: 'checklist',
      title: 'Equipaje',
      items: [
        'Documentación y billetes',
        'Cargadores',
        'Ropa',
        'Neceser',
        'Medicinas',
        'Llaves de casa',
      ],
    }),
  },
];

export function findTemplate(id: string): NoteTemplate | undefined {
  return TEMPLATES.find((t) => t.id === id);
}
