/* 可复现的伪随机数生成器（mulberry32）。 */
(function (root, factory) {
  'use strict';
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.TA_RNG = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function createRng(seed) {
    let a = (Number(seed) >>> 0) || 0x9e3779b9;
    const api = {
      next() {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      },
      int(n) {
        if (n <= 0) return 0;
        return Math.floor(api.next() * n);
      },
      pick(arr) {
        return arr[api.int(arr.length)];
      },
      chance(p) {
        return api.next() < p;
      },
      state() {
        return a >>> 0;
      }
    };
    return api;
  }

  return { createRng };
});
