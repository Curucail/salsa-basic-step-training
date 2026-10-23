/*
 * Salsa on2 basic step as foot positions on the beat annotations.
 *
 * Coordinates are in the dancer's own frame: x = the dancer's right (+), y = forward (+), one unit is
 * about a step. Each table lists where a foot is at the moment count 1..8 sounds; between two beats a
 * foot glides from its position at one count to its position at the next, so a foot that steps on
 * count n is already on its way during the beat before it and lands exactly on the beat.
 *
 *   Leader   1 L back   2 R replace   3 L together   4 pause   5 R forward   6 L replace   7 R together   8 pause
 *   Follower 1 R fwd    2 L replace   3 R together   4 pause   5 L back      6 R replace   7 L together   8 pause
 *
 * The break steps (where the direction changes) are on 2 and 6, as in on2.
 */
(function (root) {
  const FEET = {
    leader: {
      L: [[-0.5, -1], [-0.5, -0.5], [-0.5, 0], [-0.5, 0], [-0.5, 0], [-0.5, 0], [-0.5, 0], [-0.5, 0]],
      R: [[0.5, 0], [0.5, 0], [0.5, 0], [0.5, 0], [0.5, 1], [0.5, 0.5], [0.5, 0], [0.5, 0]],
    },
    follower: {
      R: [[0.5, 1], [0.5, 0.5], [0.5, 0], [0.5, 0], [0.5, 0], [0.5, 0], [0.5, 0], [0.5, 0]],
      L: [[-0.5, 0], [-0.5, 0], [-0.5, 0], [-0.5, 0], [-0.5, -1], [-0.5, -0.5], [-0.5, 0], [-0.5, 0]],
    },
  };

  // Which foot takes the weight on which count.
  const LANDS = {
    leader: { 1: "L", 2: "R", 3: "L", 5: "R", 6: "L", 7: "R" },
    follower: { 1: "R", 2: "L", 3: "R", 5: "L", 6: "R", 7: "L" },
  };

  const smooth = (p) => p * p * (3 - 2 * p);

  /** Index of the last beat at or before t (times ascending), or -1 before the first. */
  function beatAt(times, t) {
    let lo = 0, hi = times.length - 1, k = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (times[mid] <= t) { k = mid; lo = mid + 1; } else { hi = mid - 1; }
    }
    return k;
  }

  /** Both feet of a dancer while moving from count `from` to count `to` (1-8), `phase` 0..1. */
  function pose(role, from, to, phase) {
    const out = {};
    for (const foot of ["L", "R"]) {
      const a = FEET[role][foot][from - 1], b = FEET[role][foot][to - 1];
      const e = smooth(phase);
      const moving = a[0] !== b[0] || a[1] !== b[1];
      out[foot] = {
        x: a[0] + (b[0] - a[0]) * e,
        y: a[1] + (b[1] - a[1]) * e,
        lift: moving ? Math.sin(Math.PI * phase) : 0,
      };
    }
    return out;
  }

  /**
   * What the dancers look like at time t. `beats` is [[time, count], ...] ascending.
   * Gaps in the annotation longer than `maxGap` seconds are treated as standing still.
   */
  function frame(beats, t, maxGap = 1.5) {
    const times = beats.map((b) => b[0]);
    const k = beatAt(times, t);
    const home = (role) => pose(role, 8, 8, 0);
    if (k < 0 || k === beats.length - 1 || times[k + 1] - times[k] > maxGap) {
      const count = k < 0 ? null : beats[k][1];
      const hold = (role) => (count ? pose(role, count, count, 0) : home(role));
      return { k, count, phase: 0, landing: { leader: null, follower: null }, glow: 0,
               leader: hold("leader"), follower: hold("follower") };
    }
    const phase = (t - times[k]) / (times[k + 1] - times[k]);
    const from = beats[k][1], to = beats[k + 1][1];
    return {
      k, count: from, phase,
      landing: { leader: LANDS.leader[from] || null, follower: LANDS.follower[from] || null },
      glow: Math.max(0, 1 - phase * 1.6),
      leader: pose("leader", from, to, phase),
      follower: pose("follower", from, to, phase),
    };
  }

  const api = { FEET, LANDS, beatAt, pose, frame };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.SalsaDance = api;
})(typeof window !== "undefined" ? window : globalThis);
