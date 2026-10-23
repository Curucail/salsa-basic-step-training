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
near(at(0).leader.L.y, -0.4);                       // 1: left foot a bit to the back
near(at(1).leader.R.y, -1.0);                       // 2: right foot to the very back
near(at(2).leader.L.y, at(0).leader.L.y);           // 3: left foot on the same spot as on 1
near(at(4).leader.R.y, 0.4);                        // 5: right foot a bit in front of the center
near(at(5).leader.L.y, 1.0);                        // 6: left foot steps forward
near(at(6).leader.R.y, at(4).leader.R.y);           // 7: right foot on the same spot as on 5
// follower: mirrored (right foot forward on 1)
near(at(0).follower.R.y, 0.4);
near(at(1).follower.L.y, 1.0);
near(at(5).follower.R.y, -1.0);

// feet hold still between counts 3 and 4 (the pause) ...
{
  const a = at(2, 0), b = at(2, 0.9);
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

// before the first beat and after a long gap: standing still, nothing in the air
const idle = frame(beats, 0.2);
assert.equal(idle.count, null);
assert.equal(idle.leader.L.lift, 0);
const gap = frame([[1, 1], [10, 2]], 5);
assert.equal(gap.leader.L.lift, 0);

console.log("dance.js: all checks passed");
