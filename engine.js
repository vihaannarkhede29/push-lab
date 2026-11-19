/* Push Lab dosing model.
   60% of hard sets go to the muscles furthest under a weekly hypertrophy
   dose and recovered enough to train. The other 40% cover the next muscles.
   Rest is booked separately: more minutes lengthen rest before they add junk sets.
   Load choices assume push-ups plus a pair of 10 lb dumbbells. */
(function (root) {
  var PRIMARY_SHARE = 0.6;
  var TARGETS = { push: 12, pull: 10, side: 8, rear: 6, biceps: 6, triceps: 4, legs: 6 };
  var MUSCLES = ["push", "pull", "side", "rear", "biceps", "triceps", "legs"];
  var TIE = { push: 7, pull: 6, side: 5, rear: 4, biceps: 3, triceps: 2, legs: 1 };
  var MUSCLE_EX = {
    push: "pushup", pull: "row", side: "raise", rear: "fly",
    biceps: "curl", triceps: "tri", legs: "split"
  };
  var SHORT = {
    pushup: "push-ups", row: "rows", raise: "lateral raises", fly: "reverse flies",
    curl: "curls", tri: "overhead extensions", split: "split squats", rdl: "single-leg hinges"
  };
  var VARIATION_DEFAULT = { knee: 12, standard: 8, decline: 7, archer: 4, lean: 5 };

  var LADDER = [
    { id: "knee", name: "Knee push-up", factor: 0.49, advanceAvg: 15,
      cue: "Knees down, body straight from knees to head. Two seconds down." },
    { id: "standard", name: "Push-up", factor: 0.64, advanceAvg: 16,
      cue: "Hands under your shoulders, body straight, chest two inches from the floor. Two seconds down." },
    { id: "decline", name: "Feet-elevated push-up", factor: 0.74, advanceAvg: 12,
      cue: "Feet on a couch or a steady chair. Hips don't sag. Two seconds down." },
    { id: "archer", name: "Archer push-up", factor: 0.8, advanceAvg: 6,
      cue: "Bend one arm and let the other stay almost straight as it slides out. Switch sides each set. Two seconds down." },
    { id: "lean", name: "Lean push-up", factor: 0.86, advanceAvg: null,
      cue: "Hands by your ribs, shoulders in front of your hands the whole time. Short range, much harder. Two seconds down." }
  ];

  var EX = {
    pushup: {
      name: "Push-up", equipment: "Body weight", muscle: "push",
      muscles: { push: 1, triceps: 0.25 }, kind: "compound", tempo: 3, defaultReps: 8, perSide: false,
      cue: LADDER[1].cue
    },
    row: {
      name: "Single-arm row", equipment: "10 lb dumbbell", muscle: "pull",
      muscles: { pull: 1, biceps: 0.35 }, kind: "compound", tempo: 4, defaultReps: 12, perSide: true, repCap: 20,
      cue: "One dumbbell. Chest on a bed, or hinge at the hips. Elbow to your hip, two seconds down, pause one second. Both sides, then rest."
    },
    raise: {
      name: "Lateral raise", equipment: "10 lb each hand", muscle: "side",
      muscles: { side: 1 }, kind: "isolation", tempo: 3, defaultReps: 12, perSide: false, repCap: 18,
      cue: "Soft elbows. Lift to shoulder height. Two seconds down. Stop with 1 rep left, even if you pass 15."
    },
    fly: {
      name: "Reverse fly", equipment: "10 lb each hand", muscle: "rear",
      muscles: { rear: 1, pull: 0.2 }, kind: "isolation", tempo: 3, defaultReps: 12, perSide: false, repCap: 18,
      cue: "Hinge until your back is nearly flat. Lift your arms out and squeeze between the shoulder blades. Don't swing."
    },
    curl: {
      name: "Curl", equipment: "10 lb each hand", muscle: "biceps",
      muscles: { biceps: 1 }, kind: "isolation", tempo: 3, defaultReps: 12, perSide: false, repCap: 16,
      cue: "Elbows still. Full stretch at the bottom. No hip swing. Two seconds down."
    },
    tri: {
      name: "Overhead triceps extension", equipment: "10 lb, one arm", muscle: "triceps",
      muscles: { triceps: 1 }, kind: "isolation", tempo: 3, defaultReps: 12, perSide: true, repCap: 16,
      cue: "One dumbbell, one arm. Upper arm beside your ear. Bend only the elbow. Both sides, then rest."
    },
    split: {
      name: "Split squat", equipment: "10 lb each hand", muscle: "legs",
      muscles: { legs: 1 }, kind: "compound", tempo: 4, defaultReps: 8, perSide: true, repCap: 12,
      cue: "Back knee toward the floor. Pause one second. Both legs, then rest. 10 lb counts only if the last reps are slow."
    },
    rdl: {
      name: "Single-leg hinge", equipment: "10 lb dumbbell", muscle: "legs",
      muscles: { legs: 1 }, kind: "compound", tempo: 4, defaultReps: 8, perSide: true, repCap: 12,
      cue: "Hold 10 lb in the hand opposite the standing leg. Soft knee, hips back until the hamstring stretches. Both sides, then rest."
    }
  };

  var SCIENCE = [
    {
      title: "What actually grows muscle here",
      body: "A hard set is the dose. Stop with about 0–3 reps still possible in clean form. With 10 lb dumbbells this matters more, because a light weight does very little until the reps get slow. Heavier and lighter loads grow similar muscle when the set is actually hard; heavy loads are better for pure strength. Push-up strength specifically comes from a harder variation, not from grinding 40 sloppy reps."
    },
    {
      title: "Why these exercises",
      body: "A normal push-up puts about two-thirds of your body weight through your hands, and a knee push-up about half. Two 10 lb dumbbells are not a chest workout next to that, so there is no dumbbell floor press in this plan. 10 lb is a real weight for lateral raises, reverse flies, curls, and one-arm overhead extensions if you take them near failure. Rows stay in even though 10 lb is light: slow lowering, a pause, and both arms. Pressing without pulling is how shoulders get cranky and push-ups stall. Overhead extensions are here for the triceps long head, which push-ups mostly miss."
    },
    {
      title: "How today is chosen",
      body: "Each muscle has a weekly target near the low end of a productive hypertrophy dose, about 10 hard sets, a bit less for small muscles. The last 7 days are what count. About 60% of today's hard sets go to whatever is furthest under that target and not trained hard in the last 18 hours. About 40% cover the next muscles. Extra minutes raise rest toward 3 minutes on the main exercise before they add another set. Past a point, more sets mostly add fatigue."
    },
    {
      title: "How you progress with a fixed 10 lb",
      body: "Beat your reps per set, or match them with a rep left in the tank. When a dumbbell move gets easy for two sessions, slow the lowering instead of inventing a heavier weight you don't have. Push-ups move up the ladder after two strong sessions: knees, regular, feet up, archer, then a leaned push-up. Fewer reps on the harder version is the goal. If reps fall while you are already near failure, the next session backs off. That is fatigue, and training through it is how people get worse."
    },
    {
      title: "Limits",
      body: "This is a training model, not medical advice. Muscle burn is the target. Sharp joint pain means stop that exercise. 10 lb will not load your legs like a barbell. Leg sets are only used when you have time and your upper body is already getting its dose, and only if the last reps are slow. Studies behind the rules: Ebben 2011 on push-up load, Calatayud 2015 on push-ups versus bench press, Schoenfeld, Ogborn, and Krieger 2017 on weekly volume, Schoenfeld, Grgic, Ogborn, and Krieger 2017 plus Morton 2016 on light loads taken hard, and Schoenfeld 2016 on longer rest."
    }
  ];

  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
  function mean(xs) {
    if (!xs.length) return 0;
    return xs.reduce(function (s, n) { return s + n; }, 0) / xs.length;
  }
  function round1(n) {
    var x = Math.round(n * 10) / 10;
    return Number.isInteger(x) ? String(x) : x.toFixed(1);
  }
  function fmtSets(n) { return round1(n); }
  function dayKey(ts) {
    var d = new Date(ts);
    return d.getFullYear() + "-" + d.getMonth() + "-" + d.getDate();
  }
  function formatRest(sec) {
    if (sec % 60 === 0) return (sec / 60) + " min";
    if (sec % 30 === 0) return (sec / 60).toFixed(1) + " min";
    return sec + "s";
  }
  function hoursPhrase(h) {
    if (h < 1) return "less than an hour";
    var r = Math.round(h);
    if (r <= 1) return "about an hour";
    return r + " hours";
  }
  function setCredit(sets, rir) {
    var r = Number(rir);
    var f = r <= 2 ? 1 : r === 3 ? 0.8 : r === 4 ? 0.45 : 0.2;
    return (Number(sets) || 0) * f;
  }
  function blankCredit() {
    var o = {};
    MUSCLES.forEach(function (m) { o[m] = 0; });
    return o;
  }
  function sessionMuscleCredit(session) {
    var acc = blankCredit();
    (session.slots || []).forEach(function (sl) {
      var ex = EX[sl.id];
      if (!ex) return;
      var w = setCredit(sl.sets, sl.rir);
      Object.keys(ex.muscles).forEach(function (m) { acc[m] += w * ex.muscles[m]; });
    });
    return acc;
  }
  function collectLogs(id, list, variation) {
    var out = [];
    list.forEach(function (session) {
      (session.slots || []).forEach(function (sl) {
        if (sl.id !== id) return;
        if (variation && sl.variation !== variation) return;
        out.push(sl);
      });
    });
    return out;
  }
  function pushLogs(list) {
    var out = [];
    list.forEach(function (session) {
      (session.slots || []).forEach(function (sl) {
        if (sl.id === "pushup" && !sl.easy) out.push(sl);
      });
    });
    return out;
  }
  function lastExercise(list, ids) {
    for (var i = list.length - 1; i >= 0; i--) {
      var slots = list[i].slots || [];
      for (var j = 0; j < slots.length; j++) {
        if (ids.indexOf(slots[j].id) !== -1) return slots[j].id;
      }
    }
    return null;
  }
  function pushPlan(list) {
    var logs = pushLogs(list);
    if (!logs.length) {
      return {
        id: "standard", step: null,
        note: "If the first set is under 6 clean reps, switch this to knee push-ups before you save."
      };
    }
    var last = logs[logs.length - 1];
    var idx = -1;
    for (var i = 0; i < LADDER.length; i++) if (LADDER[i].id === last.variation) idx = i;
    if (idx < 0) idx = 1;
    var lastAvg = last.reps / last.sets;
    if (lastAvg <= 4 && last.rir <= 1 && idx > 0) {
      return {
        id: LADDER[idx - 1].id, step: "down",
        note: "Last time fell apart near failure. One easier variation today, then build back up."
      };
    }
    var prev = logs.length >= 2 ? logs[logs.length - 2] : null;
    var cur = LADDER[idx];
    var ready = cur.advanceAvg != null && prev && prev.variation === last.variation &&
      last.rir <= 2 && prev.rir <= 2 && lastAvg >= cur.advanceAvg &&
      (prev.reps / prev.sets) >= cur.advanceAvg && idx < LADDER.length - 1;
    if (ready) {
      return {
        id: LADDER[idx + 1].id, step: "up",
        note: "Two strong sessions on this variation. Fewer reps today is the point, not a step backward."
      };
    }
    var oneAway = cur.advanceAvg != null && last.variation === cur.id && lastAvg >= cur.advanceAvg &&
      last.rir <= 2 && idx < LADDER.length - 1;
    var note;
    if (cur.id === "lean" && lastAvg >= 10) {
      note = "Hardest push-up on the ladder. Add a one-second pause at the bottom.";
    } else if (oneAway) {
      note = "You topped this variation once. Match it today and the next workout moves up.";
    } else {
      note = "Last time was " + round1(lastAvg) + " reps per set. Match that or add one.";
    }
    return { id: cur.id, step: null, note: note };
  }
  function detectPushStall(list) {
    var logs = pushLogs(list);
    if (logs.length < 3) return false;
    var last3 = logs.slice(-3);
    if (!last3.every(function (l) { return l.variation === last3[0].variation; })) return false;
    var avgs = last3.map(function (l) { return l.reps / l.sets; });
    return last3.every(function (l) { return l.rir <= 2; }) && avgs[2] < avgs[0] - 1.5 && avgs[2] <= avgs[1];
  }
  function tempoState(id, list) {
    var ex = EX[id];
    if (!ex.repCap) return false;
    var logs = collectLogs(id, list);
    if (!logs.length) return false;
    var last = logs[logs.length - 1];
    var avg = last.reps / last.sets;
    if (last.slow && avg >= ex.repCap - 5) return true;
    var last2 = logs.slice(-2);
    return last2.length === 2 && last2.every(function (l) {
      return l.reps / l.sets >= ex.repCap && l.rir <= 2;
    });
  }
  function estReps(id, variation, list, step) {
    var ex = EX[id];
    var logs = collectLogs(id, list, variation);
    var est;
    if (step === "up" || !logs.length) est = (variation && VARIATION_DEFAULT[variation]) || ex.defaultReps;
    else est = Math.round(logs[logs.length - 1].reps / logs[logs.length - 1].sets);
    return Math.max(3, est);
  }
  function progressNote(id, list, slow) {
    var logs = collectLogs(id, list);
    if (!logs.length) return "Stop with 1 or 2 clean reps left. Write the total below.";
    var avg = logs[logs.length - 1].reps / logs[logs.length - 1].sets;
    if (slow) return "Last time was " + round1(avg) + " reps per set. Keep the slow tempo. Match it or add one.";
    return "Last time was " + round1(avg) + " reps per set. Match it or add one.";
  }
  function buildCandidate(id, model) {
    var ex = EX[id];
    var variationPlan = id === "pushup" ? pushPlan(model.list) : null;
    var variation = variationPlan ? variationPlan.id : null;
    var ladder = null;
    if (variation) {
      for (var i = 0; i < LADDER.length; i++) if (LADDER[i].id === variation) ladder = LADDER[i];
    }
    var slow = id === "pushup" ? false : tempoState(id, model.list);
    var perSide = id === "pushup" ? variation === "archer" : !!ex.perSide;
    return {
      id: id,
      muscle: ex.muscle,
      kind: ex.kind,
      perSide: perSide,
      tempo: ex.tempo + (slow ? 2 : 0),
      est: estReps(id, variation, model.list, variationPlan && variationPlan.step),
      slow: slow,
      variation: variation,
      variationName: ladder ? ladder.name : null,
      name: ladder ? ladder.name : ex.name,
      equipment: ex.equipment,
      cue: (slow ? "Lower for three seconds, then pause. 10 lb has gotten easy at normal speed. " : "") + (ladder ? ladder.cue : ex.cue),
      progress: variationPlan ? variationPlan.note : progressNote(id, model.list, slow),
      step: variationPlan ? variationPlan.step : null
    };
  }
  function exerciseForMuscle(m, model, minutes) {
    if (m === "legs") {
      var allow = minutes >= 35 && (model.upperReady || minutes >= 55);
      if (!allow) return null;
      return lastExercise(model.list, ["split", "rdl"]) === "split" ? "rdl" : "split";
    }
    return MUSCLE_EX[m];
  }
  function buildModel(sessions, now) {
    var list = sessions.slice().sort(function (a, b) { return a.ts - b.ts; });
    var credit = blankCredit();
    var windowStart = now - 7 * 24 * 3600 * 1000;
    list.forEach(function (session) {
      if (session.ts < windowStart) return;
      var c = sessionMuscleCredit(session);
      MUSCLES.forEach(function (m) { credit[m] += c[m]; });
    });
    var hours = {};
    MUSCLES.forEach(function (m) {
      for (var i = list.length - 1; i >= 0; i--) {
        if (sessionMuscleCredit(list[i])[m] >= 0.8) {
          hours[m] = (now - list[i].ts) / 36e5;
          break;
        }
      }
    });
    var last = list.length ? list[list.length - 1] : null;
    var daysSince = last ? (now - last.ts) / 864e5 : 0;
    var recentHard = false;
    if (last && (now - last.ts) / 36e5 < 14) {
      var hard = (last.slots || []).reduce(function (sum, sl) { return sum + setCredit(sl.sets, sl.rir); }, 0);
      recentHard = hard >= 6;
    }
    var upperReady = credit.push >= 6 && credit.pull >= 5;
    var scores = {};
    MUSCLES.forEach(function (m) {
      var deficit = Math.max(0, TARGETS[m] - credit[m]);
      var score = credit[m] >= TARGETS[m] ? 0.08 : deficit / TARGETS[m];
      if (m === "push") score *= 1.15;
      if (m === "legs") score *= upperReady ? 0.7 : 0.35;
      if (hours[m] != null && hours[m] < 18) score *= 0.28;
      else if (hours[m] != null && hours[m] < 36) score *= 0.75;
      scores[m] = score;
    });
    return {
      list: list,
      credit: credit,
      hours: hours,
      daysSince: daysSince,
      dormant: !!(last && daysSince >= 7),
      recentHard: recentHard,
      pushStall: detectPushStall(list),
      upperReady: upperReady,
      scores: scores
    };
  }
  function rankExercises(model, minutes) {
    var items = [];
    MUSCLES.forEach(function (m) {
      var id = exerciseForMuscle(m, model, minutes);
      if (!id) return;
      var c = buildCandidate(id, model);
      c.muscle = m;
      c.score = model.scores[m];
      c.tie = TIE[m];
      items.push(c);
    });
    items.sort(function (a, b) { return b.score - a.score || b.tie - a.tie; });
    var fresh = items.filter(function (c) {
      var h = model.hours[c.muscle];
      return h == null || h >= 18;
    });
    return fresh.length ? fresh : items;
  }
  function tagRoles(ranked) {
    var best = ranked.length ? ranked[0].score : 1;
    return ranked.map(function (c, i) {
      var copy = {};
      Object.keys(c).forEach(function (k) { copy[k] = c[k]; });
      copy.role = i < 2 && (i === 0 || c.score >= best * 0.72) ? "primary" : "support";
      return copy;
    });
  }
  function restPolicy(min) {
    if (min >= 45) return { main: 150, compound: 105, iso: 70, warmup: 180 };
    if (min >= 30) return { main: 120, compound: 90, iso: 60, warmup: 150 };
    if (min >= 18) return { main: 90, compound: 75, iso: 55, warmup: 90 };
    if (min >= 12) return { main: 75, compound: 60, iso: 45, warmup: 60 };
    return { main: 60, compound: 50, iso: 40, warmup: 0 };
  }
  function qualityCaps(min, model) {
    var mainMax = min >= 45 ? 4 : min >= 15 ? 3 : 2;
    var otherMax = min >= 30 ? 3 : 2;
    var isoMax = min >= 28 ? 3 : 2;
    var maxExercises = min < 12 ? 2 : min < 18 ? 3 : min < 30 ? 4 : 5;
    var minSets = min < 10 ? 1 : 2;
    var maxTotal = min >= 50 ? 16 : 14;
    if (model.recentHard || model.dormant) {
      mainMax = Math.min(mainMax, 2);
      otherMax = Math.min(otherMax, 2);
      isoMax = Math.min(isoMax, 2);
      maxExercises = Math.min(maxExercises, 3);
    }
    if (model.pushStall) mainMax = Math.min(mainMax, 2);
    return { mainMax: mainMax, otherMax: otherMax, isoMax: isoMax, maxExercises: maxExercises, minSets: minSets, maxTotal: maxTotal };
  }
  function targetRir(id, est, kind, stall, easy) {
    if (easy || (id === "pushup" && stall)) return 4;
    if (id === "pushup" && est >= 18) return 1;
    if (kind === "isolation") return 1;
    return 2;
  }
  function makeSlot(cand, sets, policy, model, lead) {
    var easy = !!cand.easy;
    var est = easy ? Math.max(4, Math.round(cand.est * 0.7)) : cand.est;
    var rest = policy.iso;
    if (lead && !easy) rest = policy.main;
    else if (cand.kind === "compound") rest = policy.compound;
    if (easy) rest = Math.min(rest, 60);
    var slot = {};
    Object.keys(cand).forEach(function (k) { slot[k] = cand[k]; });
    slot.sets = sets;
    slot.rest = rest;
    slot.estReps = est;
    slot.targetRir = targetRir(cand.id, est, cand.kind, model.pushStall, easy);
    slot.easy = easy;
    slot.lead = !!lead && !easy;
    slot.role = cand.role || "support";
    slot.progress = easy ? "Stop early. These keep the pattern sharp. They are not the growth sets." : cand.progress;
    return slot;
  }
  function slotSeconds(slot) {
    var sides = slot.perSide ? 2 : 1;
    return slot.sets * sides * slot.estReps * slot.tempo + Math.max(0, slot.sets - 1) * slot.rest;
  }
  function planSeconds(slots, warmup) {
    var sec = warmup || 0;
    slots.forEach(function (s, i) {
      sec += slotSeconds(s);
      if (i < slots.length - 1) sec += 20;
    });
    return sec;
  }
  function splitTime(slots, warmup) {
    var work = 0, rest = 0;
    slots.forEach(function (s, i) {
      var sides = s.perSide ? 2 : 1;
      work += s.sets * sides * s.estReps * s.tempo;
      rest += Math.max(0, s.sets - 1) * s.rest;
      if (i < slots.length - 1) rest += 20;
    });
    return { warmup: warmup || 0, work: work, rest: rest };
  }
  function sumSets(slots) {
    return slots.reduce(function (s, sl) { return s + sl.sets; }, 0);
  }
  function maxSets(slot, caps) {
    if (slot.easy) return slot.sets;
    if (slot.lead) return caps.mainMax;
    if (slot.kind === "compound") return caps.otherMax;
    return caps.isoMax;
  }
  function tryAdd(slots, cand, sets, policy, model, budget) {
    for (var n = sets; n >= 1; n--) {
      var slot = makeSlot(cand, n, policy, model, slots.length === 0);
      var trial = slots.concat([slot]);
      if (planSeconds(trial, policy.warmup) <= budget + 20) return trial;
    }
    return null;
  }
  function grow(slots, opts) {
    var budget = opts.budget, warmup = opts.warmup, caps = opts.caps, mode = opts.mode, target = opts.target;
    for (var n = 0; n < 24; n++) {
      var counted = slots.filter(function (s) { return !s.easy; });
      var total = sumSets(counted);
      var primary = sumSets(counted.filter(function (s) { return s.role === "primary"; }));
      if (mode === "primary" && primary >= target) break;
      if (mode === "any" && total >= target) break;
      if (total >= caps.maxTotal) break;
      var best = -1, bestScore = -Infinity;
      for (var i = 0; i < slots.length; i++) {
        var s = slots[i];
        if (s.easy) continue;
        if (mode === "primary" && s.role !== "primary") continue;
        if (s.sets >= maxSets(s, caps)) continue;
        var trial = slots.map(function (x, ix) { return ix === i ? Object.assign({}, x, { sets: x.sets + 1 }) : x; });
        if (planSeconds(trial, warmup) > budget + 15) continue;
        var newPrimary = primary + (s.role === "primary" ? 1 : 0);
        var ratio = newPrimary / (total + 1);
        if (mode === "any" && s.role !== "primary" && primary > 0 && ratio < 0.55) continue;
        var score = s.score || 0;
        if (ratio < 0.6 && s.role === "primary") score += 3;
        else if (s.role === "primary") score += 0.3;
        if (ratio > 0.75 && s.role !== "primary") score += 0.6;
        if (score > bestScore) { bestScore = score; best = i; }
      }
      if (best < 0) break;
      slots[best] = Object.assign({}, slots[best], { sets: slots[best].sets + 1 });
    }
  }
  function maybeEasyPush(slots, policy, caps, model, budget, minutes) {
    var h = model.hours.push;
    if (h == null || h >= 18 || minutes < 18 || model.pushStall || model.recentHard) return slots;
    if (slots.some(function (s) { return s.id === "pushup"; })) return slots;
    if (slots.length >= caps.maxExercises) return slots;
    var cand = buildCandidate("pushup", model);
    cand.role = "support";
    cand.easy = true;
    cand.score = 0.2;
    return tryAdd(slots, cand, 2, policy, model, budget) || slots;
  }
function padCap(slot, minutes) {
  if (slot.kind === "isolation") return minutes >= 30 ? 90 : 70;
  if (minutes >= 30) return 180;
  if (minutes >= 18) return 150;
  return 120;
}
function padRest(slots, budget, warmup, minutes) {
  var guard = 0;
  while (guard++ < 40) {
    var left = budget - planSeconds(slots, warmup);
    if (left < 35) break;
    var bumped = false;
    for (var i = 0; i < slots.length; i++) {
      var s = slots[i];
      if (s.sets < 2 || s.rest + 15 > padCap(s, minutes)) continue;
      var add = 15 * (s.sets - 1);
      if (add <= left + 5) {
        slots[i] = Object.assign({}, s, { rest: s.rest + 15 });
        bumped = true;
        break;
      }
    }
    if (!bumped) break;
  }
}
function primaryShare(slots, extra) {
  var counted = slots.filter(function (s) { return !s.easy; });
  var primary = sumSets(counted.filter(function (s) { return s.role === "primary"; }));
  var total = sumSets(counted) + (extra || 0);
  if (!total) return 1;
  return primary / total;
}
function forceSlot(slots, cand, sets, policy, model, budget, maxExercises) {
  var protect = { row: true };
  var next = slots.slice();
  if (next.length >= maxExercises) {
    for (var i = next.length - 1; i >= 0; i--) {
      if (!protect[next[i].id]) {
        next.splice(i, 1);
        break;
      }
    }
  }
  var guard = 0;
  while (guard++ < 12) {
    var added = tryAdd(next, cand, sets, policy, model, budget);
    if (added) return added;
    var cut = -1;
    for (var j = next.length - 1; j >= 0; j--) {
      if (protect[next[j].id]) continue;
      cut = j;
      break;
    }
    if (cut < 0) return null;
    if (next[cut].sets > 1) next[cut] = Object.assign({}, next[cut], { sets: next[cut].sets - 1 });
    else next.splice(cut, 1);
  }
  return null;
}
function ensurePush(slots, policy, caps, model, budget, minutes) {
  if (minutes < 10) return slots;
  if (model.hours.push != null && model.hours.push < 18) return slots;
  if (model.credit.push >= TARGETS.push + 2) return slots;
  if (slots.some(function (s) { return s.id === "pushup" && !s.easy; })) return slots;
  var cand = buildCandidate("pushup", model);
  cand.score = model.scores.push;
  cand.role = "support";
  var sets = Math.min(2, caps.mainMax);
  var added = forceSlot(slots, cand, sets, policy, model, budget, caps.maxExercises);
  if (!added) return slots;
  var idx = -1;
  for (var i = 0; i < added.length; i++) if (added[i].id === "pushup" && !added[i].easy) idx = i;
  if (idx > 1) {
    var slot = added.splice(idx, 1)[0];
    added.splice(1, 0, slot);
  }
  return added;
}
function maybeLegs(slots, policy, model, budget, minutes) {
  if (minutes < 55) return slots;
  if (slots.some(function (s) { return s.id === "split" || s.id === "rdl"; })) return slots;
  if (slots.length >= 6) return slots;
  var id = lastExercise(model.list, ["split", "rdl"]) === "split" ? "rdl" : "split";
  var cand = buildCandidate(id, model);
  cand.muscle = "legs";
  cand.role = "support";
  cand.score = model.scores.legs || 0.2;
  return tryAdd(slots, cand, 2, policy, model, budget) || slots;
}
  function annotate(slots, model) {
    slots.forEach(function (s) {
      if (s.easy) {
        s.why = "Practice only. Leave about 4 reps so the hard work you already did can still build muscle.";
        return;
      }
      var credit = model.credit[s.muscle] || 0;
      var target = TARGETS[s.muscle];
      var dose = fmtSets(credit) + " of " + target;
      if (s.muscle === "side") s.why = dose + " side-delt sets in 7 days. Push-ups barely touch them. 10 lb is enough if the last reps slow down.";
      else if (s.muscle === "rear") s.why = dose + " rear-delt sets in 7 days. This is what keeps your shoulders able to take more push-ups.";
      else if (s.muscle === "pull") s.why = dose + " pulling sets in 7 days. Pressing without rows is how push-ups stall.";
      else if (s.muscle === "push") s.why = dose + " push sets in 7 days. This is the main growth work.";
      else if (s.muscle === "triceps") s.why = "This hits the triceps long head, which push-ups mostly miss. " + dose + " direct triceps sets in 7 days.";
      else if (s.muscle === "biceps") s.why = dose + " direct biceps sets in 7 days. Rows help. Curls finish the dose.";
      else if (s.muscle === "legs") s.why = "10 lb is light for legs. Count the set only if the last reps are slow.";
      else s.why = dose + " sets in the last 7 days.";
    });
  }
  function joinShort(ids) {
    var names = ids.map(function (id) { return SHORT[id] || id; });
    if (names.length <= 1) return [names[0] || "this work", "is"];
    if (names.length === 2) return [names[0] + " and " + names[1], "are"];
    return [names.slice(0, -1).join(", ") + " and " + names[names.length - 1], "are"];
  }
function leadSentence(slots, model, minutes, seconds) {
  var core;
  if (model.pushStall) {
    core = "Push-up reps are dropping even though you are already near failure. Today is easier on purpose so the next hard session can move.";
  } else if (model.recentHard) {
    core = "You already trained hard in the last 14 hours. This one stays short so that session can still turn into muscle.";
  } else if (model.dormant) {
    core = "It's been " + Math.max(7, Math.floor(model.daysSince)) + " days. Today's dose is smaller so you come back sore, not wiped out.";
  } else if (model.hours.push != null && model.hours.push < 18 && !slots.some(function (s) { return s.id === "pushup" && !s.easy; })) {
    core = "Push-ups were " + hoursPhrase(model.hours.push) + " ago. They grow while you rest them, so today trains what is fresh.";
  } else if (model.credit.push >= model.credit.pull + 4 && slots.some(function (s) { return s.id === "row"; })) {
    core = "Pulling is behind pressing this week (" + fmtSets(model.credit.pull) + " vs " + fmtSets(model.credit.push) + " hard sets). Rows stay in so your shoulders survive more push-ups.";
  } else if (minutes <= 12) {
    core = minutes + " minutes fits two exercises taken near failure. A longer list would make every set sloppy.";
  } else if (!model.list.length) {
    core = "First session: hard push-ups, rows to match them, then the dumbbell moves where 10 lb is actually heavy enough.";
  } else {
    var ids = [];
    slots.forEach(function (s) {
      if (s.role === "primary" && !s.easy && ids.indexOf(s.id) === -1) ids.push(s.id);
    });
    var pair = joinShort(ids);
    var head = pair[0].charAt(0).toUpperCase() + pair[0].slice(1);
    core = head + " " + pair[1] + " the priority. " + (pair[1] === "are" ? "They're" : "It's") + " the furthest under this week's dose and recovered enough to train hard.";
  }
  var planned = Math.round(seconds / 60);
  if (minutes - planned >= 6) {
    core += " Stop after about " + planned + " min. More sets today would add fatigue faster than muscle.";
  }
  return core;
}
  function warmupText(sec) {
    if (sec <= 0) return "No separate warm-up. Do 5 easy reps of the first exercise, then start the real sets.";
    var m = Math.max(1, Math.round(sec / 60));
    return m + " min warm-up, not counted as sets: arm circles, 8 easy push-ups, 8 slow squats.";
  }
  function prescribe(minutes, sessions, now) {
    var requested = clamp(Math.round(Number(minutes) || 20), 5, 90);
    var budget = requested * 60;
    var at = now || Date.now();
    var model = buildModel(sessions || [], at);
    var policy = restPolicy(requested);
    var caps = qualityCaps(requested, model);
    var tagged = tagRoles(rankExercises(model, requested));
    var roughSets = Math.max(caps.minSets, Math.round((budget - policy.warmup) / (28 + policy.main)));
    var setBudget = Math.min(caps.maxTotal, Math.max(caps.minSets, roughSets));
    var primaryTarget = Math.max(caps.minSets, Math.round(setBudget * PRIMARY_SHARE));
    var slots = [];
    tagged.filter(function (t) { return t.role === "primary"; }).slice(0, 2).forEach(function (p) {
      if (slots.length >= caps.maxExercises) return;
      var added = tryAdd(slots, p, caps.minSets, policy, model, budget);
      if (added) slots = added;
    });
    if (!slots.length && tagged[0]) slots = [makeSlot(tagged[0], 1, policy, model, true)];
    grow(slots, { budget: budget, warmup: policy.warmup, caps: caps, mode: "primary", target: primaryTarget });
    tagged.filter(function (t) { return t.role === "support"; }).forEach(function (s) {
      if (slots.length >= caps.maxExercises) return;
      if (sumSets(slots) >= setBudget && slots.length >= 2) return;
      var mustRow = s.id === "row" && slots.some(function (p) { return p.id === "pushup"; }) && !slots.some(function (p) { return p.id === "row"; });
      var mustFly = s.id === "fly" && requested >= 18 && slots.some(function (p) { return p.id === "pushup" && !p.easy; }) && !slots.some(function (p) { return p.id === "fly"; });
      if (!mustRow && !mustFly && slots.length >= 3 && primaryShare(slots, caps.minSets) < 0.55) return;
      var added = tryAdd(slots, s, caps.minSets, policy, model, budget);
      if (added) slots = added;
    });
    grow(slots, { budget: budget, warmup: policy.warmup, caps: caps, mode: "any", target: setBudget });
    slots = ensurePush(slots, policy, caps, model, budget, requested);
    slots = maybeEasyPush(slots, policy, caps, model, budget, requested);
    slots = maybeLegs(slots, policy, model, budget, requested);
    padRest(slots, budget, policy.warmup, requested);
    annotate(slots, model);
    var seconds = planSeconds(slots, policy.warmup);
    var counted = slots.filter(function (s) { return !s.easy; });
    var primarySets = sumSets(counted.filter(function (s) { return s.role === "primary"; }));
    var totalSets = sumSets(counted);
    var pct = totalSets ? Math.round(100 * primarySets / totalSets) : 0;
    var shareText = "";
    if (totalSets && primarySets === totalSets) {
      shareText = "All " + totalSets + " hard sets are the main work. Rest takes the rest of the clock.";
    } else if (totalSets) {
      shareText = primarySets + " of " + totalSets + " hard sets (" + pct + "%) are the priority. The rest covers the next muscles.";
    }
    return {
      minutes: requested,
      seconds: seconds,
      warmup: policy.warmup,
      warmupText: warmupText(policy.warmup),
      slots: slots,
      lead: leadSentence(slots, model, requested, seconds),
      shareText: shareText,
      primarySets: primarySets,
      totalSets: totalSets,
      parts: splitTime(slots, policy.warmup),
      credit: model.credit,
      targets: TARGETS
    };
  }
  function streak(sessions, now) {
    var days = {};
    sessions.forEach(function (s) { days[dayKey(s.ts)] = true; });
    var cursor = new Date(now);
    if (!days[dayKey(cursor.getTime())]) {
      cursor.setDate(cursor.getDate() - 1);
      if (!days[dayKey(cursor.getTime())]) return 0;
    }
    var n = 0;
    while (days[dayKey(cursor.getTime())]) {
      n += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    return n;
  }
  function trendLabel(values) {
    if (!values || values.length < 2) return null;
    var recent, prior;
    if (values.length >= 6) {
      recent = mean(values.slice(-3));
      prior = mean(values.slice(-6, -3));
    } else {
      recent = values[values.length - 1];
      prior = values[values.length - 2];
    }
    if (recent > prior + 0.8) return "Up";
    if (recent < prior - 0.8) return "Down";
    return "Flat";
  }
  function overview(sessions, now, bodyweight) {
    var list = (sessions || []).slice().sort(function (a, b) { return a.ts - b.ts; });
    var at = now || Date.now();
    var model = buildModel(list, at);
    var start = at - 7 * 864e5;
    var push = [];
    var pushReps7 = 0;
    list.forEach(function (s) {
      (s.slots || []).forEach(function (sl) {
        if (sl.id !== "pushup") return;
        push.push({ ts: s.ts, avg: sl.reps / sl.sets, variation: sl.variation, reps: sl.reps });
        if (s.ts >= start) pushReps7 += sl.reps;
      });
    });
    var mins = list.map(function (s) { return s.minutesActual; }).filter(function (n) { return n > 0; });
    var plan = pushPlan(list);
    var same = push.filter(function (p) { return p.variation === (push.length ? push[push.length - 1].variation : ""); });
    var tonnage = null;
    var bw = Number(bodyweight);
    if (bw >= 50) {
      tonnage = 0;
      list.forEach(function (s) {
        if (s.ts < start) return;
        (s.slots || []).forEach(function (sl) {
          if (sl.id !== "pushup") return;
          var factor = 0.64;
          for (var i = 0; i < LADDER.length; i++) if (LADDER[i].id === sl.variation) factor = LADDER[i].factor;
          tonnage += sl.reps * bw * factor;
        });
      });
    }
    return {
      workouts: list.length,
      streak: streak(list, at),
      avgMin: mins.length ? mean(mins) : null,
      pushReps7: pushReps7,
      pushSeries: push.slice(-12),
      minuteSeries: list.slice(-12).map(function (s) { return { ts: s.ts, y: s.minutesActual }; }),
      bestPushAvg: push.length ? Math.max.apply(null, push.map(function (p) { return p.avg; })) : null,
      credit: model.credit,
      targets: TARGETS,
      variation: plan,
      trend: trendLabel(same.map(function (p) { return p.avg; })),
      tonnage: tonnage
    };
  }
  function exerciseStats(sessions, now) {
    var at = now || Date.now();
    var start = at - 7 * 864e5;
    var buckets = {};
    Object.keys(EX).forEach(function (id) { buckets[id] = []; });
    (sessions || []).slice().sort(function (a, b) { return a.ts - b.ts; }).forEach(function (session) {
      (session.slots || []).forEach(function (sl) {
        if (!EX[sl.id]) return;
        buckets[sl.id].push({
          reps: sl.reps, sets: sl.sets, rir: sl.rir, perSide: sl.perSide, tempo: sl.tempo,
          variation: sl.variation, ts: session.ts, minutesActual: session.minutesActual
        });
      });
    });
    var out = [];
    Object.keys(EX).forEach(function (id) {
      var rows = buckets[id];
      if (!rows.length) return;
      var avgs = rows.map(function (r) { return r.reps / r.sets; });
      var trendRows = rows;
      if (id === "pushup") {
        var v = rows[rows.length - 1].variation;
        var filtered = rows.filter(function (r) { return r.variation === v; });
        if (filtered.length >= 2) trendRows = filtered;
      }
      out.push({
        id: id,
        name: EX[id].name,
        perSide: !!EX[id].perSide || rows.some(function (r) { return r.perSide; }),
        sessions: rows.length,
        totalReps: rows.reduce(function (s, r) { return s + r.reps; }, 0),
        avgReps: mean(avgs),
        bestAvg: Math.max.apply(null, avgs),
        hardSets7: rows.filter(function (r) { return r.ts >= start; }).reduce(function (s, r) { return s + setCredit(r.sets, r.rir); }, 0),
        avgSessionMin: mean(rows.map(function (r) { return r.minutesActual; }).filter(Boolean)),
        avgWorkMin: mean(rows.map(function (r) {
          var sides = r.perSide ? 2 : 1;
          return r.reps * sides * (r.tempo || EX[id].tempo) / 60;
        })),
        trend: trendLabel(trendRows.map(function (r) { return r.reps / r.sets; })),
        series: rows.slice(-10).map(function (r) { return r.reps / r.sets; }),
        lastTs: rows[rows.length - 1].ts
      });
    });
    return out;
  }
  function sanitizeSession(s) {
    if (!s || typeof s !== "object") return null;
    var ts = Number(s.ts);
    if (!isFinite(ts) || ts < 946684800000 || ts > Date.now() + 864e5) return null;
    if (!Array.isArray(s.slots)) return null;
    var slots = [];
    s.slots.forEach(function (sl) {
      if (!sl || !EX[sl.id]) return;
      var sets = Math.round(Number(sl.sets));
      var reps = Math.round(Number(sl.reps));
      var rir = Math.round(Number(sl.rir));
      if (sets < 1 || sets > 20 || reps < 1 || reps > 500 || rir < 0 || rir > 5) return;
      var variation = null;
      if (sl.id === "pushup") {
        variation = "standard";
        for (var i = 0; i < LADDER.length; i++) if (LADDER[i].id === sl.variation) variation = sl.variation;
      }
      slots.push({
        id: sl.id,
        variation: variation,
        sets: sets,
        reps: reps,
        rir: rir,
        perSide: sl.id === "pushup" ? variation === "archer" : !!EX[sl.id].perSide,
        slow: !!sl.slow,
        tempo: clamp(Math.round(Number(sl.tempo) || EX[sl.id].tempo), 2, 8),
        easy: !!sl.easy
      });
    });
    if (!slots.length) return null;
    var minutesActual = clamp(Math.round(Number(s.minutesActual) || Number(s.minutesPlanned) || 20), 1, 180);
    return {
      id: String(s.id || ts),
      ts: ts,
      minutesPlanned: clamp(Math.round(Number(s.minutesPlanned) || minutesActual), 5, 90),
      minutesActual: minutesActual,
      note: String(s.note || "").slice(0, 240),
      slots: slots
    };
  }

  root.PushEngine = {
    PRIMARY_SHARE: PRIMARY_SHARE,
    TARGETS: TARGETS,
    LADDER: LADDER,
    EX: EX,
    SCIENCE: SCIENCE,
    SHORT: SHORT,
    prescribe: prescribe,
    overview: overview,
    exerciseStats: exerciseStats,
    sanitizeSession: sanitizeSession,
    formatRest: formatRest,
    round1: round1,
    dayKey: dayKey,
    setCredit: setCredit
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
