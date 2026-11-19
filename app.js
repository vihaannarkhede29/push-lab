(function () {
  var E = window.PushEngine;
  var state = {
    tab: "today",
    minutes: 20,
    sessions: [],
    bw: "",
    draft: {},
    note: "",
    actual: "",
    actualDirty: false,
    varOverride: null,
    prescribedVar: null,
    installHidden: false,
    confirmId: null,
    wipeConfirm: false,
    timer: null,
    exportMsg: "",
    formMsg: "",
    savedFlash: false,
    deferredPrompt: null,
    ready: false
  };
  var audioCtx = null;
  var persistTimer = 0;

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
  function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  }
  function isStandalone() {
    return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  }
  function prettyDate(ts) {
    return new Date(ts).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  }
  function prettyTime(ts) {
    return new Date(ts).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }
  function minLabel(sec) {
    var m = sec / 60;
    if (m < 10) {
      var r = Math.round(m * 10) / 10;
      return Number.isInteger(r) ? String(r) : r.toFixed(1);
    }
    return String(Math.round(m));
  }
  function formatClock(ms) {
    var s = Math.max(0, Math.ceil(ms / 1000));
    var m = Math.floor(s / 60);
    return m + ":" + String(s % 60).padStart(2, "0");
  }
  function setsPhrase(slot) {
    var side = slot.perSide ? " each side" : "";
    var easy = slot.easy ? " easy" : "";
    var leave = slot.targetRir <= 1 ? "leave 1" : slot.targetRir >= 4 ? "leave 4" : "leave 2";
    return slot.sets + easy + " set" + (slot.sets === 1 ? "" : "s") + side +
      " · rest " + E.formatRest(slot.rest) + " · " + leave;
  }
  function variationById(id) {
    for (var i = 0; i < E.LADDER.length; i++) if (E.LADDER[i].id === id) return E.LADDER[i];
    return E.LADDER[1];
  }
  function payload() {
    return {
      v: 1,
      savedAt: Date.now(),
      sessions: state.sessions,
      minutes: state.minutes,
      bw: state.bw,
      installHidden: state.installHidden,
      draft: state.draft,
      note: state.note,
      tab: state.tab,
      actual: state.actual,
      actualDirty: state.actualDirty,
      varOverride: state.varOverride
    };
  }
  function parseStore(raw) {
    if (!raw || typeof raw !== "object") return null;
    var sessions = Array.isArray(raw.sessions) ? raw.sessions.map(E.sanitizeSession).filter(Boolean) : [];
    sessions.sort(function (a, b) { return a.ts - b.ts; });
    return {
      sessions: sessions,
      minutes: clamp(Math.round(Number(raw.minutes) || 20), 5, 90),
      bw: raw.bw ? String(raw.bw).replace(/[^\d.]/g, "").slice(0, 6) : "",
      installHidden: !!raw.installHidden,
      draft: raw.draft && typeof raw.draft === "object" ? raw.draft : {},
      note: String(raw.note || "").slice(0, 240),
      tab: raw.tab === "stats" ? "stats" : "today",
      actual: raw.actual ? String(raw.actual) : "",
      actualDirty: !!raw.actualDirty,
      varOverride: raw.varOverride || null,
      savedAt: Number(raw.savedAt) || 0
    };
  }
  function openDB() {
    return new Promise(function (resolve, reject) {
      if (!window.indexedDB) { reject(new Error("no idb")); return; }
      var req = indexedDB.open("push-lab", 1);
      req.onupgradeneeded = function () {
        if (!req.result.objectStoreNames.contains("kv")) req.result.createObjectStore("kv");
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }
  function idbGet(db) {
    return new Promise(function (resolve, reject) {
      var tx = db.transaction("kv", "readonly");
      var req = tx.objectStore("kv").get("state");
      req.onsuccess = function () { resolve(req.result || null); };
      req.onerror = function () { reject(req.error); };
    });
  }
  function idbSet(db, value) {
    return new Promise(function (resolve, reject) {
      var tx = db.transaction("kv", "readwrite");
      tx.objectStore("kv").put(value, "state");
      tx.oncomplete = function () { resolve(); };
      tx.onerror = function () { reject(tx.error); };
    });
  }
  function schedulePersist() {
    clearTimeout(persistTimer);
    persistTimer = setTimeout(persistNow, 250);
  }
  function persistNow() {
    var data = payload();
    try { localStorage.setItem("push-lab-v1", JSON.stringify(data)); } catch (e) {}
    openDB().then(function (db) { return idbSet(db, data); }).catch(function () {});
  }
  function syncDraft(plan) {
    var next = {};
    plan.slots.forEach(function (s) {
      var prev = state.draft[s.id] || {};
      next[s.id] = {
        reps: prev.reps || "",
        sets: prev.setsDirty ? prev.sets : String(s.sets),
        setsDirty: !!prev.setsDirty,
        rir: prev.rirDirty ? prev.rir : String(s.targetRir),
        rirDirty: !!prev.rirDirty
      };
    });
    state.draft = next;
    var push = null;
    for (var i = 0; i < plan.slots.length; i++) if (plan.slots[i].id === "pushup") push = plan.slots[i];
    var prescribed = push ? push.variation : null;
    if (state.prescribedVar == null) state.prescribedVar = prescribed;
    else if (state.prescribedVar !== prescribed) {
      state.prescribedVar = prescribed;
      state.varOverride = null;
    }
  }
  function selectedPush(slot) {
    return variationById(state.varOverride || slot.variation);
  }
  function canSave() {
    return Object.keys(state.draft).some(function (id) {
      return Math.round(Number(state.draft[id].reps)) > 0;
    });
  }
  function refreshSave() {
    var btn = document.getElementById("save");
    if (btn) btn.disabled = !canSave();
  }
  function ensureAudio() {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === "suspended") audioCtx.resume();
    } catch (e) {}
  }
  function beep() {
    try {
      if (!audioCtx) return;
      var o = audioCtx.createOscillator();
      var g = audioCtx.createGain();
      o.frequency.value = 660;
      g.gain.value = 0.05;
      o.connect(g);
      g.connect(audioCtx.destination);
      o.start();
      g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.35);
      o.stop(audioCtx.currentTime + 0.4);
    } catch (e) {}
  }
  function lineChart(points, yName) {
    if (!points.length) return "";
    var w = 320, h = 168, l = 32, r = 8, t = 12, b = 28;
    var max = Math.max.apply(null, points.map(function (p) { return p.y; }).concat([1]));
    var x = function (i) {
      if (points.length === 1) return l + (w - l - r) / 2;
      return l + i * (w - l - r) / (points.length - 1);
    };
    var y = function (v) { return t + (1 - v / max) * (h - t - b); };
    var d = points.map(function (p, i) {
      return (i ? "L" : "M") + x(i).toFixed(1) + "," + y(p.y).toFixed(1);
    }).join(" ");
    var dots = points.map(function (p, i) {
      return '<circle cx="' + x(i).toFixed(1) + '" cy="' + y(p.y).toFixed(1) + '" r="3"></circle>';
    }).join("");
    var ticks = [0, Math.round(max / 2), Math.round(max)];
    var grid = ticks.map(function (v) {
      var yy = y(v).toFixed(1);
      return '<line x1="' + l + '" y1="' + yy + '" x2="' + (w - r) + '" y2="' + yy + '"></line>' +
        '<text x="0" y="' + (Number(yy) + 4) + '">' + v + "</text>";
    }).join("");
    var xLabels = "";
    if (points.length === 1) {
      xLabels = '<text x="' + x(0).toFixed(1) + '" y="' + (h - 6) + '" text-anchor="middle">' + esc(points[0].label) + "</text>";
    } else {
      xLabels = '<text x="' + l + '" y="' + (h - 6) + '">' + esc(points[0].label) + "</text>" +
        '<text x="' + (w - r) + '" y="' + (h - 6) + '" text-anchor="end">' + esc(points[points.length - 1].label) + "</text>";
    }
    return '<svg class="chart" viewBox="0 0 ' + w + " " + h + '" role="img" aria-label="' + esc(yName) + '">' +
      grid + '<polyline points="' + points.map(function (p, i) { return x(i).toFixed(1) + "," + y(p.y).toFixed(1); }).join(" ") + '"></polyline>' +
      dots + xLabels + "</svg>";
  }
  function spark(values) {
    if (values.length < 2) return "";
    var w = 120, h = 36, max = Math.max.apply(null, values), min = Math.min.apply(null, values);
    var span = max - min || 1;
    var pts = values.map(function (v, i) {
      var x = (i / (values.length - 1)) * (w - 4) + 2;
      var y = h - 4 - ((v - min) / span) * (h - 8);
      return x.toFixed(1) + "," + y.toFixed(1);
    }).join(" ");
    return '<svg class="spark" viewBox="0 0 ' + w + " " + h + '" width="120" height="36" aria-hidden="true"><polyline points="' + pts + '"></polyline></svg>';
  }

  function installHTML() {
    if (state.installHidden || isStandalone()) return "";
    var steps = isIOS()
      ? "iPhone: Share, then Add to Home Screen."
      : "Android: menu, then Install app.";
    var native = state.deferredPrompt ? '<button type="button" data-action="install-native">Install</button>' : "";
    return '<section class="install"><p><strong>Add the icon to your home screen.</strong> ' + esc(steps) + " The log stays in a database on this phone, offline too.</p>" +
      '<div class="row">' + native + '<button type="button" data-action="dismiss-install">Not now</button></div></section>';
  }

  function todayHTML(plan, overview) {
    syncDraft(plan);
    var flash = state.savedFlash ? '<p class="flash">Saved on this phone.</p>' : "";
    state.savedFlash = false;
    var pills = [10, 15, 20, 30, 45, 60].map(function (n) {
      return '<button type="button" data-action="minutes" data-minutes="' + n + '" aria-pressed="' + (state.minutes === n ? "true" : "false") + '">' + n + "</button>";
    }).join("");
    var cards = plan.slots.map(function (slot, index) {
      var d = state.draft[slot.id] || {};
      var chosen = slot.id === "pushup" ? selectedPush(slot) : null;
      var title = chosen ? chosen.name : slot.name;
      var perSide = chosen ? chosen.id === "archer" : slot.perSide;
      var cue = chosen && state.varOverride && state.varOverride !== slot.variation ? chosen.cue : slot.cue;
      var repsLabel = perSide ? "Total reps, one side" : "Total reps";
      var setsLabel = perSide ? "Sets each side" : "Sets";
      var options = "";
      if (slot.id === "pushup") {
        options = '<label>Variation<select id="var-push" data-action="variation">' +
          E.LADDER.map(function (v) {
            return '<option value="' + v.id + '"' + (chosen.id === v.id ? " selected" : "") + ">" + esc(v.name) + "</option>";
          }).join("") + "</select></label>";
      }
      var rir = [0, 1, 2, 3, 4, 5].map(function (n) {
        return '<option value="' + n + '"' + (String(n) === String(d.rir) ? " selected" : "") + ">" + n + "</option>";
      }).join("");
      return '<article class="ex"><div class="ex-top"><span class="num">' + (index + 1) + '</span><div><h3>' + esc(title) + "</h3>" +
        '<p class="meta">' + esc(setsPhrase(Object.assign({}, slot, { perSide: perSide }))) + "</p>" +
        '<p class="equip">' + esc(slot.equipment) + "</p></div></div>" +
        '<p class="cue">' + esc(cue) + "</p>" +
        '<p class="progress">' + esc(slot.progress) + "</p>" +
        '<p class="why">' + esc(slot.why) + "</p>" +
        options +
        '<div class="log"><label>' + setsLabel + '<input id="sets-' + slot.id + '" data-key="' + slot.id + '" data-field="sets" inputmode="numeric" value="' + esc(d.sets || slot.sets) + '"></label>' +
        '<label>' + repsLabel + '<input id="reps-' + slot.id + '" data-key="' + slot.id + '" data-field="reps" inputmode="numeric" enterkeyhint="next" placeholder="0" value="' + esc(d.reps || "") + '"></label>' +
        '<label class="span">RIR<select id="rir-' + slot.id + '" data-key="' + slot.id + '" data-field="rir">' + rir + "</select></label></div>" +
        '<button type="button" class="rest" data-action="rest" data-sec="' + slot.rest + '">Start ' + esc(E.formatRest(slot.rest)) + " rest</button></article>";
    }).join("");
    var todayKey = E.dayKey(Date.now());
    var done = state.sessions.filter(function (s) { return E.dayKey(s.ts) === todayKey; }).slice().reverse();
    var doneHTML = done.length ? '<section class="logged"><h2>Already logged today</h2><p class="hint">The plan above assumes these sets are done.</p>' +
      done.map(sessionHTML).join("") + "</section>" : "";
    var science = E.SCIENCE.map(function (item) {
      return "<h3>" + esc(item.title) + "</h3><p>" + esc(item.body) + "</p>";
    }).join("");
    return flash + '<section class="ask"><h2>How many minutes?</h2><div class="mins">' + pills +
      '<input id="minutes" class="minutes-input" inputmode="numeric" aria-label="Minutes available" value="' + state.minutes + '"></div></section>' +
      '<p class="lead">' + esc(plan.lead) + "</p>" +
      (plan.shareText ? '<p class="share">' + esc(plan.shareText) + "</p>" : "") +
      '<div class="clock"><div><b>' + minLabel(plan.parts.warmup) + '</b><span>warm-up min</span></div>' +
      '<div><b>' + minLabel(plan.parts.work) + '</b><span>lifting min</span></div>' +
      '<div><b>' + minLabel(plan.parts.rest) + '</b><span>rest min</span></div></div>' +
      '<p class="hint">' + esc(plan.warmupText) + " Lifting time is estimated from your usual reps. RIR is how many clean reps you still had. Leave the reps blank to skip an exercise.</p>" +
      cards +
      '<label class="actual">Minutes this took<input id="actual" inputmode="numeric" value="' + esc(state.actualDirty ? state.actual : String(plan.minutes)) + '"></label>' +
      '<label class="note">Note, optional<input id="note" maxlength="240" value="' + esc(state.note) + '"></label>' +
      '<p id="form-msg" class="form-msg">' + esc(state.formMsg) + "</p>" +
      doneHTML +
      '<details><summary>Why this workout</summary>' + science + "</details>";
  }

  function sessionHTML(s) {
    var bits = s.slots.map(function (sl) {
      var name = E.EX[sl.id] ? E.EX[sl.id].name : sl.id;
      if (sl.id === "pushup") name = variationById(sl.variation).name;
      var side = sl.perSide ? "/side" : "";
      return name + " " + sl.sets + "×" + sl.reps + side;
    }).join(" · ");
    var confirm = state.confirmId === s.id;
    var btn = confirm
      ? '<button type="button" class="text-btn" data-action="confirm-delete" data-id="' + esc(s.id) + '">Confirm remove</button> <button type="button" class="text-btn" data-action="cancel-delete">Cancel</button>'
      : '<button type="button" class="text-btn" data-action="delete" data-id="' + esc(s.id) + '">Remove</button>';
    return '<div class="session"><p><strong>' + esc(prettyDate(s.ts)) + " · " + prettyTime(s.ts) + " · " + s.minutesActual + " min</strong></p><p>" + esc(bits) + "</p>" +
      (s.note ? "<p>" + esc(s.note) + "</p>" : "") + btn + "</div>";
  }

  function statsHTML(overview) {
    var avg = overview.avgMin == null ? "—" : E.round1(overview.avgMin);
    var best = overview.bestPushAvg == null ? "—" : E.round1(overview.bestPushAvg);
    var trend = overview.trend || "—";
    var trendClass = overview.trend === "Up" ? "trend-up" : overview.trend === "Down" ? "trend-down" : "";
    var pushPoints = overview.pushSeries.map(function (p) {
      return { y: Math.round(p.avg * 10) / 10, label: prettyDate(p.ts) };
    });
    var minPoints = overview.minuteSeries.map(function (p) {
      return { y: p.y, label: prettyDate(p.ts) };
    });
    var labels = { push: "Push", pull: "Pull", side: "Side delts", rear: "Rear delts", biceps: "Biceps", triceps: "Triceps", legs: "Legs" };
    var bars = Object.keys(labels).map(function (m) {
      var target = overview.targets[m];
      var got = overview.credit[m] || 0;
      var pct = Math.min(100, Math.round(100 * got / target));
      return '<div class="bar"><span>' + labels[m] + '</span><div class="track"><div class="fill" style="width:' + pct + '%"></div></div><b>' + esc(E.round1(got)) + " / " + target + "</b></div>";
    }).join("");
    var lifts = E.exerciseStats(state.sessions, Date.now()).map(function (ex) {
      var unit = ex.perSide ? "reps/set, one side" : "reps/set";
      var sparkHTML = spark(ex.series);
      var ends = ex.series.length >= 2
        ? '<span>' + esc(E.round1(ex.series[0])) + " → " + esc(E.round1(ex.series[ex.series.length - 1])) + " " + unit + "</span>"
        : "";
      return '<section class="lift"><div class="lift-head"><h3>' + esc(ex.name) + "</h3>" +
        '<span class="' + (ex.trend === "Up" ? "trend-up" : ex.trend === "Down" ? "trend-down" : "") + '">' + esc(ex.trend || "—") + "</span></div>" +
        '<div class="lift-grid">' +
        '<div><b>' + esc(E.round1(ex.avgReps)) + "</b><span>avg " + unit + "</span></div>" +
        '<div><b>' + esc(E.round1(ex.bestAvg)) + "</b><span>best reps/set</span></div>" +
        '<div><b>' + esc(E.round1(ex.hardSets7)) + "</b><span>hard sets, 7 days</span></div>" +
        '<div><b>' + ex.totalReps + "</b><span>total reps</span></div>" +
        '<div><b>' + esc(E.round1(ex.avgSessionMin || 0)) + "</b><span>avg session min</span></div>" +
        '<div><b>' + esc(E.round1(ex.avgWorkMin)) + "</b><span>avg working min</span></div></div>" +
        (sparkHTML ? '<p class="sparkline">' + sparkHTML + ends + "</p>" : "") +
        '<p class="hint">' + ex.sessions + " times · last " + esc(prettyDate(ex.lastTs)) + "</p></section>";
    }).join("");
    var tonnage = overview.tonnage == null ? "" :
      '<p class="hint">Estimated push-up work, 7 days: <strong>' + Math.round(overview.tonnage).toLocaleString() + " lb·reps</strong>. Standard push-ups use about two-thirds of body weight. Other variations use a rough multiplier, not a lab measurement.</p>";
    var history = state.sessions.slice().reverse().map(sessionHTML).join("");
    var wipe = state.wipeConfirm
      ? '<button type="button" class="text-btn" data-action="confirm-wipe">Confirm erase</button> <button type="button" class="text-btn" data-action="cancel-wipe">Cancel</button>'
      : '<button type="button" class="text-btn" data-action="wipe">Erase phone data</button>';
    return '<h2>Your log</h2>' +
      (state.sessions.length ? "" : '<p class="hint">Log a workout on Today. The bars below are the last 7 days, so they start at zero.</p>') +
      '<div class="hero"><div class="stat"><b>' + overview.workouts + '</b><span>workouts</span></div>' +
      '<div class="stat"><b>' + overview.streak + '</b><span>day streak</span></div>' +
      '<div class="stat"><b>' + esc(avg) + '</b><span>avg minutes</span></div>' +
      '<div class="stat"><b>' + overview.pushReps7 + '</b><span>push-up reps, 7 days</span></div></div>' +
      '<p class="hint">Best push-up set average ' + esc(best) + ' · trend <span class="' + trendClass + '">' + esc(trend) + "</span></p>" +
      (pushPoints.length ? '<h2>Push-up reps per set</h2>' + lineChart(pushPoints, "Push-up reps per set") +
        '<p class="caption">Y axis: reps per set. X axis: date. Total reps ÷ sets. A harder variation starts lower on purpose. Source: this phone.</p>' : "") +
      (minPoints.length ? '<h2>Minutes per workout</h2>' + lineChart(minPoints, "Minutes per workout") +
        '<p class="caption">Y axis: minutes. X axis: date. Source: this phone.</p>' : "") +
      '<h2>Hard sets, last 7 days</h2>' + bars +
      '<p class="caption">Bar length is the share of the weekly target. Numbers are hard-set equivalents: a set stopped with 0–2 reps left counts fully, 3 left counts 0.8, 4 left counts about half.</p>' +
      (lifts ? "<h2>Each exercise</h2>" + lifts : "") +
      tonnage +
      '<h2>Body weight</h2><label class="bw">Pounds<input id="bw" inputmode="decimal" value="' + esc(state.bw) + '"></label>' +
      '<p class="hint">Optional. Used only to estimate push-up load.</p>' +
      (history ? "<h2>All workouts</h2>" + history : "") +
      '<details><summary>Phone backup</summary><p>Workouts live in IndexedDB on this phone, with a second copy in local storage. They are not on a server. Share a backup before you clear browser data.</p>' +
      '<div class="row"><button type="button" data-action="backup">Share backup</button></div>' +
      '<p class="hint">' + esc(state.exportMsg) + "</p>" +
      '<label>Import backup<input id="import-file" type="file" accept="application/json,.json"></label>' +
      "<p>" + wipe + "</p></details>";
  }

  function view() {
    var now = Date.now();
    var overview = E.overview(state.sessions, now, state.bw);
    var plan = E.prescribe(state.minutes, state.sessions, now);
    var offline = navigator.onLine ? "" : '<p class="offline">Offline. Your log is still on this phone.</p>';
    var streak = overview.streak ? '<p class="streak">' + overview.streak + "-day streak</p>" : "";
    var main = state.tab === "stats" ? statsHTML(overview) : todayHTML(plan, overview);
    var timer = state.timer ? '<div class="timer"><b id="timer-readout">' + (state.timer.dinged ? "Go" : formatClock(state.timer.until - Date.now())) + '</b><button type="button" class="text-btn" data-action="timer-stop">Stop</button></div>' : "";
    var save = state.tab === "today" ? '<button type="button" class="save" id="save" data-action="save">Save on this phone</button>' : "";
    return '<header class="top"><div><p class="date">' + esc(prettyDate(now)) + '</p><h1>Push Lab</h1><p class="sub">10 lb and push-ups</p></div>' + streak + "</header>" +
      offline + installHTML() + '<main class="main">' + main + "</main>" +
      '<div class="dock">' + timer + save +
      '<nav class="nav"><button type="button" data-action="tab" data-tab="today" aria-selected="' + (state.tab === "today" ? "true" : "false") + '">Today</button>' +
      '<button type="button" data-action="tab" data-tab="stats" aria-selected="' + (state.tab === "stats" ? "true" : "false") + '">Stats</button></nav></div>';
  }

  function render() {
    var active = document.activeElement;
    var focusId = active && active.id ? active.id : "";
    var sel = active && typeof active.selectionStart === "number" ? active.selectionStart : null;
    document.body.classList.toggle("tab-stats", state.tab === "stats");
    document.getElementById("app").innerHTML = view();
    if (focusId) {
      var el = document.getElementById(focusId);
      if (el) {
        el.focus();
        if (sel != null && el.setSelectionRange) {
          try { el.setSelectionRange(sel, sel); } catch (e) {}
        }
      }
    }
    refreshSave();
  }

  function saveSession() {
    var plan = E.prescribe(state.minutes, state.sessions, Date.now());
    var slots = [];
    plan.slots.forEach(function (s) {
      var d = state.draft[s.id] || {};
      var reps = Math.round(Number(d.reps));
      var sets = Math.round(Number(d.sets));
      var rir = Math.round(Number(d.rir));
      if (!(reps > 0) || !(sets > 0) || sets > 20 || rir < 0 || rir > 5 || !isFinite(rir)) return;
      var variation = s.id === "pushup" ? (state.varOverride || s.variation) : null;
      slots.push({
        id: s.id,
        variation: variation,
        sets: sets,
        reps: reps,
        rir: rir,
        perSide: s.id === "pushup" ? variation === "archer" : !!s.perSide,
        slow: !!s.slow,
        tempo: s.tempo,
        easy: !!s.easy
      });
    });
    if (!slots.length) {
      state.formMsg = "Enter total reps for at least one exercise.";
      var msg = document.getElementById("form-msg");
      if (msg) msg.textContent = state.formMsg;
      return;
    }
    var actual = Math.round(Number(state.actualDirty ? state.actual : plan.minutes));
    state.sessions.push({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      ts: Date.now(),
      minutesPlanned: plan.minutes,
      minutesActual: clamp(actual || plan.minutes, 1, 180),
      note: state.note.trim().slice(0, 240),
      slots: slots
    });
    state.sessions.sort(function (a, b) { return a.ts - b.ts; });
    state.draft = {};
    state.note = "";
    state.actual = "";
    state.actualDirty = false;
    state.formMsg = "";
    state.savedFlash = true;
    state.varOverride = null;
    state.prescribedVar = null;
    persistNow();
    render();
    window.scrollTo(0, 0);
  }

  async function backup() {
    var text = JSON.stringify(payload(), null, 2);
    var file = new File([text], "push-lab-backup.json", { type: "application/json" });
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: "Push Lab backup" });
        return;
      }
      if (navigator.share) {
        await navigator.share({ title: "Push Lab backup", text: text });
        return;
      }
    } catch (e) {
      if (e && e.name === "AbortError") return;
    }
    try {
      await navigator.clipboard.writeText(text);
      state.exportMsg = "Backup copied.";
    } catch (e2) {
      state.exportMsg = "Could not share from this browser. Use the file import on a computer if you exported another way.";
    }
    render();
  }

  function mergeImport(data) {
    var incoming = Array.isArray(data) ? data : (data && data.sessions);
    if (!Array.isArray(incoming)) throw new Error("no sessions");
    var known = {};
    state.sessions.forEach(function (s) { known[s.id] = true; });
    var added = 0;
    incoming.forEach(function (raw) {
      var session = E.sanitizeSession(raw);
      if (!session || known[session.id]) return;
      known[session.id] = true;
      state.sessions.push(session);
      added += 1;
    });
    state.sessions.sort(function (a, b) { return a.ts - b.ts; });
    if (data && data.bw && !state.bw) state.bw = String(data.bw).replace(/[^\d.]/g, "").slice(0, 6);
    state.exportMsg = "Added " + added + " workout" + (added === 1 ? "" : "s") + ".";
    persistNow();
    render();
  }

  document.addEventListener("click", function (e) {
    var t = e.target.closest("[data-action]");
    if (!t) return;
    var action = t.getAttribute("data-action");
    if (action === "tab") {
      state.tab = t.getAttribute("data-tab");
      schedulePersist();
      render();
    } else if (action === "minutes") {
      state.minutes = Number(t.getAttribute("data-minutes"));
      schedulePersist();
      render();
    } else if (action === "rest") {
      ensureAudio();
      state.timer = { until: Date.now() + Number(t.getAttribute("data-sec")) * 1000, dinged: false };
      render();
    } else if (action === "timer-stop") {
      state.timer = null;
      render();
    } else if (action === "save") {
      saveSession();
    } else if (action === "delete") {
      state.confirmId = t.getAttribute("data-id");
      render();
    } else if (action === "cancel-delete") {
      state.confirmId = null;
      render();
    } else if (action === "confirm-delete") {
      var id = t.getAttribute("data-id");
      state.sessions = state.sessions.filter(function (s) { return s.id !== id; });
      state.confirmId = null;
      state.prescribedVar = null;
      persistNow();
      render();
    } else if (action === "dismiss-install") {
      state.installHidden = true;
      persistNow();
      render();
    } else if (action === "install-native" && state.deferredPrompt) {
      state.deferredPrompt.prompt();
      state.deferredPrompt.userChoice.finally(function () {
        state.deferredPrompt = null;
        render();
      });
    } else if (action === "backup") {
      backup();
    } else if (action === "wipe") {
      state.wipeConfirm = true;
      render();
    } else if (action === "cancel-wipe") {
      state.wipeConfirm = false;
      render();
    } else if (action === "confirm-wipe") {
      state.sessions = [];
      state.draft = {};
      state.note = "";
      state.bw = "";
      state.wipeConfirm = false;
      state.prescribedVar = null;
      persistNow();
      render();
    }
  });

  document.addEventListener("input", function (e) {
    var t = e.target;
    if (t.id === "minutes") {
      var n = parseInt(t.value, 10);
      if (n >= 5 && n <= 90) {
        state.minutes = n;
        schedulePersist();
        render();
      }
      return;
    }
    if (t.id === "note") { state.note = t.value; schedulePersist(); return; }
    if (t.id === "actual") { state.actual = t.value; state.actualDirty = true; schedulePersist(); return; }
    if (t.id === "bw") {
      state.bw = t.value.replace(/[^\d.]/g, "").slice(0, 6);
      schedulePersist();
      return;
    }
    if (t.dataset && t.dataset.field) {
      var key = t.dataset.key;
      state.draft[key] = state.draft[key] || {};
      state.draft[key][t.dataset.field] = t.value;
      if (t.dataset.field === "sets") state.draft[key].setsDirty = true;
      if (t.dataset.field === "rir") state.draft[key].rirDirty = true;
      state.formMsg = "";
      refreshSave();
      schedulePersist();
    }
  });

  document.addEventListener("change", function (e) {
    var t = e.target;
    if (t.id === "minutes") {
      var n = parseInt(t.value, 10);
      state.minutes = n >= 5 && n <= 90 ? n : state.minutes;
      schedulePersist();
      render();
    } else if (t.id === "var-push") {
      state.varOverride = t.value;
      schedulePersist();
      render();
    } else if (t.id === "bw") {
      state.bw = t.value.replace(/[^\d.]/g, "").slice(0, 6);
      persistNow();
      render();
    } else if (t.id === "import-file" && t.files && t.files[0]) {
      var file = t.files[0];
      file.text().then(function (text) {
        mergeImport(JSON.parse(text));
      }).catch(function () {
        state.exportMsg = "That file could not be read as a Push Lab backup.";
        render();
      });
    } else if (t.dataset && t.dataset.field === "rir") {
      var key = t.dataset.key;
      state.draft[key] = state.draft[key] || {};
      state.draft[key].rir = t.value;
      state.draft[key].rirDirty = true;
      schedulePersist();
    }
  });

  document.addEventListener("keydown", function (e) {
    if (e.key !== "Enter" || !e.target || e.target.dataset.field !== "reps") return;
    e.preventDefault();
    var inputs = Array.prototype.slice.call(document.querySelectorAll("[data-field=reps]"));
    var i = inputs.indexOf(e.target);
    if (i >= 0 && inputs[i + 1]) inputs[i + 1].focus();
    else e.target.blur();
  });

  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();
    state.deferredPrompt = e;
    if (state.ready) render();
  });
  window.addEventListener("online", function () { if (state.ready) render(); });
  window.addEventListener("offline", function () { if (state.ready) render(); });
  if (window.visualViewport) {
    var syncKb = function () {
      var vv = window.visualViewport;
      var kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      document.documentElement.style.setProperty("--kb", kb + "px");
      document.body.classList.toggle("kb", kb > 80);
    };
    window.visualViewport.addEventListener("resize", syncKb);
    window.visualViewport.addEventListener("scroll", syncKb);
  }
  setInterval(function () {
    if (!state.timer) return;
    var el = document.getElementById("timer-readout");
    if (!el) return;
    var left = state.timer.until - Date.now();
    if (left <= 0) {
      el.textContent = "Go";
      if (!state.timer.dinged) {
        state.timer.dinged = true;
        beep();
        if (navigator.vibrate) navigator.vibrate([140, 70, 140]);
      }
    } else el.textContent = formatClock(left);
  }, 200);

  function bootFrom(chosen) {
    if (!chosen) return;
    state.sessions = chosen.sessions;
    state.minutes = chosen.minutes;
    state.bw = chosen.bw;
    state.installHidden = chosen.installHidden;
    state.draft = chosen.draft;
    state.note = chosen.note;
    state.tab = chosen.tab;
    state.actual = chosen.actual || "";
    state.actualDirty = !!chosen.actualDirty;
    state.varOverride = chosen.varOverride || null;
  }

  openDB().then(function (db) { return idbGet(db); }).catch(function () { return null; }).then(function (idbRaw) {
    var fromIdb = parseStore(idbRaw);
    var fromLs = null;
    try { fromLs = parseStore(JSON.parse(localStorage.getItem("push-lab-v1") || "null")); } catch (e) {}
    var chosen = fromIdb && fromLs ? (fromIdb.savedAt >= fromLs.savedAt ? fromIdb : fromLs) : (fromIdb || fromLs);
    bootFrom(chosen);
    state.ready = true;
    render();
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () {});
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(function () {});
  });
})();
