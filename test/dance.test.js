// node test/dance.test.js
const assert = require("node:assert/strict");
const { frame, beatAt, FEET, LANDS } = require("../dance.js");

// a steady 8-count at 120 BPM starting at t = 1
const beats = [];
for (let i = 0; i < 24; i++) beats.push([1 + i * 0.5, (i % 8) + 1]);
const at = (n, phase = 0) => frame(beats, beats[n][0] + phase * 0.5);

assert.equal(beatAt(beats.map((b) => b[0]), 0.9), -1);
assert.equal(beatAt(beats.map((b) => b[0]), 1.0), 0);
assert.equal(beatAt(beats.map((b) => b[0]), 1.74), 1);

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);

// leader, count by count
near(at(0).leader.L.y, -0.3);                       // 1: left foot a bit to the back
near(at(1).leader.R.y, -1.25);                       // 2: right foot to the very back
near(at(2).leader.L.y, at(0).leader.L.y);           // 3: left foot on the same spot as on 1
near(at(4).leader.R.y, 0.3);                        // 5: right foot a bit in front of the center
near(at(5).leader.L.y, 1.25);                        // 6: left foot steps forward
near(at(6).leader.R.y, at(4).leader.R.y);           // 7: right foot on the same spot as on 5
// follower: mirrored (right foot forward on 1)
near(at(0).follower.R.y, 0.3);
near(at(1).follower.L.y, 1.25);
near(at(5).follower.R.y, -1.25);

// feet hold still on 4 and 8 (between counts 3-4 and 7-8) ...
for (const n of [2, 6]) {
  const a = at(n, 0), b = at(n, 0.95);
  for (const role of ["leader", "follower"]) for (const foot of ["L", "R"]) {
    near(a[role][foot].y, b[role][foot].y);
    assert.equal(b[role][foot].lift, 0);
  }
}
// ... the stepping foot is in the air on the beat before it lands ...
assert.ok(at(7, 0.5).leader.L.lift > 0.9);      // 8 -> 1: left foot swings back
assert.ok(at(3, 0.5).leader.R.lift > 0.9);      // 4 -> 5: right foot swings forward
// ... and a foot that takes the weight again on the same spot only dips a little
assert.ok(at(1, 0.5).leader.L.lift > 0 && at(1, 0.5).leader.L.lift < 0.5);   // 2 -> 3: left foot back onto its spot

// a foot lands exactly on the beat: position continuous at the beat
near(frame(beats, beats[8][0] - 1e-9).leader.L.y, frame(beats, beats[8][0]).leader.L.y);

// the foot that takes the weight
assert.equal(at(0).landing.leader, "L");
assert.equal(at(0).landing.follower, "R");
assert.equal(at(3).landing.leader, null);

// leader and follower mirror each other: what one foot does forward, the other does back
for (let c = 0; c < 8; c++) {
  near(FEET.leader.L[c][1], -FEET.follower.R[c][1]);
  near(FEET.leader.R[c][1], -FEET.follower.L[c][1]);
}
assert.deepEqual(Object.keys(LANDS.leader), Object.keys(LANDS.follower));

// before the first beat: both feet centered, then settling into count 1 during the beat before it
const idle = frame(beats, 0.3);
assert.equal(idle.count, null);
for (const role of ["leader", "follower"]) {
  near(idle[role].L.y, 0); near(idle[role].R.y, 0);
  near(idle[role].L.x, -0.5); near(idle[role].R.x, 0.5);
  assert.equal(idle[role].L.lift, 0);
}
const lead = frame(beats, 0.75);
assert.ok(lead.leader.L.lift > 0.9);                    // the left foot steps back into count 1
assert.equal(lead.leader.R.lift, 0);                    // the right foot stays centered ...
near(lead.leader.R.y, 0);
near(frame(beats, 1.0).leader.L.y, -0.3);
near(frame(beats, 1.0).leader.R.y, 0);                  // ... also on count 1 itself
assert.ok(at(0, 0.5).leader.R.lift > 0.9);              // and steps on its own count, 2
assert.equal(at(0, 0.5).leader.L.lift, 0);
near(at(0, 0.999999).leader.R.y, -1.25);
// the follower: right foot first, left foot centered until count 2
near(frame(beats, 1.0).follower.R.y, 0.3);
near(frame(beats, 1.0).follower.L.y, 0);
assert.equal(frame(beats, 0.75).follower.L.lift, 0);

// an unexpected next label (here 2 -> 6): no recentering; only the foot that steps on 6 (the leader's
// left foot) moves, straight to its position; the right foot stays exactly where it was
const jumpy = [[1, 1], [1.5, 2], [2, 6], [2.5, 7], [3, 8]];
const mid = frame(jumpy, 1.75);
near(mid.leader.R.y, -1.25);                            // right foot stays at the very back
assert.equal(mid.leader.R.lift, 0);
assert.ok(mid.leader.L.lift > 0.9);                     // left foot on its way ...
assert.ok(mid.leader.L.y > -0.3 && mid.leader.L.y < 1.25);
near(frame(jumpy, 1.999999).leader.L.y, frame(jumpy, 2).leader.L.y);
near(frame(jumpy, 2).leader.L.y, 1.25);                 // ... and on the pose of 6 at its beat
near(frame(jumpy, 2).leader.R.y, -1.25);                // the right foot has not been touched
// the next step (6 -> 7) then moves the right foot from where it really is
assert.ok(frame(jumpy, 2.25).leader.R.lift > 0.9);
near(frame(jumpy, 2.5).leader.R.y, 0.3);
// an expected pair still takes the whole interval (1 -> 2 from t = 1)
assert.ok(frame(jumpy, 1.2).phase < 1);
near(frame(jumpy, 1.5).leader.R.y, -1.25);

// a long gap in the annotation: nothing moves during it, the stepping foot only moves right before its beat
const gapBeats = [[1, 1], [10, 2]];
near(frame(gapBeats, 5).leader.L.y, -0.3);              // left foot where it stepped on 1
near(frame(gapBeats, 5).leader.R.y, 0);                 // right foot still centered
assert.equal(frame(gapBeats, 5).leader.R.lift, 0);
assert.ok(frame(gapBeats, 9.85).leader.R.lift > 0.9);   // right foot steps in the last 0.35 s
near(frame(gapBeats, 9.999999999).leader.R.y, frame(gapBeats, 10).leader.R.y);
near(frame(gapBeats, 10).leader.R.y, -1.25);

// never two feet moving at once, for either dancer: steady dancing, a jump in the labels, a long gap
for (const seq of [beats, jumpy, gapBeats]) {
  const end = seq[seq.length - 1][0] + 0.3;
  for (let time = 0; time < end; time += 0.01) {
    const f = frame(seq, time);
    for (const role of ["leader", "follower"]) {
      const moving = ["L", "R"].filter((foot) => f[role][foot].lift > 1e-6);
      assert.ok(moving.length <= 1, `${role} moves both feet at t=${time.toFixed(2)}`);
    }
  }
}

console.log("dance.js: all checks passed");
