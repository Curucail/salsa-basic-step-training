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
   * Which feet have stepped since the dancers last stood centered (at the start, or after an
   * unexpected label). A foot that has not stepped yet stays centered until its own step: only one
   * foot moves at a time.
   */
  const analyses = new WeakMap();
  function analyze(beats, maxGap) {
    let an = analyses.get(beats);
    if (an && an.maxGap === maxGap) return an;
    const expected = beats.map((b, i) => i < beats.length - 1 && beats[i + 1][1] === (b[1] % 8) + 1
                                          && beats[i + 1][0] - b[0] <= maxGap);
    const landed = { leader: { L: [], R: [] }, follower: { L: [], R: [] } };
    beats.forEach((b, i) => {
      const entry = i === 0 || !expected[i - 1];
      for (const role of ["leader", "follower"]) for (const foot of FOOT) {
        landed[role][foot][i] = (!entry && landed[role][foot][i - 1]) || LANDS[role][b[1]] === foot;
      }
    });
    an = { maxGap, expected, landed };
    analyses.set(beats, an);
    return an;
  }

  /**
   * What the dancers look like at time t. `beats` is [[time, count], ...] ascending.
   *
   * Expected counts (1->2, ..., 8->1) are timed exactly on the beat. When the next label is not the
   * expected one (a relabelled stretch, a missing beat) or the annotation has a gap longer than
   * `maxGap` seconds, the dancers go back to both feet centered right away (one foot after the other,
   * in `FAST_SECONDS` at most), wait there, and move into the position of the next label during the
   * beat before it, so nothing jumps on the beat.
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
    const enter = (role, to, phase) => {            // from centered into the position of count `to`
      const out = {};
      for (const foot of FOOT) {
        const lands = LANDS[role][to] === foot;
        out[foot] = footMove(CENTERED[foot], lands ? stateAt(role, to)[foot] : CENTERED[foot], phase, false);
      }
      return out;
    };
    if (k < 0) {
      const to = beats[0][1];
      const period = beats.length > 1 ? beats[1][0] - beats[0][0] : 0.5;
      const phase = Math.min(Math.max((t - (beats[0][0] - period)) / period, 0), 1);
      return { k, count: null, phase, ...still, leader: enter("leader", to, phase), follower: enter("follower", to, phase) };
    }
    const an = analyze(beats, maxGap);
    const from = beats[k][1];
    // where a foot is at beat k: its table position once it has stepped, centered before that
    const at = (role, foot) => (an.landed[role][foot][k] ? stateAt(role, from)[foot] : CENTERED[foot]);
    if (k === beats.length - 1) {
      const rest = (role) => ({ L: footMove(at(role, "L"), at(role, "L"), 0, false),
                                R: footMove(at(role, "R"), at(role, "R"), 0, false) });
      return { k, count: from, phase: 0, ...still, leader: rest("leader"), follower: rest("follower") };
    }
    const to = beats[k + 1][1];
    const interval = times[k + 1] - times[k], elapsed = t - times[k];
    const landing = { leader: LANDS.leader[from] || null, follower: LANDS.follower[from] || null };
    const glow = Math.max(0, 1 - (elapsed / interval) * 1.6);
    const out = { k, count: from, phase: elapsed / interval, landing, glow };
    if (an.expected[k]) {
      for (const role of roles) {
        out[role] = {};
        for (const foot of FOOT) {
          const lands = LANDS[role][to] === foot;
          const target = an.landed[role][foot][k] || lands ? stateAt(role, to)[foot] : CENTERED[foot];
          out[role][foot] = footMove(at(role, foot), target, elapsed / interval, lands);
        }
      }
      return out;
    }
    // unexpected next label: to the centered stance (one foot after the other), wait, then step into place
    const toCenter = Math.min(FAST_SECONDS, 0.4 * interval);
    const fromCenter = Math.min(FAST_SECONDS, interval - toCenter);
    for (const role of roles) {
      if (elapsed >= interval - fromCenter) {
        out[role] = enter(role, to, (elapsed - (interval - fromCenter)) / fromCenter);
        continue;
      }
      const far = (foot) => Math.hypot(at(role, foot)[0] - CENTERED[foot][0], at(role, foot)[1] - CENTERED[foot][1]);
      const order = far("L") >= far("R") ? ["L", "R"] : ["R", "L"];     // the farther foot goes first
      out[role] = {};
      order.forEach((foot, i) => {
        const phase = Math.min(Math.max((elapsed - (i * toCenter) / 2) / (toCenter / 2), 0), 1);
        out[role][foot] = footMove(at(role, foot), CENTERED[foot], phase, false);
      });
    }
    return out;
  }

  const api = { FEET, LANDS, beatAt, pose, frame };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.SalsaDance = api;
})(typeof window !== "undefined" ? window : globalThis);
