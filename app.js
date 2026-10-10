/* =====================================================================
   CLASSE PARTY - socle commun du site (menu, comptes, outils)
   Manderlier Jérôme - v1.1
   ===================================================================== */
(function () {
  'use strict';
  /* les éléments vides (null) sont ignorés au lieu d'afficher le mot « null » */
  const _rc = Element.prototype.replaceChildren;
  Element.prototype.replaceChildren = function (...kids) { return _rc.apply(this, kids.flat(Infinity).filter(k => k !== null && k !== undefined && k !== false)); };
  const CFG = window.CP_CONFIG || {};
  const ONLINE = !!(CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY && window.supabase && window.supabase.createClient);
  const sb = ONLINE ? window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY) : null;
  const CP = window.CP = {sb, online: ONLINE, user: null, profile: null, version: '1.1', author: 'Manderlier Jérôme'};

  CP.MATIERES = ['Français', 'Mathématiques', 'Sciences', 'Éveil historique', 'Éveil géographique', 'Langues modernes', 'Éducation physique', 'Éducation artistique', 'Philosophie et citoyenneté', 'Religion / Morale', 'Formation professionnelle', 'Informatique', 'Culture générale', 'Autre'];
  CP.NIVEAUX = ['Maternel', '1re primaire', '2e primaire', '3e primaire', '4e primaire', '5e primaire', '6e primaire', '1re secondaire', '2e secondaire', '3e secondaire', '4e secondaire', '5e secondaire', '6e secondaire', '7e secondaire', 'Enseignement spécialisé', 'Adultes', 'Tous niveaux'];
  CP.FORUM_CATS = {general: 'Discussions générales', cours: 'Partage de cours', aide: 'Aide et questions', idees: 'Idées pour le jeu'};

  /* ---------- petit outil pour créer des éléments ---------- */
  function el(tag, props, ...kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k === 'html') e.innerHTML = v;
      else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
      else if (v === true) e.setAttribute(k, '');
      else e.setAttribute(k, v);
    }
    for (const kid of kids.flat(Infinity)) {
      if (kid === null || kid === undefined || kid === false) continue;
      e.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    }
    return e;
  }
  CP.el = el;
  CP.$ = s => document.querySelector(s);

  CP.toast = function (msg, ms = 2600) {
    const t = el('div', {class: 'toast', role: 'status'}, msg);
    document.body.append(t); setTimeout(() => t.remove(), ms);
  };
  CP.modal = function ({title, body = [], foot = []}) {
    const close = () => { m.remove(); document.removeEventListener('keydown', onKey); };
    const onKey = e => { if (e.key === 'Escape') close(); };
    const m = el('div', {class: 'modal', onclick: e => { if (e.target === m) close(); }},
      el('div', {class: 'modal-card', role: 'dialog', 'aria-modal': 'true', 'aria-label': title},
        el('div', {class: 'modal-head'}, el('h2', {}, title), el('button', {type: 'button', class: 'x-btn', 'aria-label': 'Fermer', onclick: close}, '×')),
        ...body, foot.length ? el('div', {class: 'btn-row'}, ...foot) : null));
    document.body.append(m); document.addEventListener('keydown', onKey);
    const f = m.querySelector('input, textarea, select, .btn'); if (f) setTimeout(() => f.focus(), 30);
    return close;
  };
  CP.fmtDate = function (iso) {
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  };
  CP.ago = function (iso) {
    const s = (Date.now() - new Date(iso).getTime()) / 1000;
    if (s < 60) return 'à l\'instant';
    if (s < 3600) return `il y a ${Math.floor(s / 60)} min`;
    if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`;
    if (s < 86400 * 7) return `il y a ${Math.floor(s / 86400)} j`;
    return 'le ' + CP.fmtDate(iso);
  };
  CP.slug = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'cours';
  CP.download = function (name, text) {
    const url = URL.createObjectURL(new Blob([text.startsWith('﻿') ? text : '﻿' + text], {type: 'text/plain;charset=utf-8'}));
    const a = el('a', {href: url, download: name}); document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  };
  CP.initials = n => { const p = String(n || '?').trim().split(/\s+/); return ((p[0] || '?')[0] + (p[1] ? p[1][0] : '')).toUpperCase(); };

  /* ---------- fichiers de questions ---------- */
  CP.parse = function (text) {
    const r = window.txtToBank(text);
    const d = r.data;
    const n = d.quiz.length + d.vf.length + d.actions.length + d.mimes.length;
    return {data: d, errors: r.errors, total: n, counts: {quiz: d.quiz.length, vf: d.vf.length, actions: d.actions.length, mimes: d.mimes.length}};
  };
  CP.countLabel = function (c) {
    const parts = [];
    if (c.quiz) parts.push(`${c.quiz} quiz`);
    if (c.vf) parts.push(`${c.vf} vrai/faux`);
    if (c.actions) parts.push(`${c.actions} actions`);
    if (c.mimes) parts.push(`${c.mimes} mimes`);
    return parts.join(' · ') || 'aucune question';
  };
  CP.play = function (text, titre) {
    try { localStorage.setItem('classeparty-import', JSON.stringify({text, titre, at: Date.now()})); }
    catch (e) { CP.toast('Impossible de préparer le cours dans ce navigateur.'); return; }
    location.href = 'jouer.html';
  };
  CP.preview = function (course) {
    const p = CP.parse(course.contenu);
    const items = [];
    p.data.quiz.forEach(q => items.push(['quiz', 'Quiz', q.q, 'Réponse : ' + (q.options[q.correct] || '')]));
    p.data.vf.forEach(v => items.push(['vf', 'Vrai/Faux', v.q, 'Réponse : ' + (v.a ? 'Vrai' : 'Faux')]));
    p.data.actions.forEach(a => items.push(['actions', 'Action', a.text, a.hint ? 'Attendu : ' + a.hint : '']));
    p.data.mimes.forEach(m => items.push(['mimes', 'Mime', m, '']));
    CP.modal({
      title: course.titre,
      body: [
        el('div', {class: 'btn-row'}, el('span', {class: 'chip m'}, course.matiere), el('span', {class: 'chip n'}, course.niveau), el('span', {class: 'stat'}, CP.countLabel(p.counts))),
        course.description ? el('p', {}, course.description) : null,
        el('ul', {class: 'qlist'}, items.slice(0, 40).map(([k, lab, q, s]) => el('li', {}, el('span', {class: 'qtag ' + k}, lab), q, s ? el('small', {}, s) : null))),
        items.length > 40 ? el('p', {class: 'muted small'}, `… et ${items.length - 40} autres.`) : null
      ],
      foot: [
        el('button', {type: 'button', class: 'btn go', onclick: () => CP.play(course.contenu, course.titre)}, 'Jouer avec ce cours'),
        el('button', {type: 'button', class: 'btn violet', onclick: () => CP.download('Questions-' + CP.slug(course.titre) + '.txt', course.contenu)}, 'Télécharger (.txt)')
      ]
    });
  };

  /* ---------- comptes ---------- */
  CP.loadProfile = async function () {
    if (!sb || !CP.user) { CP.profile = null; return null; }
    const {data} = await sb.from('profiles').select('*').eq('id', CP.user.id).maybeSingle();
    CP.profile = data || null; return CP.profile;
  };
  CP.isAdmin = () => !!(CP.profile && CP.profile.is_admin);
  CP.signOut = async function () { if (sb) await sb.auth.signOut(); location.href = 'index.html'; };
  CP.report = function (type, id) {
    if (!CP.user) { CP.toast('Connecte-toi pour signaler un contenu.'); return; }
    const ta = el('textarea', {class: 'in', rows: '3', maxlength: '500', placeholder: 'Explique en quelques mots le problème (contenu inadapté, erreur, copie d\'un manuel…)'});
    const msg = el('p', {class: 'msg'});
    const close = CP.modal({title: 'Signaler', body: [el('label', {class: 'field'}, el('span', {}, 'Raison du signalement'), ta), msg], foot: [
      el('button', {type: 'button', class: 'btn red', onclick: async () => {
        const raison = ta.value.trim(); if (raison.length < 3) { msg.className = 'msg err'; msg.textContent = 'Écris au moins quelques mots.'; return; }
        const {error} = await sb.from('reports').insert({cible_type: type, cible_id: id, raison});
        if (error) { msg.className = 'msg err'; msg.textContent = 'Le signalement n\'a pas pu être envoyé. Réessaie plus tard.'; return; }
        close(); CP.toast('Merci ! Le signalement a été envoyé à la modération.');
      }}, 'Envoyer le signalement')]});
  };
  CP.needLogin = function (container, what) {
    container.replaceChildren(el('div', {class: 'panel empty'},
      el('h2', {}, 'Connexion nécessaire'),
      el('p', {class: 'lead'}, `Pour ${what}, connecte-toi ou crée ton compte gratuit.`),
      CP.online ? el('a', {class: 'btn go big', href: 'connexion.html?retour=' + encodeURIComponent(location.pathname.split('/').pop() + location.search)}, 'Se connecter / s\'inscrire')
                : el('p', {class: 'notice'}, 'Les comptes ne sont pas encore activés sur ce site (mode démonstration).')));
  };

  /* ---------- en-tête et pied de page ---------- */
  const NAV = [['index.html', 'Accueil'], ['jouer.html', 'Jouer'], ['bibliotheque.html', 'Bibliothèque'], ['mes-cours.html', 'Mes cours'], ['forum.html', 'Forum'], ['tuto.html', 'Tuto'], ['qui-sommes-nous.html', 'Qui sommes-nous']];
  function renderHeader(page) {
    const head = document.getElementById('site-head'); if (!head) return;
    const nav = el('nav', {class: 'nav', id: 'nav', 'aria-label': 'Menu principal'}, NAV.map(([href, label]) => el('a', {href, 'aria-current': href === page ? 'page' : null}, label)));
    const userBox = el('div', {class: 'user-box', id: 'userBox'});
    const menuBtn = el('button', {type: 'button', class: 'btn small grey menu-btn', 'aria-controls': 'nav', 'aria-expanded': 'false', onclick: () => { const o = nav.classList.toggle('open'); menuBtn.setAttribute('aria-expanded', String(o)); }}, 'Menu');
    head.className = 'site-head';
    head.replaceChildren(
      ONLINE ? null : el('div', {class: 'demo-bar'}, 'Mode démonstration : le jeu fonctionne, les comptes et le partage seront bientôt activés.'),
      el('div', {class: 'wrap head-in'},
        el('a', {class: 'brand', href: 'index.html'}, el('img', {src: 'img/favicon.png', alt: ''}), el('span', {}, 'Classe Party')),
        menuBtn, userBox, nav));
    renderUserBox();
  }
  function renderUserBox() {
    const box = document.getElementById('userBox'); if (!box) return;
    if (CP.user) {
      const name = (CP.profile && CP.profile.display_name) || 'Mon compte';
      box.replaceChildren(
        CP.isAdmin() ? el('a', {class: 'btn small violet', href: 'moderation.html'}, 'Modération') : null,
        el('a', {class: 'btn small blue', href: 'mes-cours.html', title: 'Mon compte et mes cours : ' + name}, el('span', {class: 'avatar', 'aria-hidden': 'true'}, CP.initials(name)), el('span', {class: 'user-name'}, name)),
        el('button', {type: 'button', class: 'btn small grey', onclick: CP.signOut}, 'Déconnexion'));
    } else {
      box.replaceChildren(el('a', {class: 'btn small go', href: 'connexion.html'}, 'Connexion'));
    }
  }
  function renderFooter() {
    const foot = document.getElementById('site-foot'); if (!foot) return;
    foot.className = 'site-foot';
    foot.replaceChildren(el('div', {class: 'wrap foot-in'},
      el('div', {}, el('b', {}, 'Classe Party'), ` v${CP.version} · © ${CP.author}`),
      el('div', {class: 'foot-links'},
        el('a', {href: 'deontologie.html'}, 'Charte de déontologie'),
        el('a', {href: 'confidentialite.html'}, 'Confidentialité'),
        el('a', {href: 'qui-sommes-nous.html'}, 'Qui sommes-nous'),
        el('a', {href: 'tuto.html'}, 'Tuto'),
        CFG.CONTACT_EMAIL ? el('span', {}, 'Contact : ' + CFG.CONTACT_EMAIL) : null)));
  }

  CP.init = async function (page) {
    renderHeader(page); renderFooter();
    if (ONLINE) {
      try {
        const {data} = await sb.auth.getSession();
        CP.user = data && data.session ? data.session.user : null;
        if (CP.user) await CP.loadProfile();
      } catch (e) { CP.user = null; }
      sb.auth.onAuthStateChange(async (ev, session) => {
        const was = CP.user && CP.user.id; CP.user = session ? session.user : null;
        if ((CP.user && CP.user.id) !== was){ await CP.loadProfile(); renderUserBox(); if (CP.onAuthChange) CP.onAuthChange(); }
      });
    }
    renderUserBox();
    return CP;
  };
})();
