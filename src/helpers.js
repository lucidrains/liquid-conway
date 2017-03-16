import clone from 'lodash.clone';

function initArray(num, init) {
  return Array.from(Array(num)).map(() => clone(init));
}

function range(low, high, step = 1) {
  const arr = [];
  for (let i = low; i <= high; i += step) {
    arr.push(i);
  }
  return arr;
}

function cacheFn(fn, cacheObj, deriveKeyFn) {
  return (...args) => {
    let key;
    if (!deriveKeyFn) {
      key = JSON.stringify(args);
    } else {
      key = deriveKeyFn(...args);
    }
    
    if (cacheObj[key] !== undefined) {
      return cacheObj[key];
    }

    const ret = fn(...args);
    cacheObj[key] = ret;
    return ret;
  };
}

function randInt(num) {
  return Math.floor(Math.random() * (num + 1));
}

export default {
  cacheFn,
  range,
  initArray,
  randInt
}
