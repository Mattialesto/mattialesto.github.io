/* =====================================================================
   Classe Party - LABO : manettes (téléphones / tablettes des élèves)
   Côté ordinateur du prof. Chargé uniquement par jouer.html?labo=1,
   et activé seulement si la personne connectée est administrateur.
   © 2026 Jérôme Manderlier - Licence CC BY-NC-ND 4.0
   ===================================================================== */
(function () {
  'use strict';
  const CFG = window.CP_CONFIG || {};
  if (!window.supabase || !CFG.SUPABASE_URL || !CFG.SUPABASE_ANON_KEY) return;
  const sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY);

  const LAB = {
    on: false, code: '', ch: null, all: true, phones: {}, q: null,
    sideAns: new Map(), sendT: null, seq: 0
  };
  window.CP_LAB = LAB;

  /* ---------- accès réservé à l'administrateur ---------- */
  async function isAdmin() {
    try {
      const {data: {session}} = await sb.auth.getSession();
      if (!session) return false;
      const {data} = await sb.from('profiles').select('is_admin').eq('id', session.user.id).maybeSingle();
      return !!(data && data.is_admin);
    } catch (e) { return false; }
  }

  /* ---------- style ---------- */
  const css = `
  .lab-box{display:grid;gap:10px;background:#efe6ff;border:3px dashed var(--v);border-radius:14px;padding:12px 14px}
  .lab-box h3{margin:0;font-family:var(--f-display);font-weight:400;font-size:1.25rem}
  .lab-box p{margin:0;font-weight:600;line-height:1.35}
  .lab-tag{display:inline-block;font-family:var(--f-body);font-weight:800;font-size:.72rem;letter-spacing:.06em;color:#fff;background:var(--v);border:2px solid var(--ink);border-radius:999px;padding:0 8px;vertical-align:middle;margin-left:6px}
  .lab-join{display:grid;grid-template-columns:auto minmax(0,1fr);gap:14px;align-items:center}
  .lab-qr{width:150px;background:#fff;border:3px solid var(--ink);border-radius:12px;padding:6px}
  .lab-qr svg{display:block;width:100%;height:auto}
  .lab-code{font-family:var(--f-display);font-size:2.4rem;letter-spacing:.12em;line-height:1}
  .lab-url{font-weight:700;font-size:.9rem;overflow-wrap:anywhere}
  .lab-list{display:flex;flex-wrap:wrap;gap:6px}
  .lab-list > span{display:inline-flex;align-items:center;gap:5px;background:#fff;border:2px solid var(--ink);border-radius:999px;padding:1px 9px 1px 4px;font-weight:700;font-size:.9rem}
  .lab-chk{display:flex;gap:8px;align-items:flex-start;font-weight:700}
  .lab-chk input{width:20px;height:20px;accent-color:var(--v);flex:none;margin-top:2px}
  .lab-chip{font-family:var(--f-display);font-size:1rem;background:var(--v);color:#fff;border:3px solid var(--ink);border-radius:999px;padding:.2em .8em;box-shadow:0 4px 0 var(--ink);cursor:pointer;-webkit-text-stroke:0}
  .lab-count{margin:0;font-weight:800;color:var(--v);text-align:center}
  .lab-big{display:grid;justify-items:center;gap:12px;text-align:center}
  .lab-big .lab-qr{width:min(320px,70vw)}
  .lab-big .lab-code{font-size:3.6rem}
  @media (max-width:520px){.lab-join{grid-template-columns:minmax(0,1fr)}}`;
  document.head.append(Object.assign(document.createElement('style'), {textContent: css}));

  /* ---------- outils ---------- */
  const joinUrl = () => new URL('manette.html?code=' + LAB.code, location.href).href;
  function qrSvg(text) {
    try { const q = window.qrcode(0, 'M'); q.addData(text); q.make(); return q.createSvgTag({cellSize: 4, margin: 2, scalable: true}); }
    catch (e) { return ''; }
  }
  function playerList() {
    if (G && Array.isArray(G.players)) return G.players.map((p, i) => ({i, name: p.name, color: p.color}));
    return [...document.querySelectorAll('#names input')].map((inp, i) => ({i, name: inp.value.trim() || ('Élève ' + (i + 1)), color: COLORS[i]}));
  }
  function phonesFor(i) { return Object.values(LAB.phones).filter(ph => ph.pid === i).length; }
  function nPhones() { return Object.keys(LAB.phones).length; }

  /* ---------- état envoyé aux manettes ---------- */
  function modalInfo() {
    const m = document.getElementById('modal');
    if (!m || m.hidden || !m.firstChild) return null;
    const title = (m.querySelector('.card-title') || {}).textContent || '';
    if (LAB.q && m.querySelector('.ans')) {
      return {type: 'q', title, q: {text: LAB.q.text, vf: LAB.q.vf, opts: LAB.q.opts, revealed: LAB.q.revealed, right: LAB.q.revealed ? LAB.q.right : null, all: LAB.q.all, results: LAB.q.revealed ? LAB.q.results : null}, cont: LAB.q.revealed};
    }
    const foot = [...m.querySelectorAll('.card-foot .btn')].filter(b => !b.hidden);
    const profOnly = !!m.querySelector('.shop-wrap');
    return {type: 'other', title, btn: (foot.length === 1 && !profOnly) ? foot[0].textContent : null};
  }
  function state() {
    const playing = !!(G && Array.isArray(G.players) && !document.getElementById('game').hidden);
    return {
      v: 1, seq: ++LAB.seq, title: typeof gameTitle === 'function' ? gameTitle() : 'Classe Party',
      playing, over: playing ? !!G.over : false,
      players: playerList().map(p => {
        const gp = playing ? G.players[p.i] : null;
        return {name: p.name, color: p.color, coins: gp ? (gp.coins || 0) : null, tours: gp ? Math.floor(gp.progress / N) : null, jailed: gp ? !!gp.jailed : false};
      }),
      turn: playing ? G.turn : -1, phase: playing ? G.phase : 'setup', paused: playing ? !!G.paused : false,
      shop: typeof shopOn === 'function' ? shopOn() : true,
      card: playing ? modalInfo() : null
    };
  }
  function push() {
    if (!LAB.on || !LAB.ch) return;
    clearTimeout(LAB.sendT);
    LAB.sendT = setTimeout(() => {
      try { LAB.ch.send({type: 'broadcast', event: 'state', payload: state()}); } catch (e) {}
      refreshCounters();
    }, 120);
  }
  LAB.push = push;

  /* ---------- actions reçues des manettes ---------- */
  function onAct(a) {
    if (!a || !G || !Array.isArray(G.players) || document.getElementById('game').hidden) return;
    const pid = parseInt(a.pid, 10);
    if (!(pid >= 0 && pid < G.players.length)) return;
    const isTurn = pid === G.turn && !G.over;
    const m = document.getElementById('modal');
    if (a.a === 'roll') {
      if (isTurn && G.phase === 'roll' && !G.paused && m.hidden) roll();
      return;
    }
    if (a.a === 'ans') {
      if (!LAB.q || LAB.q.revealed) return;
      const j = parseInt(a.j, 10);
      if (!(j >= 0 && j < LAB.q.btns.length)) return;
      if (isTurn) { LAB.q.btns[j].click(); return; }
      if (LAB.q.all && !LAB.sideAns.has(pid)) { LAB.sideAns.set(pid, j); refreshCounters(); push(); }
      return;
    }
    if (a.a === 'cont') {
      if (!isTurn || m.hidden) return;
      const foot = [...m.querySelectorAll('.card-foot .btn')].filter(b => !b.hidden && !b.disabled);
      if (foot.length === 1 && !m.querySelector('.shop-wrap')) foot[0].click();
    }
  }

  /* ---------- branchement sur le jeu ---------- */
  const _askQuestion = askQuestion;
  askQuestion = function (p, kind, jail) {
    LAB.sideAns = new Map();
    LAB.q = null; LAB.pendingKind = kind; LAB.pendingPlayer = p;
    const r = _askQuestion.apply(this, arguments);
    hookQuestion();
    return r;
  };
  function hookQuestion() {
    const m = document.getElementById('modal');
    const btns = [...m.querySelectorAll('.ans')];
    if (!btns.length) { LAB.q = null; return; }
    const p = LAB.pendingPlayer;
    LAB.q = {
      kind: LAB.pendingKind, text: (m.querySelector('.qtext') || {}).textContent || '',
      vf: LAB.pendingKind === 'vf', btns, opts: btns.map(b => b.dataset.txt || b.textContent),
      right: btns.findIndex(b => b.dataset.right === '1'), revealed: false,
      all: LAB.on && LAB.all && nPhones() > 0, player: p, results: null
    };
    if (LAB.q.all) {
      const line = document.createElement('p'); line.className = 'lab-count'; line.id = 'labCount';
      const body = m.querySelector('.card-body'); if (body) body.append(line);
    }
    btns.forEach((b, j) => b.addEventListener('click', () => reveal(j), {once: true}));
    refreshCounters(); push();
  }
  function reveal() {
    const q = LAB.q; if (!q || q.revealed) return;
    q.revealed = true;
    let good = 0, total = 0;
    const res = {};
    if (q.all) {
      const rightTxt = q.opts[q.right] || '';
      LAB.sideAns.forEach((j, pid) => {
        const pl = G.players[pid]; if (!pl || pl === q.player) return;
        const ok = j === q.right; total++; if (ok) good++;
        res[pid] = ok;
        if (ok && shopOn()) { ensurePlayerFields(pl); addCoins(pl, 1); }
        logAnswer(pl, q.kind, q.text, ok, rightTxt, q.opts[j] || '', {side: true});
      });
      q.results = res;
      const line = document.getElementById('labCount');
      if (line) line.textContent = total ? `📱 La classe : ${good} bonne${good > 1 ? 's' : ''} réponse${good > 1 ? 's' : ''} sur ${total}` + (good && shopOn() ? ' · +1 pièce chacun !' : '') : '📱 Personne d\'autre n\'a répondu.';
      renderSide(); saveGame();
    }
    push();
  }
  function refreshCounters() {
    const line = document.getElementById('labCount');
    if (line && LAB.q && !LAB.q.revealed) {
      const n = LAB.sideAns.size;
      line.textContent = `📱 Toute la classe répond sur son téléphone : ${n} réponse${n > 1 ? 's' : ''} reçue${n > 1 ? 's' : ''}`;
    }
    const chip = document.getElementById('labChip');
    if (chip) chip.textContent = `📱 ${LAB.code} · ${nPhones()}`;
    renderSetupBox();
  }
  ['renderCenter', 'renderSide', 'openModal', 'closeModal', 'renderNames', 'showScreen'].forEach(fn => {
    const orig = window[fn]; if (typeof orig !== 'function') return;
    window[fn] = function () { const r = orig.apply(this, arguments); if (fn === 'closeModal') LAB.q = null; push(); return r; };
  });
  document.addEventListener('input', e => { if (e.target && e.target.closest && e.target.closest('#names')) push(); });

  /* ---------- connexion temps réel ---------- */
  function start() {
    LAB.code = String(Math.floor(10000 + Math.random() * 90000));
    LAB.on = true; LAB.phones = {};
    const ch = sb.channel('cp-' + LAB.code, {config: {broadcast: {self: false}, presence: {key: 'host'}}});
    ch.on('broadcast', {event: 'act'}, ({payload}) => onAct(payload))
      .on('broadcast', {event: 'hello'}, () => push())
      .on('presence', {event: 'sync'}, () => {
        const st = ch.presenceState(); const ph = {};
        Object.entries(st).forEach(([k, metas]) => { if (k !== 'host' && metas && metas[0]) ph[k] = {pid: metas[0].pid ?? -1}; });
        LAB.phones = ph; refreshCounters();
      })
      .subscribe(async status => {
        if (status === 'SUBSCRIBED') { try { await ch.track({role: 'host'}); } catch (e) {} push(); renderSetupBox(); }
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') { LAB.err = 'Connexion impossible au serveur temps réel.'; renderSetupBox(); }
      });
    LAB.ch = ch; addChip(); renderSetupBox();
    clearInterval(LAB.beat); LAB.beat = setInterval(push, 8000);
  }
  function stop() {
    if (LAB.ch) { try { sb.removeChannel(LAB.ch); } catch (e) {} }
    clearInterval(LAB.beat);
    LAB.ch = null; LAB.on = false; LAB.phones = {}; LAB.err = '';
    const chip = document.getElementById('labChip'); if (chip) chip.remove();
    renderSetupBox();
  }

  /* ---------- interface : écran d'accueil ---------- */
  function renderSetupBox() {
    if (!LAB.allowed) return;
    const form = document.querySelector('#setup .form'); if (!form) return;
    let box = document.getElementById('labBox');
    if (!box) { box = document.createElement('div'); box.id = 'labBox'; box.className = 'lab-box'; const btns = form.querySelector('.form-btns'); form.insertBefore(box, btns); }
    box.replaceChildren();
    box.append(h('h3', {}, '📱 Manettes', h('span', {class: 'lab-tag'}, 'LABO')));
    if (!LAB.on) {
      box.append(h('p', {}, 'Les élèves rejoignent la partie avec un téléphone ou une tablette : ils lancent les dés et répondent aux questions depuis leur écran. Le plateau reste au tableau.'),
        h('div', {}, btn('Activer les manettes', 'violet', () => { SFX.click(); start(); })));
      return;
    }
    const svg = qrSvg(joinUrl());
    box.append(...[
      h('div', {class: 'lab-join'},
        h('div', {class: 'lab-qr', html: svg}),
        h('div', {style: 'display:grid;gap:6px;min-width:0'},
          h('p', {}, 'Scanne le QR code ou va sur :'), h('p', {class: 'lab-url'}, joinUrl().replace(/\?.*$/, '')),
          h('p', {}, 'Code de la partie :'), h('div', {class: 'lab-code'}, LAB.code))),
      LAB.err ? h('p', {style: 'color:var(--x)'}, LAB.err) : null,
      h('p', {}, `${nPhones()} manette${nPhones() > 1 ? 's' : ''} connectée${nPhones() > 1 ? 's' : ''}`),
      h('div', {class: 'lab-list'}, playerList().filter(p => phonesFor(p.i)).map(p => h('span', {}, h('span', {class: 'tdot', style: '--pc:' + p.color + ';width:16px;height:16px;border-width:2px'}), p.name + (phonesFor(p.i) > 1 ? ' ×' + phonesFor(p.i) : '')))),
      (() => { const c = h('input', {type: 'checkbox'}); c.checked = LAB.all; c.addEventListener('change', () => { LAB.all = c.checked; }); return h('label', {class: 'lab-chk'}, c, h('span', {}, 'Toute la classe répond à chaque quiz et vrai ou faux (seul le joueur du tour avance ; les autres gagnent 1 pièce s\'ils ont juste).')); })(),
      h('div', {}, btn('Arrêter les manettes', 'small grey', () => { stop(); }))].filter(Boolean));
  }
  function addChip() {
    if (document.getElementById('labChip')) return;
    const chip = h('button', {type: 'button', class: 'lab-chip', id: 'labChip', title: 'Afficher le QR code pour rejoindre'}, `📱 ${LAB.code}`);
    chip.addEventListener('click', showBigQr);
    const bar = document.querySelector('.tb-btns'); if (bar) bar.prepend(chip);
  }
  function showBigQr() {
    const ov = h('div', {class: 'overlay', style: 'z-index:65'});
    const close = () => ov.remove();
    ov.append(h('div', {class: 'card', style: '--hc:var(--v);width:min(100%,520px)', role: 'dialog', 'aria-modal': 'true'},
      h('div', {class: 'card-head'}, h('div', {class: 'card-title outline'}, 'REJOINDRE LA PARTIE')),
      h('div', {class: 'card-body lab-big'}, h('div', {class: 'lab-qr', html: qrSvg(joinUrl())}), h('p', {class: 'lab-url'}, joinUrl().replace(/\?.*$/, '')), h('div', {class: 'lab-code'}, LAB.code),
        h('p', {style: 'font-weight:700'}, `${nPhones()} manette${nPhones() > 1 ? 's' : ''} connectée${nPhones() > 1 ? 's' : ''}`)),
      h('div', {class: 'card-foot'}, btn('FERMER', 'big go', close))));
    ov.addEventListener('click', e => { if (e.target === ov) close(); });
    document.body.append(ov);
  }

  isAdmin().then(ok => {
    if (!ok) return;
    LAB.allowed = true;
    renderSetupBox();
  });
})();
