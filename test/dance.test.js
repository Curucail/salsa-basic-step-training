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
assert.ok(lead.leader.L.lift > 0.9);
near(frame(beats, 1.0).leader.L.y, -0.3);


// an unexpected next label (here 2 -> 6): back to both feet centered, then into the position of 6 on its beat
const jumpy = [[1, 1], [1.5, 2], [2, 6], [2.5, 7], [3, 8]];
const centered = frame(jumpy, 1.7);                     // 0.2 s after the beat (40% of the 0.5 s interval)
for (const role of ["leader", "follower"]) {
  near(centered[role].L.y, 0); near(centered[role].R.y, 0);
  near(centered[role].L.x, -0.5); near(centered[role].R.x, 0.5);
}
assert.ok(frame(jumpy, 1.55).leader.L.lift > 0);        // on its way right after the beat
assert.ok(frame(jumpy, 1.85).leader.L.lift > 0);        // and moving into the new position
near(frame(jumpy, 1.999999).leader.L.y, frame(jumpy, 2).leader.L.y);
near(frame(jumpy, 2).leader.L.y, 1.25);                 // pose of 6
// an expected pair still takes the whole interval (1 -> 2 from t = 1)
assert.ok(frame(jumpy, 1.2).phase < 1);
near(frame(jumpy, 1.5).leader.R.y, -1.25);

// a long gap in the annotation: centered while it lasts, no jump on the next beat
const gapBeats = [[1, 1], [10, 2]];
for (const role of ["leader", "follower"]) {
  near(frame(gapBeats, 5)[role].L.y, 0); near(frame(gapBeats, 5)[role].R.y, 0);
}
assert.ok(frame(gapBeats, 5).leader.R.lift < 1e-9);
near(frame(gapBeats, 9.999999999).leader.R.y, frame(gapBeats, 10).leader.R.y);

console.log("dance.js: all checks passed");
