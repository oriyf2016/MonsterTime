// ===== הגדרות =====
// כשיהיה לאתר הראשי כתובת קבועה, שמים אותה כאן והקישור "חלק מ-MonsterFamily" יופיע למעלה
const MONSTERFAMILY_URL = "";

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
  $("langSelect").value = lang;
  drawLaps();
  renderCities();
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

// צפצוף כשהטיימר נגמר
function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.35, 0.7].forEach(offset => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + offset);
      gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + offset + 0.28);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + offset);
      osc.stop(ctx.currentTime + offset + 0.3);
    });
  } catch {}
}

// ===== לשוניות =====
const VIEWS = ["timer", "stopwatch", "clock"];
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
  beep();
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
