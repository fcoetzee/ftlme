/* FTL Me: run on any FencingTime Live event page (logged in).
   Finds your pool, strip, pool ranking, DE bouts and final place.
   Written so that newlines can be collapsed into a one-line bookmarklet:
   every statement ends in a semicolon and there are no line comments. */
(async () => {
  const ID = /[0-9A-F]{32}/g;
  const NS = 'ftlme';
  const old = document.getElementById(NS);
  if (old) { clearInterval(old._timer); old.remove(); }

  const css = `#${NS}{position:fixed;inset:0;z-index:2147483647;background:#f4f5f7;color:#1a1a1a;overflow:auto;font:16px/1.45 system-ui,-apple-system,Roboto,sans-serif;-webkit-text-size-adjust:100%}
#${NS} .w{max-width:640px;margin:0 auto;padding:12px 14px 40px}
#${NS} .bar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:10px}
#${NS} input[type=text]{flex:1 1 160px;font:inherit;padding:8px 10px;border:1px solid #bbb;border-radius:8px;min-width:0}
#${NS} button{font:inherit;padding:8px 12px;border:0;border-radius:8px;background:#1f4e8c;color:#fff}
#${NS} button.g{background:#ddd;color:#222}
#${NS} label{font-size:14px;display:flex;gap:6px;align-items:center;padding:0;margin:0}
#${NS} label:before,#${NS} label:after{display:none!important}
#${NS} input[type=checkbox]{position:static!important;opacity:1!important;pointer-events:auto!important;visibility:visible!important;width:20px;height:20px;margin:0;-webkit-appearance:checkbox;appearance:checkbox}
#${NS} h1{font-size:15px;font-weight:600;color:#555;margin:4px 0 10px}
#${NS} .c{background:#fff;border-radius:12px;padding:12px 14px;margin:10px 0;box-shadow:0 1px 2px rgba(0,0,0,.08)}
#${NS} .k{font-size:13px;text-transform:uppercase;letter-spacing:.05em;color:#777;margin-bottom:4px}
#${NS} .big{font-size:22px;font-weight:700}
#${NS} .strip{display:inline-block;background:#1f4e8c;color:#fff;border-radius:6px;padding:1px 8px;font-weight:700}
#${NS} .mut{color:#777;font-size:14px}
#${NS} .err{color:#b00020}
#${NS} a{color:#1f4e8c;font-weight:600}
#${NS} table{border-collapse:collapse;width:100%}
#${NS} td{padding:6px 4px;border-top:1px solid #eee;vertical-align:top}
#${NS} tr:first-child td{border-top:0}
#${NS} .W{color:#0a7d32;font-weight:700}
#${NS} .L{color:#b00020;font-weight:700}
#${NS} .N{color:#1f4e8c;font-weight:700}`;

  const box = document.createElement('div');
  box.id = NS;
  box.innerHTML = `<style>${css}</style><div class="w">
<div class="bar"><b id="${NS}w" style="flex:1 1 auto;font-size:18px"></b><a href="#" id="${NS}e" style="font-size:14px">change</a>
<button id="${NS}r">Refresh</button><button class="g" id="${NS}x">Close</button></div>
<div class="bar" id="${NS}f" style="display:none"><input type="text" id="${NS}n" placeholder="Name: last, or first and last"><button id="${NS}s">OK</button></div>
<div class="bar"><label><input type="checkbox" id="${NS}a"> Auto-refresh every 60 s</label></div>
<h1 id="${NS}t"></h1><div id="${NS}o"></div></div>`;
  document.body.appendChild(box);
  const $ = (s) => box.querySelector('#' + NS + s);
  const nameIn = $('n');
  nameIn.value = localStorage.getItem('ftlmeName') || window.ftlmeDefault || '';
  $('w').textContent = nameIn.value;

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const toks = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z]+/g, ' ').trim().split(' ').filter(Boolean);
  const isMe = (s) => { const q = toks(nameIn.value); if (!q.length) return false; const t = toks(s); return q.every((w) => t.includes(w)); };
  const parse = (h) => new DOMParser().parseFromString(h, 'text/html');
  const get = async (u) => { const r = await fetch(u, { credentials: 'same-origin' }); if (!r.ok) throw new Error(r.status + ' ' + u.replace(ID, '…')); return r.text(); };
  const getJ = async (u) => JSON.parse(await get(u));
  const txt = (e) => (e ? e.textContent.replace(/\s+/g, ' ').trim() : '');
  const ord = (n) => { n = String(n); const m = n.match(/^(\d+)(.*)$/); if (!m) return n; const i = +m[1], s = (i % 100 > 10 && i % 100 < 14) ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[i % 10] || 'th'); return i + s + (m[2] ? ' (tie)' : ''); };

  const linksFrom = (doc) => {
    const hrefs = [...doc.querySelectorAll('a[href]')].map((a) => a.getAttribute('href'));
    const pick = (re) => [...new Set(hrefs.filter((h) => re.test(h)).map((h) => h.split('?')[0]))];
    return {
      pools: pick(/^\/pools\/scores\/[0-9A-F]{32}\/[0-9A-F]{32}$/),
      poolRes: pick(/^\/pools\/results\/[0-9A-F]{32}\/[0-9A-F]{32}$/),
      tabs: pick(/^\/tableaus\/scores\/[0-9A-F]{32}\/[0-9A-F]{32}$/),
      res: pick(/^\/events\/results\/[0-9A-F]{32}$/),
    };
  };
  const hasAny = (L) => L.pools.length + L.poolRes.length + L.tabs.length + L.res.length > 0;
  let memo = {};
  const getM = (u) => (memo[u] = memo[u] || get(u));
  const evInPath = (location.pathname.match(/^\/(?:events|pools|tableaus|rounds)\/\w+\/([0-9A-F]{32})/) || [])[1];
  let chosen = null;
  async function pickEvent() {
    /* On an event page, use that event. On a tournament schedule, find the events whose entry list has the name. */
    if (evInPath) return { ev: evInPath, title: document.title };
    if (chosen) return chosen;
    const evs = [...new Map([...document.querySelectorAll('a[href^="/events/view/"]')].map((a) => [a.getAttribute('href').split('/').pop().split('?')[0], txt(a)])).entries()];
    const hits = (await Promise.all(evs.map(async ([ev, title]) => {
      try { const j = await getJ('/events/competitors/data/' + ev); return Array.isArray(j) && j.some((x) => isMe(x.name)) ? { ev, title } : null; } catch (e) { return null; }
    }))).filter(Boolean);
    if (hits.length === 1) chosen = hits[0];
    return chosen || { n: evs.length, hits };
  }
  async function links(ev) {
    /* Tabs appear in stages, and Seeding / Strips / Pool Results only show inside the Pools tab,
       so re-read the nav on every refresh: the event's current page, then the pool round's own page. */
    let L = linksFrom(evInPath ? document : parse('<p>'));
    for (const u of [evInPath && location.pathname, '/events/view/' + ev, '/events/competitors/' + ev]) {
      if (!u) continue;
      try { const M = linksFrom(parse(await getM(u))); if (hasAny(M)) { L = M; break; } } catch (e) { }
    }
    if (L.pools[0]) {
      try { const M = linksFrom(parse(await getM(L.pools[0]))); for (const k of Object.keys(L)) L[k] = [...new Set([...L[k], ...M[k]])]; } catch (e) { }
      if (!L.poolRes.length) L.poolRes = [L.pools[0].replace('/pools/scores/', '/pools/results/')];
    }
    if (!L.res.length) L.res = ['/events/results/' + ev];
    return L;
  }
  async function entry(ev) {
    const j = await getJ('/events/competitors/data/' + ev);
    if (!Array.isArray(j)) return null;
    const me = j.filter((x) => isMe(x.name));
    return { me, total: j.length };
  }

  async function findPool(path) {
    const [ev, rd] = path.match(ID);
    const sd = parse(await getM(path));
    const scr = [...sd.scripts].filter((s) => !s.src).map((s) => s.textContent).join('\n');
    const ids = [...new Set(scr.match(ID) || [])].filter((x) => x !== ev && x !== rd);
    const frags = await Promise.all(ids.map((id) => get(path + '/' + id + '?dbut=true').then(parse).catch(() => null)));
    let n = 0, done = 0, mine = null, hits = 0;
    for (const f of frags) {
      if (!f || !f.querySelector('.poolNum')) continue;
      n++;
      const cells = [...f.querySelectorAll('td.poolScore')];
      if (cells.length && cells.every((c) => txt(c))) done++;
      for (const row of f.querySelectorAll('tr.poolRow')) {
        if (!isMe(txt(row.querySelector('.poolCompName')))) continue;
        if (++hits > 1 || mine) continue;
        const sc = [...row.querySelectorAll('td.poolScore')].map(txt);
        const res = [...row.querySelectorAll('td')].slice(-5).map(txt);
        const det = f.querySelector('a[href*="/pools/details/"]');
        mine = {
          found: true,
          num: txt(f.querySelector('.poolNum')),
          where: txt(f.querySelector('.poolStripTime')),
          pos: txt(row.querySelector('.poolPos')),
          size: f.querySelectorAll('tr.poolRow').length,
          v: sc.filter((s) => /^V/.test(s)).length,
          d: sc.filter((s) => /^D/.test(s)).length,
          res,
          det: det ? det.getAttribute('href') : null,
        };
      }
    }
    return { ...(mine || { found: false }), n, done, hits };
  }

  async function poolRank(path) {
    const [ev, rd] = path.match(ID);
    const j = await getJ('/pools/results/data/' + ev + '/' + rd);
    if (!Array.isArray(j)) return null;
    const me = j.find((x) => isMe(x.name));
    return me && me.place != null && me.place !== '' ? { ...me, total: j.length } : null;
  }

  function boutInfo(cell) {
    const m = txt(cell && cell.querySelector('.tsco')).match(/^(\d+)\s*-\s*(\d+)/);
    const s = m ? m[1] + '-' + m[2] : '';
    const all = cell ? cell.innerText || cell.textContent : '';
    const strip = (all.match(/Strip\s+(\S+)/) || [])[1] || '';
    const time = (all.match(/(?<!\d)(\d{1,2}:\d\d\s*[AP]M)/) || [])[1] || '';
    return { score: s, strip, time };
  }

  function fencer(cell) {
    if (!cell || !cell.querySelector('.tcln')) return null;
    const last = txt(cell.querySelector('.tcln'));
    return {
      seed: txt(cell.querySelector('.tseed')).replace(/[()]/g, ''),
      name: (last + ' ' + txt(cell.querySelector('.tcfn'))).trim(),
      bye: /BYE/.test(last),
    };
  }

  async function findDE(path) {
    const trees = await getJ(path + '/trees');
    if (!Array.isArray(trees) || !trees.length) return { empty: true };
    let seeded = false;
    for (const tree of trees) {
      const d = parse(await get(path + '/trees/' + tree.guid + '/tables/0/' + (tree.numTables + 1)));
      if (window.ftlmeHook) window.ftlmeHook(d);
      const tbl = d.querySelector('table.elimTableau');
      if (!tbl) continue;
      const rows = [...tbl.rows];
      const heads = [...rows[0].cells].map(txt);
      const nc = heads.length;
      let r0 = rows.findIndex((r) => r.cells[0] && r.cells[0].querySelector('.tcln'));
      if (r0 < 0) continue;
      seeded = true;
      const at = (c, k, off) => { const r = rows[r0 + 2 ** c - 1 + k * 2 ** (c + 1) + (off || 0)]; return r ? r.cells[c] : null; };
      const slots = (c) => Math.max(1, (rows.length - r0) / 2 ** (c + 1));
      let c0 = -1, k = -1;
      for (let c = 0; c < nc && c0 < 0; c++) {
        for (let i = 0; i < slots(c); i++) { const f = fencer(at(c, i)); if (f && !f.bye && isMe(f.name)) { c0 = c; k = i; break; } }
      }
      if (c0 < 0) continue;
      const bouts = [];
      let status = '';
      for (let c = c0; c < nc - 1; c++) {
        const round = heads[c] || 'Round';
        const opp = fencer(at(c, k ^ 1));
        const nxt = fencer(at(c + 1, k >> 1));
        const info = boutInfo(at(c + 1, k >> 1, 1));
        if (opp && opp.bye) { bouts.push({ round, bye: true }); k >>= 1; continue; }
        if (nxt) {
          const won = isMe(nxt.name);
          const p = info.score.split(/\s*-\s*/);
          const sc = p.length === 2 ? (won ? p[0] + '–' + p[1] : p[1] + '–' + p[0]) : info.score;
          bouts.push({ round, opp, res: won ? 'W' : 'L', sc, ...info });
          if (!won) { status = 'out:' + round; break; }
          k >>= 1;
          continue;
        }
        let pending = null;
        if (!opp && c > 0) {
          const kk = k ^ 1;
          pending = [fencer(at(c - 1, 2 * kk)), fencer(at(c - 1, 2 * kk + 1))].filter(Boolean);
        }
        bouts.push({ round, opp, next: true, pending, ...info });
        status = 'next';
        break;
      }
      if (!status && c0 >= 0) status = 'won';
      return { tree: tree.name, heads, bouts, status };
    }
    return seeded ? null : { empty: true };
  }

  async function finalPlace(path) {
    const ev = path.match(ID)[0];
    const j = await getJ('/events/results/data/' + ev);
    if (!Array.isArray(j)) return null;
    const me = j.find((x) => isMe(x.name));
    return me && me.place ? { place: me.place, total: j.length } : null;
  }

  const card = (k, body) => `<div class="c"><div class="k">${k}</div>${body}</div>`;
  const stripTag = (s) => (s ? `<span class="strip">${esc(s)}</span>` : '');
  const oppText = (b) => (b.opp ? fn(b.opp) : (b.pending && b.pending.length ? 'Winner of ' + b.pending.map(fn).join(' / ') : 'TBD'));
  const fn = (f) => (f ? `${f.seed ? '(' + esc(f.seed) + ') ' : ''}${esc(f.name)}` : 'TBD');

  async function run() {
    const nm = nameIn.value.trim();
    localStorage.setItem('ftlmeName', nm);
    const out = $('o');
    $('t').textContent = document.title;
    if (!nm) { $('f').style.display = 'flex'; out.innerHTML = card('Setup', 'Type a name above and tap OK.'); return; }
    memo = {};
    const notYet = (what, e) => `<span class="mut">${what}</span>${e ? `<div class="mut" style="font-size:12px">(${esc(e)})</div>` : ''}`;
    if (!out.innerHTML) out.innerHTML = '<div class="mut">Loading…</div>';
    const pick = await pickEvent();
    if (!pick.ev) {
      if (!pick.n) out.innerHTML = card('No event here', 'Open the tournament schedule or any page of your event on FencingTime Live, then run this again.');
      else if (!pick.hits.length) out.innerHTML = card('Not entered', notYet(`"${esc(nm)}" is not in the entry list of any of the ${pick.n} events on this page.`));
      else {
        out.innerHTML = card('Which event?', pick.hits.map((h, i) => `<div style="margin:6px 0"><button data-i="${i}">${esc(h.title)}</button></div>`).join(''));
        out.querySelectorAll('button[data-i]').forEach((b) => { b.onclick = () => { chosen = pick.hits[+b.dataset.i]; out.innerHTML = ''; go(); }; });
      }
      return;
    }
    const ev = pick.ev;
    $('t').textContent = pick.title;
    const L = await links(ev);
    const safe = (p) => p.then((v) => ({ v }), (e) => ({ e: e.message || String(e) }));
    const [E, P, R, D, F] = await Promise.all([
      safe(entry(ev)),
      L.pools[0] ? safe(findPool(L.pools[0])) : null,
      L.poolRes[0] ? safe(poolRank(L.poolRes[0])) : null,
      L.tabs[0] ? safe(findDE(L.tabs[0])) : null,
      L.res[0] ? safe(finalPlace(L.res[0])) : null,
    ]);
    let h = '';
    const poolsDone = P && P.v && P.v.n > 0 && P.v.done === P.v.n;
    if (E && E.v && (!P || !P.v || !P.v.found)) {
      const me = E.v.me;
      h += card('Entry', me.length ? me.map((x) => `<div><b>${esc(x.name)}</b>${x.status ? ' · ' + esc(x.status) : ''}</div>`).join('') + `<div class="mut">${E.v.total} fencers entered</div>`
        : notYet(`"${esc(nm)}" is not in the entry list (${E.v.total} fencers).`));
    }
    if (!P) h += card('Pool', notYet('Pools not posted yet.'));
    else if (P.e) h += card('Pool', notYet('Pools not available yet.', P.e));
    else if (!P.v.found) h += card('Pool', notYet(P.v.n ? `Not found in ${P.v.n} pools. Check the spelling of your name.` : 'Pools not posted yet.'));
    else {
      const p = P.v;
      const m = p.where.match(/strip\s+(\S+)(?:\s+at\s+(.*))?/i);
      h += card('Pool', `<div class="big">${esc(p.num)} ${m ? stripTag(m[1]) : ''}</div>
<div>${m && m[2] ? 'Starts ' + esc(m[2]) + ' · ' : ''}You are #${esc(p.pos)} of ${p.size}</div>
${m ? '' : '<div class="mut">Strip not assigned yet.</div>'}
<div class="mut">Bouts so far: ${p.v}V ${p.d}D${p.res[3] ? ` · TS ${esc(p.res[2])} TR ${esc(p.res[3])} Ind ${esc(p.res[4])}` : ''}</div>
${p.det ? `<div style="margin-top:6px"><a href="${esc(p.det)}">Pool details ›</a></div>` : ''}
<div class="mut" style="margin-top:4px">${p.done} of ${p.n} pools complete</div>
${p.hits > 1 ? `<div class="L" style="margin-top:4px">${p.hits} fencers match "${esc(nameIn.value)}". Tap change and add the first name.</div>` : ''}`);
    }

    if (!R) { if (P && P.v && P.v.n) h += card('Pool ranking', notYet('Pool results not posted yet.')); }
    else {
      if (R.e) h += card('Pool ranking', notYet('Not available yet.', R.e));
      else if (!R.v) h += card('Pool ranking', notYet('Not available yet.'));
      else {
        const r = R.v;
        h += card(poolsDone ? 'Pool ranking' : 'Pool ranking (provisional)', `<div class="big">${ord(r.place)} of ${r.total}</div>
${poolsDone ? '' : `<div class="mut">Provisional: ${P && P.v ? P.v.done + ' of ' + P.v.n : 'not all'} pools complete.</div>`}
<div>${r.v}V / ${r.m} · V/M ${Number(r.vm).toFixed(2)} · Ind ${r.ind > 0 ? '+' : ''}${r.ind}</div>
${r.prediction ? `<div class="${/Elim/i.test(r.prediction) ? 'L' : 'W'}">${esc(r.prediction)}</div>` : ''}`);
      }
    }

    const elimPools = R && R.v && /Elim/i.test(R.v.prediction || '');
    if (!D) h += card('Direct elimination', notYet(elimPools ? 'Eliminated after pools.' : 'Tableau not posted yet.'));
    else if (D.e) h += card('Direct elimination', notYet('Tableau not available yet.', D.e));
    else if (D.v && D.v.empty) h += card('Direct elimination', notYet('Tableau posted but not filled in yet.'));
    else if (!D.v) h += card('Direct elimination', notYet(elimPools ? 'Eliminated after pools.' : 'Not in the tableau. Check the spelling of your name.'));
    else {
      const rowsH = D.v.bouts.map((b) => {
        if (b.bye) return `<tr><td>${esc(b.round)}</td><td colspan="2" class="mut">Bye</td></tr>`;
        if (b.next) {
          const who = oppText(b);
          return `<tr><td>${esc(b.round)}</td><td><span class="N">NEXT</span> vs ${who}</td><td>${stripTag(b.strip)}${b.time ? '<div class="mut">' + esc(b.time) + '</div>' : ''}</td></tr>`;
        }
        return `<tr><td>${esc(b.round)}</td><td>vs ${fn(b.opp)}<div><span class="${b.res}">${b.res} ${esc(b.sc)}</span></div></td><td>${stripTag(b.strip)}${b.time ? '<div class="mut">' + esc(b.time) + '</div>' : ''}</td></tr>`;
      }).join('');
      const nx = D.v.bouts.find((b) => b.next);
      const top = nx ? `<div class="big">Next: ${nx.strip ? 'Strip ' + stripTag(nx.strip) : 'strip TBA'}</div><div>vs ${oppText(nx)}${nx.time ? ' · ' + esc(nx.time) : ''}</div>`
        : D.v.status === 'won' ? '<div class="big W">Won the event</div>' : /^out:/.test(D.v.status) ? `<div class="big">${/^Finals?$/i.test(D.v.status.slice(4)) ? 'Lost the final' : 'Out in the ' + esc(D.v.status.slice(4))}</div>` : '';
      h += card('Direct elimination', `${top}<table style="margin-top:8px">${rowsH}</table>`);
    }

    const finished = (D && D.v && !D.v.empty && /^(out|won)/.test(D.v.status || '')) || elimPools;
    if (F && F.v && finished) h += card('Final result', `<div class="big">${ord(F.v.place)} of ${F.v.total}</div>`);

    h += `<div class="mut">Updated ${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</div>`;
    out.innerHTML = h;
  }

  const go = () => run().catch((e) => { $('o').innerHTML = card('Error', `<span class="err">${esc(e.message || e)}</span>`); });
  $('r').onclick = go;
  const save = () => { chosen = null; $('w').textContent = nameIn.value.trim(); $('f').style.display = 'none'; $('o').innerHTML = ''; go(); };
  nameIn.onkeydown = (e) => { if (e.key === 'Enter') save(); };
  $('s').onclick = save;
  $('e').onclick = (e) => { e.preventDefault(); $('f').style.display = 'flex'; nameIn.focus(); nameIn.select(); };
  $('x').onclick = () => { clearInterval(box._timer); box.remove(); };
  $('a').checked = localStorage.getItem('ftlmeAuto') !== '0';
  const setAuto = () => { clearInterval(box._timer); localStorage.setItem('ftlmeAuto', $('a').checked ? '1' : '0'); if ($('a').checked) box._timer = setInterval(go, 60000); };
  $('a').onchange = setAuto;
  setAuto();
  go();
})();
