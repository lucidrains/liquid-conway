import Rx from 'rxjs';
import helpers from './helpers';

require('./app.sass');

const { initArray } = helpers;

const c = document.getElementById('canvas');

c.oncontextmenu = (e) => {
  e.preventDefault();
};

const FPS = 30;
const WIDTH = 60;
const HEIGHT = 60;
const CELL_SIZE = 10;
const CANVAS_WIDTH = WIDTH * CELL_SIZE;
const CANVAS_HEIGHT = HEIGHT * CELL_SIZE;

const CELL_FILL_STYLE = 'rgb(22, 109, 175)';
const CELL_COLOR_LIGHT = 'rgb(100, 154, 239)';
const CELL_COLOR_DARK = 'rgb(44, 117, 232)';
const CELL_COLOR_DARKEST = 'rgb(8, 92, 224)';

const BACKGROUND_COLOR = 'rgb(255, 255, 255)';

function initGrid(x, y, init) {
  return initArray(x, init).map(() => initArray(y, init));
}

const GRID = initGrid(WIDTH, HEIGHT, { val: 0, diff: 0 });

const GRID_COORS = GRID.reduce((acc, row, x) =>
  acc.concat(row.map((_, y) => [x, y]))
, []);

function withinBounds(grid, x, y) {
  return x >= 0 && x < grid.length && y >= 0 && y < grid[0].length;
}

function isEmptyCell(grid, x, y) {
  return withinBounds(grid, x, y) && !grid[x][y].wall;
}

c.setAttribute('width', CANVAS_WIDTH.toString());
c.setAttribute('height', CANVAS_HEIGHT.toString());
c.style.display = 'block';

const ctx = c.getContext('2d');

Rx.Observable
  .fromEvent(c, 'mousedown')
  .flatMap((md) => {
    md.preventDefault();
    let ev = md;

    return Rx.Observable.merge(
        Rx.Observable.interval(10).map(() => null),
        Rx.Observable.fromEvent(c, 'mousemove')
      )
      .map((mm) => {
        ev = mm || ev;
        return { ev, which: md.which };
      })
      .takeUntil(Rx.Observable.merge(
        Rx.Observable.fromEvent(c, 'mouseup'),
        Rx.Observable.fromEvent(c, 'mouseout')
      ));
  })
  .throttleTime(10)
  .subscribe(({ ev, which }) => {
    const { clientX, clientY, target } = ev;
    const { left, top } = target.getBoundingClientRect();
    const x = clientX - left;
    const y = clientY - top;
    const [cx, cy] = [x, y].map(el => Math.floor(el / CELL_SIZE));

    if (!withinBounds(GRID, cx, cy)) {
      return;
    }

    if (which === 3) {
      GRID[cx][cy].wall = true;
      GRID[cx][cy].val = 0;
    } else if (which === 1) {
      delete GRID[cx][cy].wall;
      GRID[cx][cy].val += 100;
    }
  });

function nextState(grid) {
  const withinGrid = withinBounds.bind(null, grid);

  GRID_COORS.forEach(([x, y]) => {
    const cell = grid[x][y];
    const val = cell.val;

    if (cell.wall || val < 0) {
      return;
    }

    if (withinGrid(x, y + 1) && grid[x][y + 1].val < 100) {
      cell.diff -= val;
      grid[x][y + 1].diff += val;
      return;
    }

    let volume = val;

    if (withinGrid(x, y - 1) && grid[x][y - 1].val < cell.val && cell.val > 100) {
      const diff = Math.floor((val - grid[x][y - 1].val) / 10);
      grid[x][y - 1].diff += diff;
      cell.diff -= diff;
      volume -= diff;
    }

    if (withinGrid(x, y + 1) && grid[x][y + 1].val < cell.val) {
      const diff = Math.floor((val - grid[x][y + 1].val) / 5);
      grid[x][y + 1].diff += diff;
      cell.diff -= diff;
      volume -= diff;
    }

    if (volume < 0) {
      return;
    }

    const flowCoors = [[1, 0], [-1, 0]]
      .filter(([dx, dy]) => {
        const [nx, ny] = [x + dx, y + dy];
        return withinGrid(nx, ny) && val > grid[nx][ny].val;
      });

    const diffs = flowCoors.map(([dx, dy]) => {
      const [nx, ny] = [x + dx, y + dy];
      const diff = val - grid[nx][ny].val;
      return diff;
    });

    const totalDiff = diffs.reduce((acc, diff) => {
      acc += diff;
      return acc;
    }, 0);

    const finalDiff = Math.min(volume, totalDiff);

    diffs.forEach((diff, i) => {
      const [dx, dy] = flowCoors[i];
      const weightedDiff = Math.floor(finalDiff * (diff / totalDiff)) / 2;

      grid[x][y].diff -= weightedDiff;
      grid[x + dx][y + dy].diff += weightedDiff;
    });
  });

  GRID_COORS.forEach(([x, y]) => {
    const cell = grid[x][y];
    cell.val += cell.diff;
    cell.diff = 0;
  });
}

function render(context, grid) {
  context.fillStyle = BACKGROUND_COLOR;
  context.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  GRID_COORS.forEach(([x, y]) => {
    const cell = grid[x][y];

    if (cell.wall) {
      context.fillStyle = 'black';
      context.fillRect(
        (x * CELL_SIZE) + 1,
        (y * CELL_SIZE) + 1,
        CELL_SIZE,
        CELL_SIZE
      );
    } else {
      const val = cell.val;

      if (val <= 0) {
        return;
      }

      let fillStyle = CELL_FILL_STYLE;
      let cellHeight = CELL_SIZE - 1;
      let cellY = (y * CELL_SIZE) + 1;

      const hasBottomNeighbor = (!isEmptyCell(grid, x, y + 1) || grid[x][y + 1].val > 0);
      const hasNoTopNeighbor = (!isEmptyCell(grid, x, y - 1) || grid[x][y - 1].val <= 0);

      if (val < 100 && hasBottomNeighbor && hasNoTopNeighbor) {
        cellHeight *= parseFloat(val) / 100;
        cellY += (CELL_SIZE - cellHeight);
      }

      if (val < 80) {
        fillStyle = CELL_COLOR_LIGHT;
      } else if (val > 120) {
        fillStyle = CELL_COLOR_DARK;
      } else if (val > 150) {
        fillStyle = CELL_COLOR_DARKEST;
      }

      context.fillStyle = fillStyle;
      context.fillRect(
        (x * CELL_SIZE) + 1,
        cellY,
        CELL_SIZE - 1,
        cellHeight
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

  render(ctx, GRID);

  const callNextFrame = window.requestAnimationFrame.bind(null, step);
  if (diff > throttleDiff) {
    callNextFrame();
  } else {
    setTimeout(callNextFrame, throttleDiff - diff);
  }
}

step();

setInterval(() => {
  nextState(GRID);
}, 50);
