/*
 * Salsa on2 basic step as foot positions on the beat annotations.
 *
 * Coordinates are in the dancer's own frame: x = the dancer's right (+), y = forward (+), one unit is
 * about a step (the small steps on 1 and 5 are 0.3, the big steps on 2 and 6 are 1.25). Each table lists where a foot is at the moment count 1..8 sounds; between two beats a
 * foot glides from its position at one count to its position at the next, so a foot that steps on
 * count n is already on its way during the beat before it and lands exactly on the beat.
 * On 4 and 8 nothing moves: those are holds, and the free foot only starts travelling after them.
 *
 * Leader:
 *   1  left foot a bit to the back          5  right foot a bit in front of the center
 *   2  right foot to the very back          6  left foot steps forward
 *   3  left foot back on its spot from 1    7  right foot back on its spot from 5
 *   (4 and 8: holds)
 * The follower mirrors the leader: what the leader's left foot does, the follower's right foot does
 * the other way round (back becomes forward), and the other way round.
 */
(function (root) {
  const LEFT = -0.5, RIGHT = 0.5;
  // y of each foot at counts 1..8 (x is fixed per foot)
  const LEADER_L = [-0.3, -0.3, -0.3, -0.3, -0.3, 1.25, 1.25, 1.25];
  const LEADER_R = [0.3, -1.25, -1.25, -1.25, 0.3, 0.3, 0.3, 0.3];
  const column = (x, ys) => ys.map((y) => [x, y]);

  const FEET = {
    leader: { L: column(LEFT, LEADER_L), R: column(RIGHT, LEADER_R) },
    follower: { R: column(RIGHT, LEADER_L.map((y) => -y)), L: column(LEFT, LEADER_R.map((y) => -y)) },
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

  const stateAt = (role, count) => ({ L: FEET[role].L[count - 1], R: FEET[role].R[count - 1] });
  const CENTERED = { L: [-0.5, 0], R: [0.5, 0] };   // both feet centered: where the dancers start

  /** Both feet moving from the positions `a` to `b` (each {L: [x, y], R: [x, y]}); `to` is the count reached. */
  function blend(role, a, b, phase, to) {
    const out = {};
    const e = smooth(phase);
    for (const foot of ["L", "R"]) {
      const moving = a[foot][0] !== b[foot][0] || a[foot][1] !== b[foot][1];
      const retakes = !moving && LANDS[role][to] === foot;   // steps back onto the same spot
      out[foot] = {
        x: a[foot][0] + (b[foot][0] - a[foot][0]) * e,
        y: a[foot][1] + (b[foot][1] - a[foot][1]) * e,
        lift: moving ? Math.sin(Math.PI * phase) : retakes ? 0.3 * Math.sin(Math.PI * phase) : 0,
      };
    }
    return out;
  }

  /** Both feet of a dancer while moving from count `from` to count `to` (1-8), `phase` 0..1. */
  function pose(role, from, to, phase) {
    return blend(role, stateAt(role, from), stateAt(role, to), phase, to);
  }

  /**
   * What the dancers look like at time t. `beats` is [[time, count], ...] ascending.
   *
   * Expected counts (1->2, ..., 8->1) are timed exactly on the beat. When the next label is not the
   * expected one (a relabelled stretch, a missing beat) or the annotation has a gap longer than
   * `maxGap` seconds, the dancers move on to the pose of the next label right away, quickly (in
   * `FAST_SECONDS` at most, half the interval at most), and wait there, so nothing jumps on the beat.
   * Before the first beat the dancers stand with both feet centered and move into the position of
   * the first count during the beat before it, like every other step.
   */
  const FAST_SECONDS = 0.35;

  function frame(beats, t, maxGap = 1.5) {
    const times = beats.map((b) => b[0]);
    const k = beatAt(times, t);
    const still = { landing: { leader: null, follower: null }, glow: 0 };
    if (k < 0) {
      const to = beats[0][1];
      const period = beats.length > 1 ? beats[1][0] - beats[0][0] : 0.5;
      const phase = Math.min(Math.max((t - (beats[0][0] - period)) / period, 0), 1);
      const lead = (role) => blend(role, CENTERED, stateAt(role, to), phase, to);
      return { k, count: null, phase, ...still, leader: lead("leader"), follower: lead("follower") };
    }
    if (k === beats.length - 1) {
      const count = beats[k][1];
      return { k, count, phase: 0, ...still,
               leader: pose("leader", count, count, 0), follower: pose("follower", count, count, 0) };
    }
    const from = beats[k][1], to = beats[k + 1][1];
    const interval = times[k + 1] - times[k];
    const expected = to === (from % 8) + 1;
    const duration = expected && interval <= maxGap ? interval : Math.min(FAST_SECONDS, 0.5 * interval);
    const phase = Math.min((t - times[k]) / duration, 1);
    return {
      k, count: from, phase,
      landing: { leader: LANDS.leader[from] || null, follower: LANDS.follower[from] || null },
      glow: Math.max(0, 1 - ((t - times[k]) / interval) * 1.6),
      leader: pose("leader", from, to, phase),
      follower: pose("follower", from, to, phase),
    };
  }

  const api = { FEET, LANDS, beatAt, pose, frame };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.SalsaDance = api;
})(typeof window !== "undefined" ? window : globalThis);
