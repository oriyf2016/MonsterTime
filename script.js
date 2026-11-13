// ===== הגדרות =====
// כשיהיה לאתר הראשי כתובת קבועה, שמים אותה כאן והקישור "חלק מ-MonsterFamily" יופיע למעלה
const MONSTERFAMILY_URL = "https://monsterfamily.onrender.com";

const $ = id => document.getElementById(id);
const pad = n => String(n).padStart(2, "0");

// שמירה בדפדפן (עטוף ב-try כי לפעמים זה חסום)
const store = {
  get(key, fallback) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
    catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  }
};

// ===== שפות =====
// כל התרגומים נמצאים בקובץ lang.js (LANGS ו-I18N)
let lang = store.get("monster-lang", "he");
if (!I18N[lang]) lang = "he";
const langInfo = () => LANGS.find(l => l.code === lang) || LANGS[0];

// ממלא את רשימת השפות בהגדרות
LANGS.forEach(l => {
  const opt = document.createElement("option");
  opt.value = l.code;
  opt.textContent = l.name;
  $("langSelect").appendChild(opt);
});

function t(key, vars = {}) {
  let s = I18N[lang][key] ?? I18N.en[key] ?? key;
  for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, v);
  return s;
}

// קובע טקסט לאלמנט וזוכר את המפתח, כדי שהחלפת שפה תעדכן אותו
function setText(el, key) {
  el.dataset.i18n = key;
  el.textContent = t(key);
}

function applyLanguage() {
  document.documentElement.lang = lang;
  document.documentElement.dir = langInfo().dir;
  document.querySelectorAll("[data-i18n]").forEach(el => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll("[data-i18n-aria]").forEach(el => el.setAttribute("aria-label", t(el.dataset.i18nAria)));
  document.querySelectorAll("[data-i18n-placeholder]").forEach(el => { el.placeholder = t(el.dataset.i18nPlaceholder); });
  $("langSelect").value = lang;
  drawLaps();
  renderCities();
  fillSoundSelects();
  renderReminders();
}

// ===== חלון הגדרות =====
const settingsBtn = $("settingsBtn");
const settingsPanel = $("settingsPanel");
function setSettingsOpen(open) {
  settingsPanel.classList.toggle("open", open);
  settingsBtn.setAttribute("aria-expanded", String(open));
}
settingsBtn.addEventListener("click", e => {
  e.stopPropagation();
  setSettingsOpen(!settingsPanel.classList.contains("open"));
});
document.addEventListener("click", e => {
  if (!settingsPanel.contains(e.target)) setSettingsOpen(false);
});
document.addEventListener("keydown", e => { if (e.key === "Escape") setSettingsOpen(false); });
$("langSelect").addEventListener("change", e => {
  lang = e.target.value;
  store.set("monster-lang", lang);
  applyLanguage();
});

// ===== הודעה קופצת =====
let toastTimer;
function toast(msg) {
  const el = $("toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 3500);
}

// ===== לשוניות =====
const VIEWS = ["timer", "stopwatch", "clock", "reminders"];
function showView(name) {
  if (!VIEWS.includes(name)) name = "timer";
  VIEWS.forEach(v => {
    $("view-" + v).hidden = v !== name;
    $("tab-" + v).setAttribute("aria-selected", String(v === name));
  });
}
document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => { location.hash = tab.dataset.view; });
});
window.addEventListener("hashchange", () => showView(location.hash.slice(1)));

// ===== טיימר =====
const RING_LEN = 2 * Math.PI * 96;
const ring = $("timerRing");
ring.style.strokeDasharray = RING_LEN;

let timerTotal = 300;      // שניות
let timerLeft = 300;       // שניות
let timerEnd = null;       // מתי הטיימר נגמר (זמן אמיתי)
let timerTick = null;

function formatTimer(sec) {
  sec = Math.max(0, Math.ceil(sec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

function readInputs() {
  const h = Math.min(99, Math.max(0, parseInt($("tH").value) || 0));
  const m = Math.min(59, Math.max(0, parseInt($("tM").value) || 0));
  const s = Math.min(59, Math.max(0, parseInt($("tS").value) || 0));
  return h * 3600 + m * 60 + s;
}

function drawTimer() {
  $("timerDisplay").textContent = formatTimer(timerLeft);
  const progress = timerTotal > 0 ? timerLeft / timerTotal : 0;
  ring.style.strokeDashoffset = RING_LEN * (1 - progress);
  if (timerEnd) document.title = `⏳ ${formatTimer(timerLeft)} · MonsterTime`;
}

function setTimerFromInputs() {
  if (timerEnd) return;
  timerTotal = timerLeft = readInputs();
  ring.classList.remove("done");
  setText($("timerHint"), "ready");
  drawTimer();
}

function startTimer() {
  if (timerLeft <= 0) setTimerFromInputs();
  if (timerLeft <= 0) { toast(t("chooseTime")); return; }
  timerEnd = Date.now() + timerLeft * 1000;
  setText($("timerStart"), "pause");
  $("timerStart").classList.add("running");
  $("timerInputs").classList.add("locked");
  setText($("timerHint"), "counting");
  timerTick = setInterval(() => {
    timerLeft = (timerEnd - Date.now()) / 1000;
    if (timerLeft <= 0) finishTimer();
    else drawTimer();
  }, 200);
}

function pauseTimer() {
  clearInterval(timerTick);
  timerLeft = Math.max(0, (timerEnd - Date.now()) / 1000);
  timerEnd = null;
  setText($("timerStart"), "resume");
  $("timerStart").classList.remove("running");
  setText($("timerHint"), "paused");
  document.title = "MonsterTime";
  drawTimer();
}

function finishTimer() {
  clearInterval(timerTick);
  timerEnd = null;
  timerLeft = 0;
  drawTimer();
  ring.classList.add("done");
  setText($("timerStart"), "start");
  $("timerStart").classList.remove("running");
  $("timerInputs").classList.remove("locked");
  setText($("timerHint"), "done");
  document.title = `${t("timeUp")} · MonsterTime`;
  toast(t("timeUp"));
  playSound($("timerSound").value, 2);
}

function resetTimer() {
  clearInterval(timerTick);
  timerEnd = null;
  setText($("timerStart"), "start");
  $("timerStart").classList.remove("running");
  $("timerInputs").classList.remove("locked");
  document.title = "MonsterTime";
  setTimerFromInputs();
}

$("timerStart").addEventListener("click", () => (timerEnd ? pauseTimer() : startTimer()));
$("timerReset").addEventListener("click", resetTimer);
["tH", "tM", "tS"].forEach(id => $(id).addEventListener("input", setTimerFromInputs));
document.querySelectorAll(".chip[data-min]").forEach(chip => {
  chip.addEventListener("click", () => {
    if (timerEnd) return;
    const min = parseInt(chip.dataset.min);
    $("tH").value = Math.floor(min / 60);
    $("tM").value = min % 60;
    $("tS").value = 0;
    setTimerFromInputs();
  });
});

// ===== סטופר =====
let swStartedAt = null;  // מתי התחיל הסיבוב הנוכחי
let swElapsed = 0;       // זמן שנצבר לפני ההשהיה (מילישניות)
let swFrame = null;
let laps = [];           // זמני הקפות (מילישניות)

function swNow() {
  return swElapsed + (swStartedAt ? performance.now() - swStartedAt : 0);
}

function formatSw(ms) {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const main = h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
  return { main, cs: "." + pad(Math.floor((ms % 1000) / 10)) };
}

function drawSw() {
  const f = formatSw(swNow());
  $("swDisplay").textContent = f.main;
  $("swMs").textContent = f.cs;
  if (swStartedAt) swFrame = requestAnimationFrame(drawSw);
}

function drawLaps() {
  const list = $("laps");
  list.innerHTML = "";
  if (laps.length === 0) return;
  const fastest = Math.min(...laps);
  const slowest = Math.max(...laps);
  let total = 0;
  const rows = laps.map((lap, i) => {
    total += lap;
    const li = document.createElement("li");
    if (laps.length > 1 && lap === fastest) li.classList.add("fastest");
    if (laps.length > 1 && lap === slowest) li.classList.add("slowest");
    const l = formatSw(lap), tt = formatSw(total);
    li.innerHTML = `<span>${t("lapN", { n: i + 1 })}</span>
      <span class="lap-time">${l.main}${l.cs}</span>
      <span class="lap-total">${tt.main}${tt.cs}</span>`;
    return li;
  });
  rows.reverse().forEach(li => list.appendChild(li));
}

$("swStart").addEventListener("click", () => {
  const btn = $("swStart");
  if (swStartedAt) {
    swElapsed = swNow();
    swStartedAt = null;
    cancelAnimationFrame(swFrame);
    setText(btn, "resume");
    btn.classList.remove("running");
    $("swLap").disabled = true;
  } else {
    swStartedAt = performance.now();
    setText(btn, "pause");
    btn.classList.add("running");
    $("swLap").disabled = false;
    $("swReset").disabled = false;
    drawSw();
  }
});

$("swLap").addEventListener("click", () => {
  const sum = laps.reduce((a, b) => a + b, 0);
  laps.push(swNow() - sum);
  drawLaps();
  playSound($("swSound").value);
});

$("swReset").addEventListener("click", () => {
  cancelAnimationFrame(swFrame);
  swStartedAt = null;
  swElapsed = 0;
  laps = [];
  setText($("swStart"), "start");
  $("swStart").classList.remove("running");
  $("swLap").disabled = true;
  $("swReset").disabled = true;
  drawSw();
  drawLaps();
});

// ===== שעון עולמי =====
const ALL_ZONES = Object.keys(I18N.he.cities);
const DEFAULT_ZONES = ["Europe/London", "America/New_York", "Asia/Tokyo"];
let myZones = store.get("monstertime-cities", DEFAULT_ZONES).filter(z => ALL_ZONES.includes(z));

// לשפות בלי תרגום של שמות ערים, מוצג השם באנגלית
const cityName = zone => (I18N[lang].cities || I18N.en.cities)[zone] || I18N.en.cities[zone] || zone;

// כמה דקות אזור זמן מסוים מקדים את UTC
function zoneOffsetMinutes(zone, date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone, hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit"
  }).formatToParts(date).reduce((o, p) => (o[p.type] = p.value, o), {});
  const asUTC = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
  return Math.round((asUTC - Math.floor(date.getTime() / 60000) * 60000) / 60000);
}

function diffText(zone, now) {
  const diff = zoneOffsetMinutes(zone, now) + now.getTimezoneOffset();
  if (diff === 0) return t("sameTime");
  const h = Math.floor(Math.abs(diff) / 60);
  const m = Math.abs(diff) % 60;
  const amount = (h ? t("hShort", { n: h }) : "") + (h && m ? t("and") : "") + (m ? t("mShort", { n: m }) : "");
  return t(diff > 0 ? "ahead" : "behind", { t: amount });
}

function fillCitySelect() {
  const sel = $("citySelect");
  sel.innerHTML = "";
  const available = ALL_ZONES.filter(z => !myZones.includes(z));
  available.forEach(zone => {
    const opt = document.createElement("option");
    opt.value = zone;
    opt.textContent = cityName(zone);
    sel.appendChild(opt);
  });
  sel.disabled = $("addCity").disabled = available.length === 0;
}

function renderCities() {
  const box = $("cities");
  box.innerHTML = "";
  if (myZones.length === 0) {
    box.innerHTML = `<div class="empty-cities">${t("noCities")}</div>`;
  }
  myZones.forEach(zone => {
    const row = document.createElement("div");
    row.className = "city";
    row.innerHTML = `
      <div>
        <div class="city-name">${cityName(zone)}</div>
        <div class="city-meta" data-meta="${zone}"></div>
      </div>
      <div class="city-right">
        <div class="city-time" data-time="${zone}">--:--</div>
        <button class="remove" data-remove="${zone}" aria-label="${t("remove", { city: cityName(zone) })}">✕</button>
      </div>`;
    box.appendChild(row);
  });
  fillCitySelect();
  tickClock();
}

function tickClock() {
  const now = new Date();
  const loc = langInfo().locale;
  $("localTime").textContent = now.toLocaleTimeString(loc, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  $("localDate").textContent = now.toLocaleDateString(loc, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  document.querySelectorAll("[data-time]").forEach(el => {
    el.textContent = now.toLocaleTimeString(loc, { timeZone: el.dataset.time, hour: "2-digit", minute: "2-digit" });
  });
  document.querySelectorAll("[data-meta]").forEach(el => {
    const zone = el.dataset.meta;
    const day = now.toLocaleDateString(loc, { timeZone: zone, weekday: "long" });
    el.textContent = `${day} · ${diffText(zone, now)}`;
  });
}

$("addCity").addEventListener("click", () => {
  const zone = $("citySelect").value;
  if (!zone || myZones.includes(zone)) return;
  myZones.push(zone);
  store.set("monstertime-cities", myZones);
  renderCities();
});

$("cities").addEventListener("click", e => {
  const zone = e.target.dataset.remove;
  if (!zone) return;
  myZones = myZones.filter(z => z !== zone);
  store.set("monstertime-cities", myZones);
  renderCities();
});

// ===== צלילים =====
// כל הצלילים נוצרים בקוד (Web Audio), אז אין צורך בקבצי שמע
const SOUND_KEYS = ["beep", "bell", "chime", "digital", "monster", "none"];
const SOUND_LABEL = { beep: "soundBeep", bell: "soundBell", chime: "soundChime", digital: "soundDigital", monster: "soundMonster", none: "soundNone" };
const SOUND_LEN = { beep: 0.8, bell: 1.6, chime: 1.1, digital: 1.0, monster: 1.2 }; // אורך כל צליל בשניות

let audioCtx = null;
function getCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}
// דפדפנים מאפשרים צליל רק אחרי שהמשתמש לחץ על משהו, אז מכינים את הצליל כבר בלחיצה הראשונה
document.addEventListener("pointerdown", () => { try { getCtx(); } catch {} }, { once: true });

function tone(ctx, { freq, start, dur, type = "sine", vol = 0.3, endFreq }) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, start + dur);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(vol, start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(gain).connect(ctx.destination);
  osc.start(start);
  osc.stop(start + dur + 0.05);
}

const SOUNDS = {
  beep: (ctx, s) => [0, 0.35].forEach(o => tone(ctx, { freq: 880, start: s + o, dur: 0.25 })),
  bell: (ctx, s) => {
    tone(ctx, { freq: 660, start: s, dur: 1.5, vol: 0.35 });
    tone(ctx, { freq: 1320, start: s, dur: 1.0, vol: 0.12 });
    tone(ctx, { freq: 1980, start: s, dur: 0.6, vol: 0.06 });
  },
  chime: (ctx, s) => [523, 659, 784, 1047].forEach((f, i) => tone(ctx, { freq: f, start: s + i * 0.18, dur: 0.5, type: "triangle", vol: 0.28 })),
  digital: (ctx, s) => [0, 0.12, 0.24, 0.36, 0.6, 0.72, 0.84].forEach(o => tone(ctx, { freq: 1000, start: s + o, dur: 0.08, type: "square", vol: 0.12 })),
  monster: (ctx, s) => {
    tone(ctx, { freq: 140, endFreq: 55, start: s, dur: 1.0, type: "sawtooth", vol: 0.25 });
    tone(ctx, { freq: 147, endFreq: 58, start: s, dur: 1.0, type: "sawtooth", vol: 0.18 });
  }
};

function playSound(name, times = 1) {
  if (!SOUNDS[name]) return; // "none" או צליל לא מוכר
  try {
    const ctx = getCtx();
    for (let i = 0; i < times; i++) SOUNDS[name](ctx, ctx.currentTime + 0.05 + i * (SOUND_LEN[name] + 0.15));
  } catch {}
}

// ממלא את כל רשימות הצלילים בשפה הנוכחית, ושומר את הבחירה
const SOUND_SELECTS = { timerSound: "beep", swSound: "beep", remSound: "chime" };
function fillSoundSelects() {
  Object.entries(SOUND_SELECTS).forEach(([id, fallback]) => {
    const sel = $(id);
    const current = sel.value || store.get("monstertime-" + id, fallback);
    sel.innerHTML = "";
    SOUND_KEYS.forEach(key => {
      const opt = document.createElement("option");
      opt.value = key;
      opt.textContent = t(SOUND_LABEL[key]);
      sel.appendChild(opt);
    });
    sel.value = SOUND_KEYS.includes(current) ? current : fallback;
  });
}
Object.keys(SOUND_SELECTS).forEach(id => {
  $(id).addEventListener("change", e => store.set("monstertime-" + id, e.target.value));
});
document.querySelectorAll("[data-test]").forEach(btn => {
  btn.addEventListener("click", () => playSound($(btn.dataset.test).value));
});

// ===== תזכורות =====
// כל תזכורת: { id, label, time: "HH:MM", zone: "local" או אזור זמן, sound, at: מתי היא תצלצל, done }
let reminders = store.get("monstertime-reminders", []);
const saveReminders = () => store.set("monstertime-reminders", reminders);
const placeName = zone => (zone === "local" ? t("remLocal") : cityName(zone));

// מחשב מתי השעה שנבחרה תגיע בפעם הבאה במקום שנבחר
function nextOccurrence(time, zone) {
  const [h, m] = time.split(":").map(Number);
  const now = Date.now();
  for (let add = 0; add < 3; add++) {
    const base = new Date(now + add * 86400000);
    let at;
    if (zone === "local") {
      at = new Date(base.getFullYear(), base.getMonth(), base.getDate(), h, m, 0, 0).getTime();
    } else {
      const p = new Intl.DateTimeFormat("en-US", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" })
        .formatToParts(base).reduce((o, x) => (o[x.type] = x.value, o), {});
      const wall = Date.UTC(+p.year, +p.month - 1, +p.day, h, m);
      at = wall - zoneOffsetMinutes(zone, new Date(wall)) * 60000;
      at = wall - zoneOffsetMinutes(zone, new Date(at)) * 60000;
    }
    if (at > now + 1000) return at;
  }
  return now + 86400000;
}

function durationText(ms) {
  if (ms < 60000) return t("lessMinute");
  const totalMin = Math.round(ms / 60000);
  const h = Math.floor(totalMin / 60), m = totalMin % 60;
  return (h ? t("hShort", { n: h }) : "") + (h && m ? t("and") : "") + (m ? t("mShort", { n: m }) : "");
}

function fillZoneSelect() {
  const sel = $("remZone");
  const current = sel.value || "local";
  sel.innerHTML = "";
  ["local", ...ALL_ZONES].forEach(zone => {
    const opt = document.createElement("option");
    opt.value = zone;
    opt.textContent = placeName(zone);
    sel.appendChild(opt);
  });
  sel.value = current;
}

function renderReminders() {
  fillZoneSelect();
  const box = $("reminders");
  box.innerHTML = "";
  if (reminders.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-cities";
    empty.textContent = t("noReminders");
    box.appendChild(empty);
    return;
  }
  [...reminders].sort((a, b) => a.at - b.at).forEach(r => {
    const row = document.createElement("div");
    row.className = "city reminder" + (r.done ? " done" : "");
    const info = document.createElement("div");
    const name = document.createElement("div");
    name.className = "city-name";
    name.textContent = r.label || t("remDefault"); // textContent ולא innerHTML, כדי שאי אפשר יהיה להכניס קוד
    const meta = document.createElement("div");
    meta.className = "city-meta";
    meta.textContent = `${placeName(r.zone)} · 🔊 ${t(SOUND_LABEL[r.sound] || "soundNone")}`;
    info.append(name, meta);
    const right = document.createElement("div");
    right.className = "city-right";
    const when = document.createElement("div");
    when.className = "rem-when";
    const time = document.createElement("div");
    time.className = "city-time";
    time.textContent = r.time;
    const left = document.createElement("div");
    left.className = "city-meta";
    left.dataset.remIn = r.id;
    when.append(time, left);
    const del = document.createElement("button");
    del.className = "remove";
    del.dataset.removeRem = r.id;
    del.textContent = "✕";
    del.setAttribute("aria-label", t("remove", { city: r.label || t("remDefault") }));
    right.append(when, del);
    row.append(info, right);
    box.appendChild(row);
  });
  updateReminderCountdowns();
}

function updateReminderCountdowns() {
  const now = Date.now();
  document.querySelectorAll("[data-rem-in]").forEach(el => {
    const r = reminders.find(x => x.id === el.dataset.remIn);
    if (!r) return;
    el.textContent = r.done ? t("remDone") : t("remIn", { t: durationText(r.at - now) });
  });
}

function checkReminders() {
  const now = Date.now();
  let changed = false;
  reminders.forEach(r => {
    if (r.done || now < r.at) return;
    r.done = true;
    changed = true;
    const label = r.label || t("remDefault");
    toast(`${t("remDone")} ${label}`);
    playSound(r.sound, 3);
    document.title = `${t("remDone")} · MonsterTime`;
    try {
      if ("Notification" in window && Notification.permission === "granted") new Notification(t("remDone"), { body: label });
    } catch {}
  });
  if (changed) { saveReminders(); renderReminders(); }
  else updateReminderCountdowns();
}

$("remForm").addEventListener("submit", e => {
  e.preventDefault();
  const time = $("remTime").value;
  if (!time) { toast(t("chooseRemTime")); return; }
  const zone = $("remZone").value;
  reminders.push({
    id: String(Date.now()),
    label: $("remLabel").value.trim().slice(0, 80),
    time, zone,
    sound: $("remSound").value,
    at: nextOccurrence(time, zone),
    done: false
  });
  saveReminders();
  $("remLabel").value = "";
  renderReminders();
  // מבקש רשות להודעות של הדפדפן, כדי שהתזכורת תופיע גם כשהלשונית ברקע
  try { if ("Notification" in window && Notification.permission === "default") Notification.requestPermission(); } catch {}
});

$("reminders").addEventListener("click", e => {
  const id = e.target.dataset.removeRem;
  if (!id) return;
  reminders = reminders.filter(r => r.id !== id);
  saveReminders();
  renderReminders();
});

// ===== התחלה =====
if (MONSTERFAMILY_URL) {
  $("familyLink").href = MONSTERFAMILY_URL;
  $("familyLink").hidden = false;
}
$("year").textContent = new Date().getFullYear();
applyLanguage();
showView(location.hash.slice(1));
setTimerFromInputs();
drawSw();
setInterval(tickClock, 1000);
setInterval(checkReminders, 1000);

// הפריטים בתפריט הלחיצה הימנית של MonsterTime
function ctxItems() {
  return [
    { label: t("tabTimer"), action: () => { location.hash = "timer"; } },
    { label: t("tabStopwatch"), action: () => { location.hash = "stopwatch"; } },
    { label: t("tabClock"), action: () => { location.hash = "clock"; } },
    { label: t("tabReminders"), action: () => { location.hash = "reminders"; } },
    "sep",
    { label: "⚙️ " + t("settings"), action: () => setSettingsOpen(true) },
    { label: t("ctxCopyLink"), action: copyLink },
    { label: t("ctxReload"), action: () => location.reload() }
  ];
}

// ===== תפריט לחיצה ימנית של MonsterFamily =====
// בשדות הקלדה ובטקסט מסומן נשאר התפריט הרגיל של הדפדפן, כדי שאפשר יהיה להעתיק ולהדביק
const ctxMenu = document.getElementById("ctxMenu");

function closeCtx() { ctxMenu.hidden = true; }

function openCtx(x, y) {
  ctxMenu.innerHTML = "";
  ctxItems().forEach(item => {
    if (item === "sep") {
      const hr = document.createElement("div");
      hr.className = "ctx-sep";
      ctxMenu.appendChild(hr);
      return;
    }
    const b = document.createElement("button");
    b.className = "ctx-item";
    b.setAttribute("role", "menuitem");
    b.textContent = item.label;
    b.addEventListener("click", e => {
      e.stopPropagation();
      closeCtx();
      item.action();
    });
    ctxMenu.appendChild(b);
  });
  ctxMenu.hidden = false;
  // שומר שהתפריט לא יצא מהמסך
  const r = ctxMenu.getBoundingClientRect();
  // בשפות מימין לשמאל התפריט נפתח לצד שמאל של העכבר, כמו בתפריט הרגיל
  const startX = document.documentElement.dir === "rtl" ? x - r.width : x;
  ctxMenu.style.left = Math.max(8, Math.min(startX, innerWidth - r.width - 8)) + "px";
  ctxMenu.style.top = Math.max(8, Math.min(y, innerHeight - r.height - 8)) + "px";
  ctxMenu.querySelector(".ctx-item")?.focus();
}

async function copyLink() {
  try {
    await navigator.clipboard.writeText(location.href);
    toast(t("ctxCopied"));
  } catch {
    toast(location.href);
  }
}

document.addEventListener("contextmenu", e => {
  const typing = e.target.closest("input, textarea, select, [contenteditable='true']");
  const selected = String(window.getSelection()).trim();
  if (typing || selected) return;
  e.preventDefault();
  openCtx(e.clientX, e.clientY);
});
document.addEventListener("click", e => { if (!ctxMenu.contains(e.target)) closeCtx(); });
document.addEventListener("keydown", e => {
  if (ctxMenu.hidden) return;
  if (e.key === "Escape") return closeCtx();
  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    e.preventDefault();
    const items = [...ctxMenu.querySelectorAll(".ctx-item")];
    const i = items.indexOf(document.activeElement);
    const next = e.key === "ArrowDown" ? (i + 1) % items.length : (i - 1 + items.length) % items.length;
    items[next].focus();
  }
});
["scroll", "resize", "blur"].forEach(ev => window.addEventListener(ev, closeCtx));
