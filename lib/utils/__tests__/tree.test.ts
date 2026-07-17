import { describe, it, expect } from 'vitest';
import { findNodeInTree, removeNodeFromTree, getAllIds, findPathInTree } from '../tree';

interface TestNode {
  id: string;
  name: string;
  children?: TestNode[];
}

const getChildren = (n: TestNode) => n.children;
const testTree: TestNode[] = [
  {
    id: '1', name: 'Root',
    children: [
      { id: '2', name: 'Child 1', children: [{ id: '4', name: 'Grandchild' }] },
      { id: '3', name: 'Child 2' },
    ],
  },
];

describe('findNodeInTree', () => {
  it('finds root node', () => {
    expect(findNodeInTree(testTree, '1', getChildren)?.id).toBe('1');
  });
  it('finds deep node', () => {
    expect(findNodeInTree(testTree, '4', getChildren)?.id).toBe('4');
  });
  it('returns undefined for missing', () => {
    expect(findNodeInTree(testTree, '999', getChildren)).toBeUndefined();
  });
});

describe('removeNodeFromTree', () => {
  it('removes leaf node', () => {
    const tree = JSON.parse(JSON.stringify(testTree));
    const removed = removeNodeFromTree(tree, '4', getChildren);
    expect(removed?.id).toBe('4');
    expect(findNodeInTree(tree, '4', getChildren)).toBeUndefined();
  });
});

describe('getAllIds', () => {
  it('collects all ids', () => {
    const ids = getAllIds(testTree, getChildren);
    expect(ids).toEqual(['1', '2', '4', '3']);
  });
});

describe('findPathInTree', () => {
  it('finds path to deep node', () => {
    const path = findPathInTree(testTree, '4', getChildren);
    expect(path?.map((n) => n.id)).toEqual(['1', '2', '4']);
  });
});
