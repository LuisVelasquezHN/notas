import type { Folder } from '@/db/schema';

/** Profundidad máxima de anidamiento (1 = carpeta raíz). */
export const MAX_FOLDER_DEPTH = 3;

export type FolderNode = Folder & { depth: number; children: FolderNode[] };

/**
 * Construye el árbol a partir de la lista plana (ya ordenada por `sort_key`).
 * Las carpetas cuyo padre no existe (p. ej. borrado) se tratan como raíces.
 */
export function buildFolderTree(folders: Folder[]): FolderNode[] {
  const nodes = new Map<string, FolderNode>(
    folders.map((f) => [f.id, { ...f, depth: 1, children: [] }]),
  );
  const roots: FolderNode[] = [];
  for (const folder of folders) {
    const node = nodes.get(folder.id)!;
    const parent = folder.parentId ? nodes.get(folder.parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  const setDepth = (list: FolderNode[], depth: number) => {
    for (const node of list) {
      node.depth = depth;
      setDepth(node.children, depth + 1);
    }
  };
  setDepth(roots, 1);
  return roots;
}

/** Árbol aplanado en orden de lectura (padre antes que hijos). */
export function flattenFolderTree(tree: FolderNode[]): FolderNode[] {
  return tree.flatMap((node) => [node, ...flattenFolderTree(node.children)]);
}

/** IDs de la carpeta y de todas sus descendientes. */
export function descendantIds(folders: Folder[], id: string): string[] {
  const result = [id];
  for (let i = 0; i < result.length; i++) {
    for (const f of folders) if (f.parentId === result[i]) result.push(f.id);
  }
  return result;
}

/** Ruta desde la raíz hasta la carpeta (incluida). */
export function folderPath(folders: Folder[], id: string): Folder[] {
  const byId = new Map(folders.map((f) => [f.id, f]));
  const path: Folder[] = [];
  let current = byId.get(id);
  while (current && path.length <= MAX_FOLDER_DEPTH) {
    path.unshift(current);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return path;
}

export function canHaveSubfolders(depth: number): boolean {
  return depth < MAX_FOLDER_DEPTH;
}
