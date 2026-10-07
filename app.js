'use strict';

/* =====================================================================
   Segédek
   ===================================================================== */
const $ = (s, r = document) => r.querySelector(s);
const rnd = Math.round;
const pad = n => String(n).padStart(2, '0');
const sum = a => a.reduce((x, y) => x + y, 0);
const mean = a => sum(a) / a.length;
const median = a => { const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtMm = v => v < 0.05 ? '0' : v < 10 ? v.toFixed(1).replace('.', ',') : String(rnd(v));
const deg = v => `${rnd(v)}°`;

const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* tele a tár: nem baj */ } }
};

const DOW = ['Vasárnap', 'Hétfő', 'Kedd', 'Szerda', 'Csütörtök', 'Péntek', 'Szombat'];
const MONTHS = ['jan.', 'febr.', 'márc.', 'ápr.', 'máj.', 'jún.', 'júl.', 'aug.', 'szept.', 'okt.', 'nov.', 'dec.'];
const parseDate = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const dateLabel = s => { const d = parseDate(s); return `${MONTHS[d.getMonth()]} ${d.getDate()}.`; };
const joinHu = a => a.length < 2 ? (a[0] || '') : a.slice(0, -1).join(', ') + ' és ' + a[a.length - 1];
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

/* ===== hőmérséklet-színskála (az egész app ezt használja) ===== */
const RAMP = [
  [-12, [91, 74, 216]], [-2, [61, 123, 240]], [6, [38, 176, 214]], [13, [60, 194, 160]],
  [18, [155, 207, 74]], [23, [242, 194, 48]], [28, [245, 146, 43]], [33, [236, 90, 58]], [40, [196, 42, 82]]
];
function tempRGB(t) {
  if (t <= RAMP[0][0]) return RAMP[0][1];
  for (let i = 1; i < RAMP.length; i++) {
    if (t <= RAMP[i][0]) {
      const [t0, c0] = RAMP[i - 1], [t1, c1] = RAMP[i], f = (t - t0) / (t1 - t0);
      return c0.map((v, k) => Math.round(v + (c1[k] - v) * f));
    }
  }
  return RAMP[RAMP.length - 1][1];
}
const rgb = c => `rgb(${c.join(',')})`;
const tempColor = t => rgb(tempRGB(t));
const lum = ([r, g, b]) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
const onColor = c => lum(c) > 0.6 ? '#13201E' : '#FFFFFF';

/* ===== időjárás-kódok ===== */
const WMO = {
  0: ['Tiszta', 'clear'], 1: ['Többnyire tiszta', 'clear'], 2: ['Változóan felhős', 'partly'], 3: ['Borult', 'cloud'],
  45: ['Köd', 'fog'], 48: ['Zúzmarás köd', 'fog'],
  51: ['Gyenge szitálás', 'drizzle'], 53: ['Szitálás', 'drizzle'], 55: ['Erős szitálás', 'drizzle'],
  56: ['Ónos szitálás', 'drizzle'], 57: ['Erős ónos szitálás', 'drizzle'],
  61: ['Gyenge eső', 'rain'], 63: ['Eső', 'rain'], 65: ['Erős eső', 'rain'], 66: ['Ónos eső', 'rain'], 67: ['Erős ónos eső', 'rain'],
  71: ['Gyenge havazás', 'snow'], 73: ['Havazás', 'snow'], 75: ['Erős havazás', 'snow'], 77: ['Hószemcsék', 'snow'],
  80: ['Gyenge zápor', 'rain'], 81: ['Zápor', 'rain'], 82: ['Heves zápor', 'rain'],
  85: ['Hózápor', 'snow'], 86: ['Erős hózápor', 'snow'],
  95: ['Zivatar', 'thunder'], 96: ['Zivatar jégesővel', 'thunder'], 99: ['Erős zivatar jégesővel', 'thunder']
};
const wmo = c => WMO[c] || ['Változékony', 'partly'];
const isSnow = c => (c >= 71 && c <= 77) || c === 85 || c === 86;
const iconName = (kind, isDay = true) => kind === 'clear' ? (isDay ? 'sun' : 'moon') : kind === 'partly' ? (isDay ? 'partly' : 'partly-night') : kind;
const ic = (name, cls = '') => `<svg class="ic ${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
const cloudCode = c => c < 20 ? 0 : c < 70 ? 2 : 3;

/* =====================================================================
   Állapot
   ===================================================================== */
const DEFAULT_PLACE = { name: 'Debrecen', admin1: 'Hajdú-Bihar', country: 'Magyarország', latitude: 47.53, longitude: 21.6273 };
const S = {
  place: store.get('wx.place', DEFAULT_PLACE),
  raw: null, fetchedAt: 0, model: null,
  dayIndex: 0, hourSel: null, firstLoad: true, loading: false
};

/* =====================================================================
   Adatlekérés
   ===================================================================== */
const API = 'https://api.open-meteo.com/v1/forecast';
const MODELS = ['ecmwf_ifs025', 'icon_seamless', 'gfs_seamless', 'meteofrance_seamless'];

async function getJSON(url, ms = 12000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctl.signal });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  } finally { clearTimeout(t); }
}

async function fetchForecast(p) {
  const base = `${API}?latitude=${p.latitude}&longitude=${p.longitude}&timezone=auto&forecast_days=16`;
  const mainUrl = base +
    '&current=temperature_2m,apparent_temperature,weather_code,is_day' +
    '&hourly=temperature_2m,apparent_temperature,precipitation_probability,precipitation,weather_code,wind_speed_10m,wind_gusts_10m,uv_index,cloud_cover,is_day' +
    '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_gusts_10m_max,uv_index_max,sunrise,sunset';
  // Több időjárási modell: ebből számolunk konszenzust és megbízhatóságot.
  const multiUrl = base + '&models=' + MODELS.join(',') +
    '&hourly=temperature_2m,precipitation&daily=temperature_2m_max,temperature_2m_min,precipitation_sum';

  const mainP = getJSON(mainUrl).catch(() => getJSON(mainUrl)); // egy újrapróbálkozás
  const multiP = getJSON(multiUrl, 15000).catch(() => null);      // opcionális
  const [main, multi] = await Promise.all([mainP, multiP]);
  return { main, multi };
}

/* =====================================================================
   Modell: nyers adat -> napok, órák
   ===================================================================== */
function buildModel(raw) {
  const { main, multi } = raw;
  const D = main.daily, H = main.hourly;
  const offMs = (main.utc_offset_seconds || 0) * 1000;
  const nowLocal = new Date(Date.now() + offMs).toISOString().slice(0, 16); // a hely helyi ideje
  const today = nowLocal.slice(0, 10);
  const nowH = +nowLocal.slice(11, 13);
  let d0 = D.time.indexOf(today);
  const stale = d0 < 0;
  if (stale) d0 = 0;

  const mv = (group, key, i) => {
    const out = [];
    if (!multi || !multi[group]) return out;
    for (const m of MODELS) { const v = multi[group][`${key}_${m}`]?.[i]; if (typeof v === 'number') out.push(v); }
    return out;
  };

  const days = [];
  for (let abs = d0; abs < D.time.length; abs++) {
    const i = abs - d0;
    const tmaxs = mv('daily', 'temperature_2m_max', abs);
    const tmins = mv('daily', 'temperature_2m_min', abs);
    const mms = mv('daily', 'precipitation_sum', abs);
    const n = tmaxs.length;
    // Közeli napokra a legjobb helyi modell (best_match), távolabbra a modellek mediánja.
    const cons = i >= 3 && n >= 2 && tmins.length >= 2;
    const tmax = cons ? median(tmaxs) : D.temperature_2m_max[abs];
    const tmin = cons ? median(tmins) : D.temperature_2m_min[abs];
    const shift = cons ? ((tmax - D.temperature_2m_max[abs]) + (tmin - D.temperature_2m_min[abs])) / 2 : 0;
    const mm = cons && mms.length >= 2 ? mean(mms) : (D.precipitation_sum[abs] ?? 0);

    const wetFrac = mms.length >= 2 ? mms.filter(v => v >= 1).length / mms.length : null;
    const agree = wetFrac === null ? null : Math.max(wetFrac, 1 - wetFrac);
    const spread = n >= 2 ? Math.max(...tmaxs) - Math.min(...tmaxs) : null;

    let prob = D.precipitation_probability_max?.[abs];
    if (prob == null) prob = wetFrac !== null ? rnd(wetFrac * 100) : (mm >= 1 ? 70 : mm >= 0.2 ? 40 : 10);

    let conf;
    if (n >= 2) {
      conf = 3;
      if (i >= 4 || spread > 2.5 || (agree !== null && agree < 0.75)) conf = 2;
      if (i >= 8 || spread > 5 || (agree !== null && agree < 0.6)) conf = 1;
    } else conf = i <= 2 ? 3 : i <= 6 ? 2 : 1;

    days.push({
      i, abs, date: D.time[abs], code: D.weather_code[abs],
      tmax, tmin, shift, mm, prob, conf, spread,
      gust: D.wind_gusts_10m_max?.[abs] ?? 0, uv: D.uv_index_max?.[abs] ?? 0,
      sunrise: D.sunrise?.[abs], sunset: D.sunset?.[abs]
    });
  }

  const model = { main, days, H, nowH, nowIso: nowLocal.slice(0, 13), today, stale, nModels: MODELS.filter(m => multi?.daily?.[`temperature_2m_max_${m}`]?.some(v => typeof v === 'number')).length };

  // napi összegző adatok az órákból (ikon, felhősség, nedves-e a nap)
  for (const d of days) {
    const hs = hoursOf(model, d, 6, 22);
    const dayHs = hoursOf(model, d, 8, 19);
    d.cloud = mean(dayHs.map(h => h.cloud));
    d.wet = (d.mm >= 1 && d.prob >= 40) || d.mm >= 3 || (d.prob >= 60 && d.mm >= 0.5) || hs.filter(wet).length >= 3;
    d.snow = d.wet && isSnow(d.code);
    d.thunder = d.wet && d.code >= 95;
    d.gust = Math.max(d.gust, ...hs.map(h => h.gust));
    let code;
    if (d.wet) code = d.code >= 51 ? d.code : 61;
    else code = [45, 48].includes(d.code) ? d.code : cloudCode(d.cloud);
    d.icon = iconName(wmo(code)[1], true);
    d.kindText = d.thunder ? 'zivatar' : d.snow ? 'havazás' : d.wet ? 'esős' : d.cloud < 25 ? 'napos' : d.cloud < 65 ? 'változóan felhős' : 'borult';
    d.nice = !d.wet && d.prob < 35 && d.tmax >= 17 && d.tmax <= 29 && d.gust < 45 && d.cloud < 65;
  }
  return model;
}

function hr(model, day, h) {
  const i = day.abs * 24 + h, H = model.H, s = day.shift;
  const mm = H.precipitation[i] ?? 0;
  let prob = H.precipitation_probability?.[i];
  if (prob == null) prob = mm >= 1 ? 70 : mm >= 0.2 ? 45 : mm > 0 ? 25 : 5;
  return {
    h, t: (H.temperature_2m[i] ?? 0) + s, f: (H.apparent_temperature[i] ?? H.temperature_2m[i] ?? 0) + s,
    prob, mm, code: H.weather_code[i] ?? 0, wind: H.wind_speed_10m[i] ?? 0, gust: H.wind_gusts_10m[i] ?? 0,
    uv: H.uv_index[i] ?? 0, cloud: H.cloud_cover[i] ?? 50, isDay: H.is_day[i] === 1
  };
}
function hoursOf(model, day, lo, hi) {
  const out = [];
  for (let h = lo; h <= hi; h++) out.push(hr(model, day, h));
  return out;
}
const wet = h => (h.prob >= 45 && h.mm >= 0.1) || h.mm >= 0.5 || (h.prob >= 60 && h.mm >= 0.05) || (h.code >= 95 && h.prob >= 30);

/* =====================================================================
   Döntési motor: mit vigyek / mit vegyek fel?
   ===================================================================== */
const PARTS = [
  { k: 'morning', name: 'Reggel', adv: 'reggel', from: 6, to: 10 },
  { k: 'noon', name: 'Dél', adv: 'délben', from: 10, to: 14 },
  { k: 'afternoon', name: 'Délután', adv: 'délután', from: 14, to: 18 },
  { k: 'evening', name: 'Este', adv: 'este', from: 18, to: 23 }
];

function activeRange(model, dayIdx) {
  let lo = 6, hi = 22;
  if (dayIdx === 0) lo = Math.max(6, model.nowH);
  if (lo > hi) { lo = model.nowH; hi = 23; }
  return [lo, hi];
}

function repCode(hs, wetHs) {
  if (wetHs.length) {
    if (wetHs.some(h => h.code >= 95)) return wetHs.find(h => h.code >= 95).code;
    const top = wetHs.reduce((a, b) => b.mm > a.mm ? b : a);
    if (top.code >= 51) return top.code;
    return top.mm >= 2 ? 63 : top.mm >= 0.5 ? 61 : 51;
  }
  const fogN = hs.filter(h => h.code === 45 || h.code === 48).length;
  if (fogN > hs.length / 2) return 45;
  return cloudCode(mean(hs.map(h => h.cloud)));
}

function partStats(hs) {
  const wetHs = hs.filter(wet);
  const f = hs.map(h => h.f), t = hs.map(h => h.t);
  return {
    tmin: Math.min(...t), tmax: Math.max(...t), fmin: Math.min(...f), fmax: Math.max(...f), favg: mean(f),
    prob: Math.max(...hs.map(h => h.prob)), mm: sum(hs.map(h => h.mm)), wetN: wetHs.length,
    code: repCode(hs, wetHs), isDay: hs.filter(h => h.isDay).length >= hs.length / 2
  };
}

function adviseRain(hs, lo, hi) {
  const wins = [];
  let cur = null;
  for (const h of hs) {
    if (!wet(h)) continue;
    if (cur && h.h - cur.to <= 1) {
      cur.to = h.h + 1; cur.mm += h.mm; cur.peak = Math.max(cur.peak, h.mm); cur.prob = Math.max(cur.prob, h.prob);
      cur.snow = cur.snow || isSnow(h.code); cur.thunder = cur.thunder || h.code >= 95;
    } else {
      cur = { from: h.h, to: h.h + 1, mm: h.mm, peak: h.mm, prob: h.prob, snow: isSnow(h.code), thunder: h.code >= 95 };
      wins.push(cur);
    }
  }
  const maxH = hs.reduce((a, b) => b.prob > a.prob ? b : a);
  const span = hi - lo + 1;

  if (!wins.length) {
    if (maxH.prob >= 30) {
      return { level: 'maybe', title: 'Tedd el a kis esernyőt',
        lines: [`Kis eséllyel (${maxH.prob}%) csepereghet ${maxH.h} óra körül.`] };
    }
    return { level: 'no', title: 'Nem kell esernyő',
      lines: [maxH.prob < 10 ? 'Végig száraz marad.' : `Száraz marad, legfeljebb ${maxH.prob}% az esély.`] };
  }

  const snow = wins.some(w => w.snow), thunder = wins.some(w => w.thunder);
  const what = w => {
    const adj = w.peak < 0.5 ? 'szemerkélő' : w.peak < 2.5 ? 'mérsékelt' : w.peak < 7 ? 'erős' : 'felhőszakadásszerű';
    return `${adj} ${w.snow ? 'havazás' : 'eső'}`;
  };
  const lines = wins.slice(0, 3).map(w => {
    const all = (w.to - w.from) >= span * 0.8;
    const when = all ? 'Egész nap' : `${w.from}–${w.to} óra között`;
    return `${when}: ${what(w)}, kb. ${fmtMm(w.mm)} mm.`;
  });
  if (wins.length > 3) lines.push('És még néhány záporablak később.');
  return {
    level: 'yes',
    title: thunder ? 'Zivatar jöhet, vidd az esernyőt' : snow ? 'Havazás lesz' : 'Vidd az esernyőt',
    lines, snow, thunder
  };
}

const WEAR = [
  [-5, 'télikabát, sál, sapka'], [2, 'télikabát és sapka'], [8, 'meleg kabát'], [13, 'dzseki'],
  [17, 'pulcsi'], [21, 'vékony hosszú ujjú'], [26, 'póló'], [31, 'rövid, szellős ruha'], [99, 'minél könnyebb ruha']
];
const wearShort = f => WEAR.find(([max]) => f <= max)[1];

function adviseWear(parts) {
  const act = parts.filter(p => p.s);
  const cold = act.filter(p => p.s.favg <= 17);
  const warm = act.filter(p => p.s.favg > 17);
  const favgs = act.map(p => p.s.favg);
  const walk = 'Hőérzet: ' + act.map(p => `${p.adv} ${deg(p.s.favg)}`).join(', ') + '.';
  const minF = Math.min(...act.map(p => p.s.fmin));

  if (cold.length && warm.length && Math.max(...favgs) - Math.min(...favgs) >= 4) {
    const cf = Math.min(...cold.map(p => p.s.fmin)), wf = mean(warm.map(p => p.s.favg));
    return {
      need: true, icon: 'sweater', ref: cf,
      title: 'Rétegesen öltözz',
      lines: [`${cap(joinHu(cold.map(p => p.adv)))} ${wearShort(cf)}, ${joinHu(warm.map(p => p.adv))} ${wearShort(wf)}.`, walk]
    };
  }
  const avg = mean(favgs);
  if (avg <= 17) {
    const lvl = (avg + minF) / 2; // a hűvösebb órákat is beleszámoljuk
    const title = lvl <= 2 ? 'Öltözz nagyon melegen' : lvl <= 8 ? 'Meleg kabát kell' : lvl <= 13 ? 'Dzseki vagy vastag pulcsi kell' : 'Pulcsi kell';
    return { need: true, icon: lvl <= 8 ? 'coat' : 'sweater', ref: minF, title, lines: [`Egész nap hűvös. ${walk}`] };
  }
  const warmest = Math.max(...act.map(p => p.s.fmax));
  let title, icon = 'shirt';
  if (avg <= 21) title = 'Pulcsi nem kell';
  else if (avg <= 26) title = 'Póló elég';
  else if (avg <= 31) title = 'Rövid, szellős ruha';
  else title = 'Nagyon meleg lesz';
  return { need: false, icon, ref: avg, title, lines: [warmest >= 30 ? 'Vigyél vizet, árnyékban jobb.' : `Egész nap kellemes: ${wearShort(avg)}.`, walk] };
}

function adviseExtras(hs, day) {
  const out = [];
  const maxF = Math.max(...hs.map(h => h.f)), minT = Math.min(...hs.map(h => h.t));
  if (maxF >= 30) out.push({ k: 'heat', icon: 'heat', c: [236, 90, 58], title: 'Hőség van', lines: [`Hőérzet akár ${deg(maxF)}. Igyál sokat, kerüld a déli napot.`] });
  if (minT <= 0.5) out.push({ k: 'frost', icon: 'frost', c: [61, 123, 240], title: 'Fagyos lehet', lines: [`Minimum ${deg(minT)}. Az autón jég lehet, a csúszós utakra figyelj.`] });
  const gust = Math.max(...hs.map(h => h.gust));
  if (gust >= 40) out.push({ k: 'wind', icon: 'wind', c: [60, 80, 96], title: gust >= 60 ? 'Viharos széllökések' : 'Szeles lesz', lines: [`Széllökés akár ${rnd(gust)} km/h.${gust >= 60 ? ' A nagy fákat és állványokat kerüld.' : ''}`] });
  const uv = Math.max(...hs.filter(h => h.h >= 9 && h.h <= 17).map(h => h.uv), 0);
  if (uv >= 6) out.push({ k: 'uv', icon: 'uv', c: [240, 164, 23], title: 'Napszemüveg és napkrém', lines: [`Erős UV-sugárzás (${rnd(uv)}), főleg 11 és 15 óra között.`] });
  else if (uv >= 3 && day.cloud < 70) out.push({ k: 'uv', icon: 'uv', c: [240, 164, 23], title: 'Napszemüveg jól jön', lines: [`Mérsékelt UV (${rnd(uv)}). Hosszabb kint tartózkodásnál napkrém.`] });
  return out;
}

function headline(rain, wear, extras) {
  const u = rain.level, s = wear.need;
  if (rain.snow) return s ? 'Havazás lesz, öltözz melegen' : 'Havazás lesz';
  if (u === 'yes') return s ? 'Esernyő és pulcsi kell' : 'Esernyő kell, pulcsi nem';
  if (u === 'maybe') return s ? 'Pulcsi kell, esernyő talán' : 'Esernyő talán, pulcsi nem';
  if (extras.some(e => e.k === 'heat')) return 'Meleg nap, könnyű ruha és sok víz';
  return s ? 'Pulcsi kell, esernyő nem' : 'Se esernyő, se pulcsi';
}

function advise(model, dayIdx) {
  const day = model.days[dayIdx];
  const [lo, hi] = activeRange(model, dayIdx);
  const hs = hoursOf(model, day, lo, hi);
  const rain = adviseRain(hs, lo, hi);
  const parts = PARTS.map(p => {
    const a = Math.max(p.from, lo), b = Math.min(p.to - 1, hi);
    const full = hoursOf(model, day, p.from, p.to - 1);
    const live = a <= b ? hoursOf(model, day, a, b) : null;
    return { ...p, full, s: live ? partStats(live) : null, sFull: partStats(full), past: !live };
  });
  let wearParts = parts.filter(p => p.s);
  if (!wearParts.length) wearParts = parts.map(p => ({ ...p, s: p.sFull }));
  const wear = adviseWear(wearParts);
  const extras = adviseExtras(hs, day);
  return { day, lo, hi, hs, rain, wear, extras, parts, headline: headline(rain, wear, extras) };
}

/* =====================================================================
   Megjelenítés
   ===================================================================== */
function confBars(level) {
  const label = ['', 'Bizonytalan', 'Valószínű', 'Biztos'][level];
  return `<span class="conf" role="img" aria-label="${label}" title="${label}">${[1, 2, 3].map(n => `<i class="${n <= level ? 'on' : ''}"></i>`).join('')}</span>`;
}

function dayName(day, i) {
  if (i === 0) return 'Ma';
  if (i === 1) return 'Holnap';
  return DOW[parseDate(day.date).getDay()];
}

function checkRow({ icon, title, lines, need, c }) {
  const style = need && c ? `--c:${rgb(c)};--on:${onColor(c)}` : '';
  return `<li class="check ${need ? 'need' : ''}" style="${style}">
    <span class="badge">${ic(icon)}</span>
    <div><h3>${esc(title)}</h3>${lines.map(l => `<p>${esc(l)}</p>`).join('')}</div>
  </li>`;
}

function renderHero() {
  const M = S.model, A = S.adv, day = A.day, i = S.dayIndex;
  const tabs = [0, 1, 2].map(n => ({ n, label: n === 0 ? 'Ma' : n === 1 ? 'Holnap' : 'Holnapután' }));
  if (i > 2) tabs.push({ n: i, label: `${DOW[parseDate(day.date).getDay()]}, ${dateLabel(day.date)}` });
  const tabsHtml = tabs.map(t => `<button class="tab" data-day="${t.n}" aria-pressed="${t.n === i}">${esc(t.label)}</button>`).join('');

  let nowHtml;
  if (i === 0) {
    const cur = M.main.current;
    const cc = cur?.weather_code ?? 0;
    nowHtml = `Most <b>${deg(cur?.temperature_2m ?? hr(M, day, M.nowH).t)}</b>, érzet ${deg(cur?.apparent_temperature ?? hr(M, day, M.nowH).f)}, ${wmo(cc)[0].toLowerCase()}.` +
      (A.lo > 6 ? `<span class="note">Az összegzés ${A.lo} órától estig szól.</span>` : '');
  } else {
    nowHtml = `<b>${DOW[parseDate(day.date).getDay()]}, ${dateLabel(day.date)}</b> Várhatóan ${deg(day.tmin)} és ${deg(day.tmax)} között.`;
  }

  const rows = [
    { icon: 'umbrella', need: A.rain.level === 'yes', title: A.rain.title, lines: A.rain.lines, c: [31, 87, 245] },
    { icon: A.wear.icon, need: A.wear.need, title: A.wear.title, lines: A.wear.lines, c: tempRGB(A.wear.ref) },
    ...A.extras.map(e => ({ ...e, need: true }))
  ];
  if (A.rain.level === 'maybe') rows[0].need = false;
  // a "talán" esernyő is kapjon hangsúlyt, de halványabban
  const checks = rows.map(r => checkRow(r)).join('');

  let confHtml = '';
  if (i >= 3) {
    const word = ['', 'bizonytalan', 'valószínű', 'biztos'][day.conf];
    confHtml = `<p class="conf-note">${confBars(day.conf)}<span>Ez ${i} nappal előre van, ezért ${word} az előrejelzés. Közelebb frissítsd újra.</span></p>`;
  } else if (day.conf < 3) {
    confHtml = `<p class="conf-note">${confBars(day.conf)}<span>A modellek kicsit eltérnek, nézz rá később is.</span></p>`;
  }

  $('#hero').innerHTML = `
    <div class="tabs" role="group" aria-label="Nap kiválasztása">${tabsHtml}</div>
    <p class="now">${nowHtml}</p>
    <h1 class="verdict">${esc(A.headline)}</h1>
    <ul class="checks">${checks}</ul>
    ${confHtml}`;
}

function renderParts() {
  const M = S.model, A = S.adv, day = A.day;
  const cols = A.parts.map(p => ({ p, s: p.sFull }));
  const stops = cols.map((c, k) => `${tempColor(c.s.favg)} ${((k + .5) / cols.length * 100).toFixed(0)}%`).join(',');
  const nowH = M.nowH;
  const html = cols.map(({ p, s }) => {
    const cur = S.dayIndex === 0 && nowH >= p.from && nowH < p.to;
    const wetP = s.wetN >= 1 || s.prob >= 50;
    const kind = wmo(s.code)[1];
    const range = rnd(s.tmin) === rnd(s.tmax) ? deg(s.tmax) : `${rnd(s.tmin)}–${rnd(s.tmax)}°`;
    const rain = wetP ? `${s.prob}%${s.mm >= 0.1 ? `<small>${fmtMm(s.mm)} mm</small>` : ''}` : (s.prob >= 20 ? `${s.prob}% eső` : 'száraz');
    return `<div class="part ${p.past ? 'past' : ''} ${cur ? 'cur' : ''}">
      <div class="pn">${p.name}</div><div class="ph">${p.from}–${p.to} óra</div>
      ${ic(iconName(kind, s.isDay))}
      <div class="pt">${range}</div>
      <div class="pr ${wetP ? 'wet' : ''}">${rain}</div>
    </div>`;
  }).join('');

  const sr = day.sunrise?.slice(11, 16), ss = day.sunset?.slice(11, 16);
  $('#parts').innerHTML = `
    <h2 class="sec-title">Napszakok</h2>
    <p class="sec-sub">${i0label()}</p>
    <div class="ribbon" style="background:linear-gradient(90deg,${stops})" aria-hidden="true"></div>
    <div class="pgrid">${html}</div>
    ${sr ? `<p class="sunline"><span>${ic('sunrise')}${sr}</span><span>${ic('sunset')}${ss}</span></p>` : ''}`;
}
function i0label() {
  const d = S.adv.day, i = S.dayIndex;
  return `${i === 0 ? 'Ma' : i === 1 ? 'Holnap' : cap(DOW[parseDate(d.date).getDay()])}, ${dateLabel(d.date)} Hőmérséklet és eső szakaszonként.`;
}

/* ---- óránkénti ábra ---- */
const COLW = 46, CH = 214;
function smoothPath(p) {
  let d = `M${p[0].x.toFixed(1)},${p[0].y.toFixed(1)}`;
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[i - 1] || p[i], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2] || p2;
    const c1x = p1.x + (p2.x - p0.x) / 6, c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6, c2y = p2.y - (p3.y - p1.y) / 6;
    d += `C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }
  return d;
}

function hourIcon(h) {
  const code = wet(h) ? (h.code >= 51 ? h.code : 61) : (h.code === 45 || h.code === 48 ? 45 : cloudCode(h.cloud));
  return { code, icon: iconName(wmo(code)[1], h.isDay) };
}

function renderHourly() {
  const M = S.model, day = S.adv.day, N = 24, W = COLW * N;
  const hs = hoursOf(M, day, 0, 23);
  const ts = hs.map(h => h.t), tmin = Math.min(...ts), tmax = Math.max(...ts), span = Math.max(3, tmax - tmin);
  const yT = t => 78 + (1 - (t - tmin) / span) * 44;
  const pts = hs.map((h, k) => ({ x: k * COLW + COLW / 2, y: yT(h.t) }));
  const stops = hs.map((h, k) => `<stop offset="${((k + .5) / N * 100).toFixed(1)}%" stop-color="${tempColor(h.t)}"/>`).join('');
  const isToday = S.dayIndex === 0;
  const BASE = 178;

  let back = '', front = '';
  hs.forEach((h, k) => { if (!h.isDay) back += `<rect class="night" x="${k * COLW}" y="0" width="${COLW}" height="${CH}"/>`; });
  back += `<rect class="sel" id="selrect" x="${(S.hourSel ?? 0) * COLW}" y="0" width="${S.hourSel == null ? 0 : COLW}" height="${CH}"/>`;
  if (isToday) back += `<line class="nowline" x1="${M.nowH * COLW + COLW / 2}" x2="${M.nowH * COLW + COLW / 2}" y1="34" y2="${BASE + 6}"/>`;

  hs.forEach((h, k) => {
    const cx = k * COLW + COLW / 2;
    back += `<use href="#i-${hourIcon(h).icon}" x="${cx - 14}" y="6" width="28" height="28"/>`;
    back += `<text class="tl" x="${cx}" y="${(pts[k].y - 12).toFixed(1)}">${rnd(h.t)}°</text>`;
    back += `<rect class="barbg" x="${cx - 11}" y="${BASE - 34}" width="22" height="34" rx="4"/>`;
    const bh = Math.max(h.prob > 0 ? 2 : 0, h.prob / 100 * 34);
    back += `<rect class="bar" x="${cx - 11}" y="${(BASE - bh).toFixed(1)}" width="22" height="${bh.toFixed(1)}" rx="4"/>`;
    if (h.mm >= 0.1) back += `<text class="ml" x="${cx}" y="${BASE + 13}">${fmtMm(h.mm)}</text>`;
    const now = isToday && h.h === M.nowH;
    back += `<text class="hl ${now ? 'now' : ''}" x="${cx}" y="${CH - 6}">${now ? 'most' : pad(h.h) + ':00'}</text>`;
    front += `<circle class="dot" cx="${cx}" cy="${pts[k].y.toFixed(1)}" r="3.6" stroke="${tempColor(h.t)}"/>`;
    front += `<rect class="hit" data-k="${k}" x="${k * COLW}" y="0" width="${COLW}" height="${CH}"/>`;
  });

  $('#hourly').innerHTML = `
    <h2 class="sec-title">Óráról órára</h2>
    <p class="sec-sub">A kék oszlop az eső esélye, alatta a mennyiség mm-ben. Koppints egy órára.</p>
    <div class="hscroll" id="hscroll">
      <svg class="hc" width="${W}" height="${CH}" viewBox="0 0 ${W} ${CH}" role="img" aria-label="Óránkénti hőmérséklet és csapadék">
        <defs><linearGradient id="tg" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${W}" y2="0">${stops}</linearGradient></defs>
        ${back}
        <path d="${smoothPath(pts)}" fill="none" stroke="url(#tg)" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
        ${front}
      </svg>
    </div>
    <div class="hdetail" id="hdetail"></div>`;

  const sel = $('#selrect');
  $('#hourly').querySelectorAll('.hit').forEach(r => r.addEventListener('click', () => {
    const k = +r.dataset.k;
    S.hourSel = k;
    sel.setAttribute('x', k * COLW); sel.setAttribute('width', COLW);
    hourDetail(hs[k]);
  }));
  const focus = S.hourSel != null ? S.hourSel : (isToday ? Math.max(0, M.nowH - 1) : 6);
  $('#hscroll').scrollLeft = Math.max(0, focus * COLW - 20);
  hourDetail(hs[S.hourSel != null ? S.hourSel : (isToday ? M.nowH : 12)]);
}

function hourDetail(h) {
  const [txt] = wmo(hourIcon(h).code);
  $('#hdetail').innerHTML = `<b>${pad(h.h)}:00, ${txt.toLowerCase()}</b>
    <div class="row">
      <span><b>${deg(h.t)}</b> (érzet ${deg(h.f)})</span>
      <span>Eső: <b>${h.prob}%</b>${h.mm >= 0.1 ? `, ${fmtMm(h.mm)} mm` : ''}</span>
      <span>Szél: <b>${rnd(h.wind)}</b> km/h, lökés ${rnd(h.gust)}</span>
    </div>`;
}

/* ---- tervező ---- */
function renderPlanner() {
  const M = S.model, days = M.days;
  const lo = Math.floor(Math.min(...days.map(d => d.tmin)) - 1), hi = Math.ceil(Math.max(...days.map(d => d.tmax)) + 1);
  const sp = Math.max(8, hi - lo);

  // összegzés: hétvége + következő szép nap
  const dow = d => parseDate(d.date).getDay();
  const short = d => `${d.kindText}, ${deg(d.tmax)}`;
  const wk = [];
  const first = days.findIndex(d => dow(d) === 6 || dow(d) === 0);
  if (first >= 0) {
    wk.push(days[first]);
    if (dow(days[first]) === 6 && days[first + 1]) wk.push(days[first + 1]);
  }
  const wkHtml = wk.length
    ? `<dd>${wk.map(d => `${cap(dayName(d, d.i))}: ${short(d)}`).join('<br>')}</dd>`
    : '<dd>nincs a következő napokban</dd>';
  const nice = days.find(d => d.nice);
  const niceHtml = nice
    ? `<dd>${cap(dayName(nice, nice.i))}<small>${dateLabel(nice.date)}, ${short(nice)}</small></dd>`
    : '<dd>Nincs a következő 16 napban<small>Száraz és 17–29° közötti nap</small></dd>';

  // hetek szerinti csoportok (hétfőtől vasárnapig)
  const d0dow = (dow(days[0]) + 6) % 7;
  const groups = [];
  days.forEach(d => {
    const w = Math.floor((d.i + d0dow) / 7);
    (groups[w] = groups[w] || []).push(d);
  });
  const gName = (g, w) => {
    if (w === 0) return 'Ezen a héten';
    if (w === 1) return 'Jövő héten';
    const a = parseDate(g[0].date), b = parseDate(g[g.length - 1].date);
    return `${MONTHS[a.getMonth()]} ${a.getDate()}–${a.getMonth() === b.getMonth() ? '' : MONTHS[b.getMonth()] + ' '}${b.getDate()}.`;
  };
  const gSum = g => {
    const wn = g.filter(d => d.wet).length;
    const t0 = Math.min(...g.map(d => d.tmin)), t1 = Math.max(...g.map(d => d.tmax));
    return `${wn ? wn + ' esős nap' : 'száraz'}, ${rnd(t0)}–${rnd(t1)}°`;
  };

  const rows = g => g.map(d => {
    const c0 = tempRGB(d.tmin), c1 = tempRGB(d.tmax), cm = tempRGB((d.tmin + d.tmax) / 2);
    const left = (d.tmin - lo) / sp * 100, width = Math.max(4, (d.tmax - d.tmin) / sp * 100);
    const wd = dow(d), we = wd === 6 || wd === 0;
    const rainTxt = d.prob < 10 && d.mm < 0.1 ? '–' : `${d.prob}%`;
    return `<button class="prow ${we ? 'we' : ''} ${d.i === S.dayIndex ? 'sel' : ''}" data-day="${d.i}" aria-label="${cap(dayName(d, d.i))}: ${d.kindText}, ${rnd(d.tmin)} és ${rnd(d.tmax)} fok között, eső esélye ${d.prob}%">
      <span class="pday"><b>${dayName(d, d.i)}</b><small>${dateLabel(d.date)}${confBars(d.conf)}</small></span>
      ${ic(d.icon)}
      <span class="prain ${d.wet ? 'wet' : ''}">${rainTxt}${d.mm >= 0.5 ? `<small>${fmtMm(d.mm)} mm</small>` : ''}</span>
      <span class="pbar"><span class="lo">${rnd(d.tmin)}°</span>
        <span class="track"><i style="left:${left.toFixed(1)}%;width:${width.toFixed(1)}%;background:linear-gradient(90deg,${rgb(c0)},${rgb(cm)},${rgb(c1)})"></i></span>
        <span class="hi">${rnd(d.tmax)}°</span></span>
    </button>`;
  }).join('');

  $('#planner').innerHTML = `
    <h2 class="sec-title">Előre tervezés</h2>
    <p class="sec-sub">A következő ${days.length} nap. Koppints egy napra, és fent megkapod a teljes összegzést.</p>
    <dl class="plan-sum">
      <div><dt>Következő hétvége</dt>${wkHtml}</div>
      <div><dt>Legközelebbi szép nap</dt>${niceHtml}</div>
    </dl>
    ${groups.map((g, w) => g ? `<div class="week"><h3>${gName(g, w)}<span>${gSum(g)}</span></h3>${rows(g)}</div>` : '').join('')}
    <p class="legend">${confBars(3)}<span>biztos</span>${confBars(2)}<span>valószínű</span>${confBars(1)}<span>bizonytalan</span></p>`;
}

function renderFoot() {
  const n = S.model.nModels;
  $('#foot').innerHTML = n >= 2
    ? `Adatok: Open-Meteo. A közelebbi napokat a legjobb helyi modell adja, a távolabbiakat ${n} nemzetközi modell (ECMWF, ICON, GFS, Météo-France) mediánja. A megbízhatóság jele azt mutatja, mennyire értenek egyet egymással.`
    : 'Adatok: Open-Meteo. A többmodelles összevetés most nem érhető el, a megbízhatóság csak a távolság alapján becsült.';
}

function renderAll() {
  const M = S.model;
  S.adv = advise(M, S.dayIndex);
  $('#placeName').textContent = S.place.name;
  renderHero(); renderParts(); renderHourly(); renderPlanner(); renderFoot();
  const t = new Date(S.fetchedAt);
  $('#stamp').textContent = S.fetchedAt ? `Frissítve ${pad(t.getHours())}:${pad(t.getMinutes())}` : '';
}

/* =====================================================================
   Betöltés
   ===================================================================== */
function showBanner(msg, err = false) {
  const b = $('#banner');
  if (!msg) { b.hidden = true; return; }
  b.textContent = msg; b.className = 'banner' + (err ? ' err' : ''); b.hidden = false;
}

function applyRaw(raw, fetchedAt) {
  S.raw = raw; S.fetchedAt = fetchedAt;
  S.model = buildModel(raw);
  if (S.firstLoad) { S.dayIndex = S.model.nowH >= 21 ? 1 : 0; S.firstLoad = false; }
  S.dayIndex = Math.min(S.dayIndex, S.model.days.length - 1);
  S.hourSel = null;
  renderAll();
}

async function load() {
  if (S.loading) return;
  S.loading = true;
  $('#refreshBtn').classList.add('spin');
  const cached = store.get('wx.cache', null);
  const same = cached && cached.place && cached.place.latitude === S.place.latitude && cached.place.longitude === S.place.longitude;
  if (!S.model && same) { try { applyRaw(cached.raw, cached.fetchedAt); } catch { /* sérült cache */ } }
  else if (!same) { S.model = null; $('#hero').innerHTML = '<p class="loading">Adatok betöltése…</p>'; ['parts', 'hourly', 'planner', 'foot'].forEach(id => $('#' + id).innerHTML = ''); }

  try {
    const raw = await fetchForecast(S.place);
    const at = Date.now();
    applyRaw(raw, at);
    store.set('wx.cache', { place: S.place, fetchedAt: at, raw });
    showBanner('');
  } catch (e) {
    console.error(e);
    if (S.model) {
      const t = new Date(S.fetchedAt);
      showBanner(`Nincs kapcsolat, a ${pad(t.getHours())}:${pad(t.getMinutes())}-kor mentett adatot látod.`);
    } else {
      $('#hero').innerHTML = '<p class="loading">Nem sikerült letölteni az előrejelzést. Ellenőrizd a netet, majd húzd le az oldalt, vagy koppints a frissítésre.</p>';
      showBanner('Hiba az adatok letöltésekor.', true);
    }
  } finally {
    S.loading = false;
    $('#refreshBtn').classList.remove('spin');
  }
}

/* =====================================================================
   Események
   ===================================================================== */
document.addEventListener('click', e => {
  const tab = e.target.closest('.tab');
  if (tab) { S.dayIndex = +tab.dataset.day; S.hourSel = null; renderAll(); return; }
  const row = e.target.closest('.prow');
  if (row) { S.dayIndex = +row.dataset.day; S.hourSel = null; renderAll(); window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); }
});
$('#refreshBtn').addEventListener('click', load);

/* ---- helyválasztó ---- */
const sheet = $('#sheet'), qIn = $('#q'), resUl = $('#results');
let searchTimer = 0, searchTok = 0;

function recents() { return store.get('wx.recent', []); }
function renderRecents() {
  const r = recents();
  resUl.innerHTML = r.length
    ? r.map((p, k) => `<li><button data-r="${k}"><b>${esc(p.name)}</b><small>${esc([p.admin1, p.country].filter(Boolean).join(', '))}</small></button></li>`).join('')
    : '<li class="hint">Írd be a város nevét.</li>';
}
function chooseRecent(p) {
  S.place = p; store.set('wx.place', p);
  const r = [p, ...recents().filter(x => !(x.latitude === p.latitude && x.longitude === p.longitude))].slice(0, 6);
  store.set('wx.recent', r);
  S.firstLoad = true; S.model = null;
  sheet.close();
  load();
}
$('#placeBtn').addEventListener('click', () => { qIn.value = ''; renderRecents(); sheet.showModal(); setTimeout(() => qIn.focus(), 50); });
$('#sheetClose').addEventListener('click', () => sheet.close());
sheet.addEventListener('click', e => { if (e.target === sheet) sheet.close(); });
qIn.addEventListener('input', () => {
  clearTimeout(searchTimer);
  const q = qIn.value.trim();
  if (q.length < 2) { renderRecents(); return; }
  searchTimer = setTimeout(async () => {
    const tok = ++searchTok;
    try {
      const g = await getJSON(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=8&language=hu&format=json`, 8000);
      if (tok !== searchTok) return;
      S._found = g.results || [];
      resUl.innerHTML = S._found.length
        ? S._found.map((p, k) => `<li><button data-f="${k}"><b>${esc(p.name)}</b><small>${esc([p.admin1, p.country].filter(Boolean).join(', '))}</small></button></li>`).join('')
        : '<li class="hint">Nincs ilyen találat. Próbáld másképp írni.</li>';
    } catch {
      if (tok === searchTok) resUl.innerHTML = '<li class="hint">A keresés most nem érhető el. Ellenőrizd a netet.</li>';
    }
  }, 250);
});
resUl.addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.f != null) {
    const p = S._found[+b.dataset.f];
    chooseRecent({ name: p.name, admin1: p.admin1 || '', country: p.country || '', latitude: p.latitude, longitude: p.longitude });
  } else if (b.dataset.r != null) chooseRecent(recents()[+b.dataset.r]);
});
$('#locateBtn').addEventListener('click', () => {
  if (!navigator.geolocation) { resUl.innerHTML = '<li class="hint">Ez az eszköz nem ad helyadatot.</li>'; return; }
  resUl.innerHTML = '<li class="hint">Hely meghatározása…</li>';
  navigator.geolocation.getCurrentPosition(
    pos => chooseRecent({ name: 'Jelenlegi helyem', admin1: '', country: '', latitude: +pos.coords.latitude.toFixed(4), longitude: +pos.coords.longitude.toFixed(4) }),
    () => { resUl.innerHTML = '<li class="hint">Nem kaptam engedélyt a helyadatra. Engedélyezd a böngésző beállításaiban, vagy keress városra.</li>'; },
    { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
  );
});

/* ---- húzd le a frissítéshez ---- */
(() => {
  const pull = $('#pull');
  let y0 = null, dy = 0;
  window.addEventListener('touchstart', e => { y0 = window.scrollY <= 0 && !sheet.open ? e.touches[0].clientY : null; dy = 0; }, { passive: true });
  window.addEventListener('touchmove', e => {
    if (y0 === null) return;
    dy = e.touches[0].clientY - y0;
    pull.classList.toggle('show', dy > 70 && window.scrollY <= 0);
  }, { passive: true });
  window.addEventListener('touchend', () => {
    if (y0 !== null && dy > 90 && window.scrollY <= 0) load();
    pull.classList.remove('show'); y0 = null; dy = 0;
  });
})();

/* ---- automatikus frissítés, ha régóta nem néztük ---- */
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible' || !S.model) return;
  if (Date.now() - S.fetchedAt > 15 * 60 * 1000) load(); else renderAll();
});

/* ---- service worker ---- */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => { }));
}

/* ---- indulás ---- */
load();
