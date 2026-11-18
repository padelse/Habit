(() => {
  'use strict';
  const STORAGE_KEY = 'habit-tracker-v1';
  const MS_DAY = 86400000;

  /* ---------- Datos (localStorage) ---------- */
  const state = load();
  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (s && typeof s === 'object') return { name: s.name || 'Mi hábito', days: s.days || {} };
    } catch (e) {}
    return { name: 'Mi hábito', days: {} };
  }
  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    catch (e) { alert('No se pudo guardar en este navegador. Comprueba que no estás en navegación privada.'); }
  }

  /* ---------- Fechas ---------- */
  const pad = n => String(n).padStart(2, '0');
  const key = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parse = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const today = () => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); };
  const diffDays = (a, b) => Math.round((b - a) / MS_DAY);
  const fmt = (o) => new Intl.DateTimeFormat('es-ES', o);
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const weekdayName = d => cap(fmt({ weekday: 'long' }).format(d));
  const longDate = d => fmt({ day: 'numeric', month: 'long' }).format(d);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ---------- Estado de un día: 1 cumplido, 0 no cumplido, null sin rellenar ---------- */
  const getStatus = k => (k in state.days ? state.days[k] : null);
  function setStatus(k, v) {
    if (v === null) delete state.days[k]; else state.days[k] = v;
    save(); render();
  }

  /* ---------- Estadísticas ---------- */
  function currentStreak() {
    let d = today();
    if (getStatus(key(d)) === null) d = addDays(d, -1); // hoy sin rellenar no rompe la racha
    let n = 0;
    while (getStatus(key(d)) === 1) { n++; d = addDays(d, -1); }
    return n;
  }
  function bestStreak() {
    const ks = Object.keys(state.days).filter(k => state.days[k] === 1).sort();
    let best = 0, run = 0, prev = null;
    for (const k of ks) {
      const d = parse(k);
      run = prev && diffDays(prev, d) === 1 ? run + 1 : 1;
      best = Math.max(best, run); prev = d;
    }
    return best;
  }
  function range(from, to) {
    let done = 0, fail = 0, empty = 0;
    for (let d = from; d <= to; d = addDays(d, 1)) {
      const s = getStatus(key(d));
      if (s === 1) done++; else if (s === 0) fail++; else empty++;
    }
    return { done, fail, empty };
  }
  const pct = r => (r.done + r.fail ? Math.round(100 * r.done / (r.done + r.fail)) : null);
  const pctText = p => (p === null ? '—' : p + '%');
  function weekdayRates() {
    const acc = Array.from({ length: 7 }, () => ({ done: 0, fail: 0 }));
    for (const [k, v] of Object.entries(state.days)) {
      const i = (parse(k).getDay() + 6) % 7;
      if (v === 1) acc[i].done++; else acc[i].fail++;
    }
    return acc.map(pct);
  }

  /* ---------- Iconos ---------- */
  const CHECK = '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  const CROSS = '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  const icon = s => (s === 1 ? CHECK : s === 0 ? CROSS : '');
  const label = s => (s === 1 ? 'cumplido' : s === 0 ? 'no cumplido' : 'sin rellenar');

  /* ---------- Vistas ---------- */
  function renderHoy() {
    const t = today(), s = getStatus(key(t)), st = currentStreak();
    document.getElementById('view-hoy').innerHTML = `
      <div class="hero">
        <div class="num">${t.getDate()}</div>
        <div><div class="wd">${weekdayName(t)}</div>
        <div class="my">${cap(fmt({ month: 'long', year: 'numeric' }).format(t))}</div></div>
      </div>
      <p class="question">¿Has cumplido hoy?</p>
      <div class="choices">
        <button class="choice yes" data-choice="1" aria-pressed="${s === 1}">${CHECK}Cumplido</button>
        <button class="choice no" data-choice="0" aria-pressed="${s === 0}">${CROSS}No cumplido</button>
      </div>
      <button class="clear" data-choice="clear" ${s === null ? 'disabled' : ''}>Borrar selección</button>
      <div class="streak-line">Racha actual: <b>${st}</b> ${st === 1 ? 'día' : 'días'}</div>`;
  }

  function renderSemana() {
    const t = today(); let rows = '', done = 0;
    for (let i = 6; i >= 0; i--) {
      const d = addDays(t, -i), k = key(d), s = getStatus(k);
      if (s === 1) done++;
      rows += `<button class="row" data-day="${k}" aria-label="${weekdayName(d)} ${longDate(d)}, ${label(s)}">
        <span><span class="d">${i === 0 ? 'Hoy' : weekdayName(d)}</span><br><span class="dt">${i === 0 ? weekdayName(d) + ', ' : ''}${longDate(d)}</span></span>
        <span class="mark s${s}">${icon(s) || '<svg viewBox="0 0 24 24"><path d="M7 12h10"/></svg>'}</span></button>`;
    }
    document.getElementById('view-semana').innerHTML = `
      <h1>Últimos 7 días</h1><p class="sub">${done} de 7 cumplidos</p>
      <div class="list">${rows}</div>
      <p class="hint">Toca un día para cambiarlo.</p>`;
  }

  function renderMes() {
    const t = today(), y = t.getFullYear(), m = t.getMonth();
    const first = new Date(y, m, 1), days = new Date(y, m + 1, 0).getDate();
    let cells = '<div class="cell blank"></div>'.repeat((first.getDay() + 6) % 7);
    for (let n = 1; n <= days; n++) {
      const d = new Date(y, m, n), s = getStatus(key(d));
      const cls = `cell s${s}${d > t ? ' future' : ''}${n === t.getDate() ? ' today' : ''}`;
      cells += `<div class="${cls}" aria-label="${n} de ${fmt({ month: 'long' }).format(d)}: ${label(s)}"><span class="n">${n}</span>${icon(s)}</div>`;
    }
    const r = range(first, t);
    document.getElementById('view-mes').innerHTML = `
      <h1>${cap(fmt({ month: 'long', year: 'numeric' }).format(t))}</h1>
      <p class="sub">${r.done} cumplidos, ${r.fail} no cumplidos</p>
      <div class="dow">${['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(x => `<span>${x}</span>`).join('')}</div>
      <div class="grid">${cells}</div>
      <div class="legend"><span><i style="background:var(--done)"></i>Cumplido</span>
        <span><i style="background:var(--fail-soft);box-shadow:inset 0 0 0 1px var(--fail)"></i>No cumplido</span>
        <span><i style="background:var(--surface)"></i>Sin rellenar</span></div>`;
  }

  function renderStats() {
    const t = today(), r30 = range(addDays(t, -29), t), r7 = range(addDays(t, -6), t);
    const rm = range(new Date(t.getFullYear(), t.getMonth(), 1), t);
    const p30 = pct(r30), rates = weekdayRates();
    const tot = Object.values(state.days);
    const totDone = tot.filter(v => v === 1).length, totFail = tot.length - totDone;
    const firstKey = Object.keys(state.days).sort()[0];
    const maxRate = Math.max(...rates.filter(x => x !== null), -1);
    const bestIdx = maxRate >= 0 ? rates.indexOf(maxRate) : -1;
    const names = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
    document.getElementById('view-stats').innerHTML = `
      <h1>Estadísticas</h1><p class="sub">${esc(state.name)}</p>
      <div class="tiles">
        <div class="tile"><div class="v">${currentStreak()}</div><div class="l">Racha actual (días)</div></div>
        <div class="tile"><div class="v">${bestStreak()}</div><div class="l">Racha máxima (días)</div></div>
      </div>
      <div class="wide"><h3>Últimos 30 días: ${pctText(p30)}</h3>
        <div class="l" style="color:var(--muted);font-size:14px">${r30.done} cumplidos de ${r30.done + r30.fail} rellenados</div>
        <div class="bar"><i style="width:${p30 || 0}%"></i></div></div>
      <div class="wide">
        <div class="kv"><span>Últimos 7 días</span><b>${pctText(pct(r7))}</b></div>
        <div class="kv"><span>Este mes</span><b>${pctText(pct(rm))}</b></div>
        <div class="kv"><span>Total cumplidos</span><b>${totDone}</b></div>
        <div class="kv"><span>Total no cumplidos</span><b>${totFail}</b></div>
        <div class="kv"><span>Sin rellenar (últimos 30 días)</span><b>${r30.empty}</b></div>
        <div class="kv"><span>Primer registro</span><b>${firstKey ? longDate(parse(firstKey)) : '—'}</b></div>
        <div class="kv"><span>Mejor día de la semana</span><b>${bestIdx >= 0 ? names[bestIdx] : '—'}</b></div>
      </div>
      <div class="wide"><h3>Cumplimiento por día de la semana</h3>
        <div class="chart">${rates.map((p, i) => `<div class="${i === bestIdx ? 'best' : ''}"><em>${p === null ? '' : p + '%'}</em><i style="height:${p === null ? 2 : Math.max(p * .7, 3)}px"></i>${'LMXJVSD'[i]}</div>`).join('')}</div></div>`;
  }

  function render() {
    document.getElementById('habitName').textContent = state.name;
    renderHoy(); renderSemana(); renderMes(); renderStats();
  }

  /* ---------- Interacción ---------- */
  const sheet = document.getElementById('sheet');
  let sheetKey = null;
  function openSheet(k) {
    sheetKey = k; const d = parse(k), s = getStatus(k);
    document.getElementById('sheetTitle').textContent = `${weekdayName(d)}, ${longDate(d)}`;
    sheet.querySelector('.opt-done').setAttribute('aria-pressed', s === 1);
    sheet.querySelector('.opt-fail').setAttribute('aria-pressed', s === 0);
    sheet.hidden = false;
  }
  const closeSheet = () => { sheet.hidden = true; sheetKey = null; };

  document.addEventListener('click', e => {
    const el = e.target.closest('button'); if (!el) return;
    if (el.dataset.tab) {
      document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b === el));
      document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + el.dataset.tab));
      document.getElementById('views').scrollTop = 0;
    } else if (el.dataset.choice) {
      const c = el.dataset.choice, k = key(today()), cur = getStatus(k);
      setStatus(k, c === 'clear' ? null : Number(c) === cur ? null : Number(c)); // tocar de nuevo la opción activa la quita
    } else if (el.dataset.day) {
      openSheet(el.dataset.day);
    } else if (el.dataset.set !== undefined) {
      const v = el.dataset.set; const k = sheetKey; closeSheet(); setStatus(k, v === 'clear' ? null : Number(v));
    } else if ('close' in el.dataset) {
      closeSheet();
    } else if (el.id === 'habitName') {
      const n = prompt('Nombre del hábito', state.name);
      if (n && n.trim()) { state.name = n.trim().slice(0, 40); save(); render(); }
    }
  });
  document.querySelector('.sheet-backdrop').addEventListener('click', closeSheet);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); });

  // Si cambia el día con la app abierta, refresca
  let shownDay = key(today());
  const checkDay = () => { const k = key(today()); if (k !== shownDay) { shownDay = k; render(); } };
  document.addEventListener('visibilitychange', () => { if (!document.hidden) checkDay(); });
  setInterval(checkDay, 30000);

  render();
})();
