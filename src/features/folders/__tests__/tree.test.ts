import type { Folder } from '@/db/schema';

import {
  buildFolderTree,
  canHaveSubfolders,
  descendantIds,
  flattenFolderTree,
  folderPath,
} from '../tree';

function folder(id: string, parentId: string | null, sortKey = id): Folder {
  return {
    id,
    parentId,
    name: id,
    color: 'default',
    icon: null,
    sortKey,
    createdAt: 0,
    updatedAt: 0,
    deletedAt: null,
  };
}

const folders = [
  folder('a', null),
  folder('a1', 'a'),
  folder('a1x', 'a1'),
  folder('b', null),
  folder('huerfana', 'borrada'),
];

describe('folder tree', () => {
  it('construye el árbol con profundidades', () => {
    const tree = buildFolderTree(folders);
    expect(tree.map((n) => n.id)).toEqual(['a', 'b', 'huerfana']);
    const flat = flattenFolderTree(tree);
    expect(flat.map((n) => [n.id, n.depth])).toEqual([
      ['a', 1],
      ['a1', 2],
      ['a1x', 3],
      ['b', 1],
      ['huerfana', 1],
    ]);
  });

  it('obtiene descendientes y ruta', () => {
    expect(descendantIds(folders, 'a').sort()).toEqual(['a', 'a1', 'a1x']);
    expect(folderPath(folders, 'a1x').map((f) => f.id)).toEqual(['a', 'a1', 'a1x']);
  });

  it('limita el anidamiento a 3 niveles', () => {
    expect(canHaveSubfolders(2)).toBe(true);
    expect(canHaveSubfolders(3)).toBe(false);
  });
});
