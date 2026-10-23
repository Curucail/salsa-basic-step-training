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

  const FOOT = ["L", "R"];
  const stateAt = (role, count) => ({ L: FEET[role].L[count - 1], R: FEET[role].R[count - 1] });
  const CENTERED = { L: [-0.5, 0], R: [0.5, 0] };   // both feet centered: where the dancers start

  /** One foot moving from `a` to `b` ([x, y] each); `retake`: it steps back onto the same spot. */
  function footMove(a, b, phase, retake) {
    const moving = a[0] !== b[0] || a[1] !== b[1];
    const e = smooth(phase);
    return {
      x: a[0] + (b[0] - a[0]) * e,
      y: a[1] + (b[1] - a[1]) * e,
      lift: moving ? Math.sin(Math.PI * phase) : retake ? 0.3 * Math.sin(Math.PI * phase) : 0,
    };
  }

  /** Both feet of a dancer while moving from count `from` to count `to` (1-8), `phase` 0..1. */
  function pose(role, from, to, phase) {
    const a = stateAt(role, from), b = stateAt(role, to), out = {};
    for (const foot of FOOT) out[foot] = footMove(a[foot], b[foot], phase, LANDS[role][to] === foot);
    return out;
  }

  /**
   * Where each foot is at every beat, and whether it has stepped since the dancers last started over
   * (at the start of the song, or after an unexpected label). A foot that has not stepped yet stays
   * where it is until its own step, so only one foot moves at a time and nothing jumps.
   */
  const analyses = new WeakMap();
  function analyze(beats, maxGap) {
    let an = analyses.get(beats);
    if (an && an.maxGap === maxGap) return an;
    const expected = beats.map((b, i) => i < beats.length - 1 && beats[i + 1][1] === (b[1] % 8) + 1
                                          && beats[i + 1][0] - b[0] <= maxGap);
    const landed = { leader: { L: [], R: [] }, follower: { L: [], R: [] } };
    const pos = { leader: { L: [], R: [] }, follower: { L: [], R: [] } };
    beats.forEach((b, i) => {
      const start = i === 0 || !expected[i - 1];
      for (const role of ["leader", "follower"]) for (const foot of FOOT) {
        const lands = LANDS[role][b[1]] === foot;
        landed[role][foot][i] = (!start && landed[role][foot][i - 1]) || lands;
        pos[role][foot][i] = landed[role][foot][i] ? stateAt(role, b[1])[foot]
                           : i === 0 ? CENTERED[foot] : pos[role][foot][i - 1];
      }
    });
    an = { maxGap, expected, landed, pos };
    analyses.set(beats, an);
    return an;
  }

  /**
   * What the dancers look like at time t. `beats` is [[time, count], ...] ascending.
   *
   * Expected counts (1->2, ..., 8->1) are timed exactly on the beat. When the next label is not the
   * expected one (a relabelled stretch, a missing beat) the dancers just go on to the next step: only
   * the foot that steps on that label moves, to its position, and the other foot stays where it is.
   * After a long annotation gap (`maxGap` seconds) that foot moves in the last `FAST_SECONDS`.
   * Before the first beat the dancers stand with both feet centered and the foot that takes the
   * weight on the first count steps into place during the beat before it; the other foot stays
   * centered until its own step.
   */
  const FAST_SECONDS = 0.35;

  function frame(beats, t, maxGap = 1.5) {
    const times = beats.map((b) => b[0]);
    const k = beatAt(times, t);
    const still = { landing: { leader: null, follower: null }, glow: 0 };
    const roles = ["leader", "follower"];
    if (k < 0) {
      const to = beats[0][1];
      const period = beats.length > 1 ? beats[1][0] - beats[0][0] : 0.5;
      const phase = Math.min(Math.max((t - (beats[0][0] - period)) / period, 0), 1);
      const out = { k, count: null, phase, ...still };
      for (const role of roles) {
        out[role] = {};
        for (const foot of FOOT) {
          const lands = LANDS[role][to] === foot;
          out[role][foot] = footMove(CENTERED[foot], lands ? stateAt(role, to)[foot] : CENTERED[foot], phase, false);
        }
      }
      return out;
    }
    const an = analyze(beats, maxGap);
    const from = beats[k][1];
    const out = { k, count: from, phase: 0, ...still };
    if (k === beats.length - 1) {
      for (const role of roles) {
        out[role] = {};
        for (const foot of FOOT) {
          const at = an.pos[role][foot][k];
          out[role][foot] = footMove(at, at, 0, false);
        }
      }
      return out;
    }
    const to = beats[k + 1][1];
    const interval = times[k + 1] - times[k], elapsed = t - times[k];
    out.landing = { leader: LANDS.leader[from] || null, follower: LANDS.follower[from] || null };
    out.glow = Math.max(0, 1 - (elapsed / interval) * 1.6);
    out.phase = elapsed / interval;
    const expected = an.expected[k];
    // after a long gap the step is only made in the last moments before its beat
    const phase = !expected && interval > maxGap
      ? Math.min(Math.max((elapsed - (interval - FAST_SECONDS)) / FAST_SECONDS, 0), 1)
      : elapsed / interval;
    for (const role of roles) {
      out[role] = {};
      for (const foot of FOOT) {
        const lands = LANDS[role][to] === foot;
        const at = an.pos[role][foot][k];
        // expected: every foot follows the step table; unexpected: only the stepping foot moves
        const moves = expected ? an.landed[role][foot][k] || lands : lands;
        out[role][foot] = footMove(at, moves ? stateAt(role, to)[foot] : at, phase, lands);
      }
    }
    return out;
  }

  const api = { FEET, LANDS, beatAt, pose, frame };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.SalsaDance = api;
})(typeof window !== "undefined" ? window : globalThis);
