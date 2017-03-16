require('./app.sass')

import Rx from 'rxjs';
import helpers from './helpers'

const {
  range,
  initArray,
  cacheFn
} = helpers

const c = document.getElementById('canvas');

const FPS = 30;
const WIDTH = 150;
const HEIGHT = 75;
const CELL_SIZE = 7;
const CANVAS_WIDTH = WIDTH * CELL_SIZE;
const CANVAS_HEIGHT = HEIGHT * CELL_SIZE;
const CELL_FILL_STYLE = 'rgb(22, 109, 175)';
const BACKGROUND_COLOR = 'rgba(255, 255, 255, 0.5)';
const NEIGHBOR_COORS_CACHE = {};

const DIR = range(-1, 1)
  .reduce((acc, x) => acc.concat(range(-1, 1).map((y) => [x, y])), [])
  .filter(([x, y]) => !(x === 0 && y === 0));

c.setAttribute('width', CANVAS_WIDTH.toString());
c.setAttribute('height', CANVAS_HEIGHT.toString());
c.style.display = 'block';
const ctx = c.getContext('2d');

const mousedrag = Rx.Observable
  .fromEvent(c, 'mousedown')
  .flatMap((md) => {
    md.preventDefault();
    let ev = md;

    return Rx.Observable.merge(
        Rx.Observable.interval(100).map(el => null),
        Rx.Observable.fromEvent(c, 'mousemove')
      )
      .map(mm => {
        ev = mm || ev;
        const {left, top} = ev.target.getBoundingClientRect();
        const x = ev.clientX - left;
        const y = ev.clientY - top;
        const [coorX, coorY] = [x, y].map(el => Math.floor(el / CELL_SIZE));
        return [coorX, coorY];
      })
      .takeUntil(Rx.Observable.fromEvent(c, 'mouseup'));
  })
  .throttleTime(50)
  .subscribe(([x, y]) => {
    grid[x][y] = 1;
  });

function initGrid(x, y, init) {
  return initArray(x, init).map(row => initArray(y, init));
}

let [
  grid,
  buffer
] = [
  initGrid(WIDTH, HEIGHT, 0),
  initGrid(WIDTH, HEIGHT, 0)
];

const GRID_COORS = grid.reduce((acc, row, x) => {
  acc = acc.concat(row.map((_, y) => [x, y]));
  return acc;
}, []);

GRID_COORS.forEach(([x, y]) => {
  grid[x][y] = Math.round(Math.random());
});

function withinBounds(grid, x, y) {
  return x >= 0 && x < grid.length && y >=0 && y < grid[0].length;
}

function getNeighborCoors(grid, x, y) {
  return DIR.reduce((acc, [dx, dy]) => {
    const [nx, ny] = [dx + x, dy + y];
    if (withinBounds(grid, nx, ny)) {
      acc.push([nx, ny]);
    }
    return acc;
  }, []);
}

const getCacheNeighborCoors = cacheFn(
  getNeighborCoors,
  NEIGHBOR_COORS_CACHE,
  (_, x, y) => `${x}:${y}`
);

function countNeighborsAlive(grid, x, y) {
  const neighbors = getCacheNeighborCoors(grid, x, y);

  return neighbors.reduce((acc, [nx, ny]) => {
    if (grid[nx][ny] === 1) {
      acc += 1;
    }
    return acc;
  }, 0);
}

function computeNextState(curr, neighbors) {
  return (curr === 1 && neighbors === 2 || neighbors === 3) ? 1 : 0;
}

function nextState(grid, buffer) {
  GRID_COORS.forEach(([x, y]) => {
    const cell = grid[x][y];
    const count = countNeighborsAlive(grid, x, y);
    buffer[x][y] = computeNextState(cell, count);
  });
}

function render(ctx, grid) {
  ctx.fillStyle = BACKGROUND_COLOR;

  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

  GRID_COORS.forEach(([x, y]) => {
    const cell = grid[x][y];
    if (cell === 1) {
      ctx.fillStyle = CELL_FILL_STYLE;
      ctx.fillRect(
        x * CELL_SIZE + 1,
        y * CELL_SIZE + 1,
        CELL_SIZE - 1,
        CELL_SIZE - 1
      );
    }
  });
}

let start;
const throttleDiff = (1000 / FPS);

function step() {
  const now = +new Date();
  start = start || now;
  const diff = now - start;
  start = now;

  render(ctx, grid);

  const callNextFrame = window.requestAnimationFrame.bind(null, step);
  if (diff > throttleDiff) {
    callNextFrame();
  } else {
    setTimeout(callNextFrame, throttleDiff - diff);
  }
}

step();

setInterval(() => {
  nextState(grid, buffer);
  [buffer, grid] = [grid, buffer];
}, 80);