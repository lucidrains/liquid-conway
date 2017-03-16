require('./app.sass')
import Color from 'color';
import Rx from 'rxjs';
import helpers from './helpers'

const {
  range,
  initArray,
  cacheFn,
  randInt
} = helpers

const c = document.getElementById('canvas');

c.oncontextmenu = (e) => {
  e.preventDefault();
}

const FPS = 30;
const WIDTH = 60;
const HEIGHT = 60;
const CELL_SIZE = 10;
const CANVAS_WIDTH = WIDTH * CELL_SIZE;
const CANVAS_HEIGHT = HEIGHT * CELL_SIZE;

const CELL_FILL_STYLE = 'rgb(22, 109, 175)';
const CELL_COLOR = Color(CELL_FILL_STYLE);

function rgbString({r, g, b}) {
  return `rgb(${r}, ${g}, ${b})`;
}

const CELL_COLOR_LIGHT = rgbString(CELL_COLOR.lighten(0.2).rgb());
const CELL_COLOR_DARK = rgbString(CELL_COLOR.darken(0.2).rgb());

const BACKGROUND_COLOR = 'rgb(255, 255, 255)';
const NEIGHBOR_COORS_CACHE = {};

const DIR = range(-1, 1)
  .reduce((acc, x) => acc.concat(range(-1, 1).map((y) => [x, y])), [])
  .filter(([x, y]) => !(x === 0 && y === 0));

c.setAttribute('width', CANVAS_WIDTH.toString());
c.setAttribute('height', CANVAS_HEIGHT.toString());
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
        return {ev, which: md.which};
      })
      .takeUntil(Rx.Observable.merge(
        Rx.Observable.fromEvent(c, 'mouseup'),
        Rx.Observable.fromEvent(c, 'mouseout')
      ));
  })
  .throttleTime(20)
  .subscribe(({ev, which}) => {
    const {clientX, clientY, target} = ev;
    const {left, top} = target.getBoundingClientRect();
    const x = clientX - left;
    const y = clientY - top;
    const [cx, cy] = [x, y].map(el => Math.floor(el / CELL_SIZE));

    if (which === 3) {
      grid[cx][cy].wall = true;
      grid[cx][cy].val = 0;
    } else if (which === 1) {
      delete grid[cx][cy].wall
      grid[cx][cy].val += 100;
    }
  });

function initGrid(x, y, init) {
  return initArray(x, init).map(row => initArray(y, init));
}

const grid = initGrid(WIDTH, HEIGHT, {val: 0, diff: 0});

const GRID_COORS = grid.reduce((acc, row, x) => {
  acc = acc.concat(row.map((_, y) => [x, y]));
  return acc;
}, []);

function withinBounds(grid, x, y) {
  return x >= 0 && x < grid.length && y >=0 && y < grid[0].length && !grid[x][y].wall;
}

function nextState(grid) {
  const withinGrid = withinBounds.bind(null, grid);

  GRID_COORS.forEach(([x, y]) => {
    const cell = grid[x][y];
    const val = cell.val;

    if (cell.wall || val < 0) {
      return;
    }

    if (withinGrid(x, y+1) && grid[x][y+1].val < 100) {
      cell.diff -= val;
      grid[x][y+1].diff += val;
      return;
    }

    let volume = val;

    if (withinGrid(x, y-1) && grid[x][y-1].val < cell.val && cell.val > 100) {
      const diff = Math.floor((val - grid[x][y-1].val) / 4);
      grid[x][y-1].diff += diff;
      cell.diff -= diff;
      volume -= diff;
    }

    if (withinGrid(x, y+1) && grid[x][y+1].val < cell.val) {
      const diff = Math.floor((val - grid[x][y+1].val) / 4);
      grid[x][y+1].diff += diff;
      cell.diff -= diff;
      volume -= diff;
    }

    const flowCoors = [[1, 0], [-1, 0]]
      .filter(([dx, dy]) => {
        const [nx, ny] = [x + dx, y + dy];
        return withinGrid(nx, ny) && val > grid[nx][ny].val;
      });

    flowCoors.forEach(([dx, dy]) => {
      const [nx, ny] = [x + dx, y + dy];
      const diff = (volume <= 0) ? 0 : Math.floor(Math.min(volume, val - grid[nx][ny].val));
      const weightedDiff = Math.floor(diff / flowCoors.length / 2);
      grid[nx][ny].diff += weightedDiff;
      cell.diff -= weightedDiff;
    });
  });

  GRID_COORS.forEach(([x, y]) => {
    const cell = grid[x][y];
    cell.val += cell.diff;
    cell.diff = 0;
  });
}

function render(ctx, grid) {
  ctx.fillStyle = BACKGROUND_COLOR;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

  GRID_COORS.forEach(([x, y]) => {
    if (grid[x][y].wall) {
      ctx.fillStyle = 'black';
      ctx.fillRect(
        x * CELL_SIZE + 1,
        y * CELL_SIZE + 1,
        CELL_SIZE,
        CELL_SIZE
      );
    } else {
      const val = grid[x][y].val;

      if (val <= 0) {
        return;
      }

      let fillStyle = CELL_FILL_STYLE;    
      let valHeight = CELL_SIZE - 1;
      let valY = (y * CELL_SIZE + 1);

      if (val < 100 && (!withinBounds(grid, x, y + 1) || grid[x][y + 1].val > 0) && (withinBounds(grid, x, y - 1) && grid[x][y - 1].val <= 0)) {
        valHeight *= parseFloat(val) / 100;
        valY += (CELL_SIZE - valHeight);
      }

      if (val < 80) {
        fillStyle = CELL_COLOR_LIGHT;
      } else if (val > 120) {
        fillStyle = CELL_COLOR_DARK;
      }

      ctx.fillStyle = fillStyle;
      ctx.fillRect(
        x * CELL_SIZE + 1,
        valY,
        CELL_SIZE - 1,
        valHeight
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
  nextState(grid);
}, 30);