const fs = require("fs");
eval(fs.readFileSync("./engine.js", "utf8"));
const { prescribe } = globalThis.PushEngine;

function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exitCode = 1;
  } else {
    console.log("ok:", msg);
  }
}

function show(label, plan) {
  console.log("\n==", label, "==");
  console.log(plan.lead);
  console.log(plan.shareText);
  console.log("clock", Math.round(plan.seconds / 60), "min / asked", plan.minutes);
  plan.slots.forEach((s) => {
    console.log(
      (s.role === "primary" ? "P" : "s") + (s.easy ? "*" : ""),
      s.name,
      s.sets + "x",
      "rest", s.rest,
      "rir", s.targetRir,
      "est", s.estReps,
      s.perSide ? "each side" : ""
    );
  });
}

const now = Date.parse("2026-11-18T18:00:00-08:00");
const p20 = prescribe(20, [], now);
show("20 blank", p20);
assert(p20.slots.some((s) => s.id === "pushup"), "20 includes push");
assert(p20.slots.some((s) => s.id === "row"), "20 includes row");
assert(p20.slots.some((s) => s.id === "raise"), "20 includes laterals");
assert(p20.slots.some((s) => s.id === "fly"), "20 includes reverse fly");
assert(p20.seconds <= 20 * 60 + 25, "20 fits the clock");
assert(p20.primarySets / p20.totalSets >= 0.5, "20 primary share " + p20.primarySets + "/" + p20.totalSets);
assert(p20.slots.length <= 4, "20 not a circus");
assert(p20.slots[0].rest >= 90, "20 main rest is real");

const p10 = prescribe(10, [], now);
show("10 blank", p10);
assert(p10.slots.length <= 2, "10 is two exercises");
assert(p10.slots.some((s) => s.id === "pushup"), "10 includes push");
assert(p10.seconds <= 10 * 60 + 25, "10 fits");

const p45 = prescribe(45, [], now);
show("45 blank", p45);
assert(p45.slots.length >= 4, "45 has a full list");
assert(p45.seconds <= 45 * 60 + 30, "45 fits");
assert(!p45.slots.some((s) => s.id === "split" || s.id === "rdl"), "45 day one skips light legs");

const p60 = prescribe(60, [], now);
show("60 blank", p60);
assert(p60.seconds <= 60 * 60 + 30, "60 fits");

const recent = [{
  id: "a",
  ts: now - 2 * 3600 * 1000,
  minutesPlanned: 20,
  minutesActual: 20,
  slots: [
    { id: "pushup", variation: "standard", sets: 4, reps: 40, rir: 2, perSide: false, tempo: 3, easy: false },
    { id: "row", sets: 3, reps: 30, rir: 2, perSide: true, tempo: 4 }
  ]
}];
const pRec = prescribe(20, recent, now);
show("2h after hard push", pRec);
assert(!pRec.slots.some((s) => s.id === "pushup" && !s.easy), "no hard push while recovering");

const adv = [1, 2].map((i) => ({
  id: "b" + i,
  ts: now - (4 - i) * 864e5,
  minutesPlanned: 20,
  minutesActual: 20,
  slots: [{ id: "pushup", variation: "standard", sets: 3, reps: 48, rir: 2, perSide: false, tempo: 3 }]
}));
const pAdv = prescribe(20, adv, now);
show("advance", pAdv);
assert(pAdv.slots.find((s) => s.id === "pushup").variation === "decline", "advances to decline");

const stall = [14, 12, 10].map((avg, i) => ({
  id: "c" + i,
  ts: now - (6 - i) * 864e5,
  minutesPlanned: 20,
  minutesActual: 20,
  slots: [{ id: "pushup", variation: "standard", sets: 3, reps: avg * 3, rir: 1, perSide: false, tempo: 3 }]
}));
const pStall = prescribe(20, stall, now);
show("stall", pStall);
const stallPush = pStall.slots.find((s) => s.id === "pushup" && !s.easy);
assert(stallPush && stallPush.targetRir === 4 && stallPush.sets <= 2, "stall backs off push");

const reg = [{
  id: "d",
  ts: now - 2 * 864e5,
  minutesPlanned: 20,
  minutesActual: 20,
  slots: [{ id: "pushup", variation: "standard", sets: 2, reps: 6, rir: 1, perSide: false, tempo: 3 }]
}];
const pReg = prescribe(20, reg, now);
show("regress", pReg);
assert(pReg.slots.find((s) => s.id === "pushup").variation === "knee", "regresses to knees");

if (process.exitCode) console.error("\nengine checks failed");
else console.log("\nall engine checks passed");
