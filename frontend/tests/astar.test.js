import test from 'node:test';
import assert from 'node:assert/strict';
import { PathGrid, AStarSearch, Node } from '../src/algorithms/astar.js';

test('AStarSearch - finds shortest path on an open grid', () => {
  const grid = new PathGrid(5, 5);
  const start = { x: 0, y: 0 };
  const goals = [{ x: 4, y: 0 }];
  const astar = new AStarSearch(grid, start, goals);
  const found = astar.run();

  assert.equal(found, true);
  const path = astar.path();
  assert.equal(path.length, 5);
  assert.equal(path[0].x, 0);
  assert.equal(path[0].y, 0);
  assert.equal(path[path.length - 1].x, 4);
  assert.equal(path[path.length - 1].y, 0);
});

test('AStarSearch - routes around walls', () => {
  const grid = new PathGrid(5, 5);
  // Vertical wall at x = 2 from y = 0 to y = 3
  for (let y = 0; y <= 3; y++) {
    grid.at(2, y).walkable = false;
  }
  const start = { x: 0, y: 0 };
  const goals = [{ x: 4, y: 0 }];
  const astar = new AStarSearch(grid, start, goals);
  const found = astar.run();

  assert.equal(found, true);
  const path = astar.path();
  // Must go through y = 4 to pass around the wall
  const goesThroughBottom = path.some((n) => n.x === 2 && n.y === 4);
  assert.equal(goesThroughBottom, true);
  assert.ok(path.every((n) => n.walkable));
});

test('AStarSearch - returns found=false when goal is walled off', () => {
  const grid = new PathGrid(5, 5);
  // Complete wall at x = 2
  for (let y = 0; y < 5; y++) {
    grid.at(2, y).walkable = false;
  }
  const start = { x: 0, y: 2 };
  const goals = [{ x: 4, y: 2 }];
  const astar = new AStarSearch(grid, start, goals);
  const found = astar.run();

  assert.equal(found, false);
  assert.equal(astar.goalNode, null);
  assert.deepEqual(astar.path(), []);
});

test('AStarSearch - picks the nearest of several goals', () => {
  const grid = new PathGrid(10, 10);
  const start = { x: 5, y: 5 };
  const goals = [
    { x: 9, y: 9 }, // dist = 8
    { x: 5, y: 7 }, // dist = 2 (nearest)
    { x: 0, y: 5 }  // dist = 5
  ];
  const astar = new AStarSearch(grid, start, goals);
  const found = astar.run();

  assert.equal(found, true);
  const path = astar.path();
  const lastNode = path[path.length - 1];
  assert.equal(lastNode.x, 5);
  assert.equal(lastNode.y, 7);
  assert.equal(path.length, 3); // (5,5) -> (5,6) -> (5,7)
});

test('AStarSearch - allowDangerous false vs true behaviour', () => {
  const grid = new PathGrid(5, 5);
  // Block column x=2 completely with dangerous cells
  for (let y = 0; y < 5; y++) {
    grid.at(2, y).dangerous = true;
  }
  const start = { x: 0, y: 2 };
  const goals = [{ x: 4, y: 2 }];

  // With allowDangerous = false: should not cross dangerous cells
  const safeSearch = new AStarSearch(grid, start, goals, { allowDangerous: false });
  assert.equal(safeSearch.run(), false);

  // With allowDangerous = true: can cross dangerous cells
  const dangerSearch = new AStarSearch(grid, start, goals, { allowDangerous: true });
  assert.equal(dangerSearch.run(), true);
  assert.equal(dangerSearch.path()[dangerSearch.path().length - 1].x, 4);
});

test('AStarSearch - heap ordering sanity', () => {
  const grid = new PathGrid(3, 3);
  const search = new AStarSearch(grid, { x: 0, y: 0 }, [{ x: 2, y: 2 }]);
  // Empty initial heap from constructor
  search.heap = [];

  const n1 = new Node(0, 0, 1); n1.f = 10; n1.h = 5;
  const n2 = new Node(1, 0, 2); n2.f = 3;  n2.h = 2;
  const n3 = new Node(2, 0, 3); n3.f = 7;  n3.h = 4;
  const n4 = new Node(0, 1, 4); n4.f = 3;  n4.h = 1; // equal f to n2, but lower h

  search._push(n1);
  search._push(n2);
  search._push(n3);
  search._push(n4);

  // Popping should return in order of (f, then h):
  // n4 (f=3, h=1) < n2 (f=3, h=2) < n3 (f=7) < n1 (f=10)
  assert.equal(search._pop(), n4);
  assert.equal(search._pop(), n2);
  assert.equal(search._pop(), n3);
  assert.equal(search._pop(), n1);
  assert.equal(search._pop(), null);
});
