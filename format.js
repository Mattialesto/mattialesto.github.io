/* Classe Party - lecture des fichiers de questions (.txt), identique au jeu */
(function(){
'use strict';
const TXT_SECTIONS = {QUIZ:'quiz', VRAIFAUX:'vf', VF:'vf', VRAIOUFAUX:'vf', ACTIONS:'actions', ACTION:'actions', MIMES:'mimes', MIME:'mimes', CHANCE:'chance', MALCHANCE:'malchance', REGLAGES:'settings', REGLAGE:'settings', PARAMETRES:'settings', COURS:'settings'};
function txtNorm(t){ return String(t).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z]/g, ''); }
function oneLine(t){ return String(t ?? '').replace(/\s*\r?\n\s*/g, ' ').trim(); }
function txtToBank(text){
  const out = {quiz:[], vf:[], actions:[], mimes:[], chance:[], malchance:[], settings:{}, present:new Set()};
  const errors = [];
  let section = null, cur = null;
  const err = (i, m) => errors.push(`Ligne ${i + 1} : ${m}`);
  const lines = String(text).replace(/^\ufeff/, '').split(/\r\n|\n|\r/);
  lines.forEach((raw, i) => {
    let t = raw.replace(/\t/g, ' ').trim();
    if (!t){ cur = null; return; }
    if (t.startsWith('#')) return;
    const sm = t.match(/^\[([^\]]+)\]/);
    if (sm){
      const key = TXT_SECTIONS[txtNorm(sm[1])];
      if (!key){ err(i, `section « ${sm[1]} » inconnue (sections : QUIZ, VRAI-FAUX, ACTIONS, MIMES, CHANCE, MALCHANCE, RÉGLAGES).`); section = null; }
      else { section = key; out.present.add(key); }
      cur = null; return;
    }
    if (!section){ err(i, 'texte en dehors d\'une section, ligne ignorée.'); return; }
    let m;
    if (section === 'settings'){
      m = t.match(/^([^=:]+)[=:](.*)$/); if (!m){ err(i, 'réglage non compris (format : Nom = valeur).'); return; }
      const k = txtNorm(m[1]), v = m[2].trim();
      if (k === 'TITRE') out.settings.title = v;
      else if (k === 'SOUSTITRE') out.settings.subtitle = v;
      else if (k.startsWith('ETOILE')) out.settings.bestStar = v;
      else if (k === 'COURS') out.settings.course = v;
      return;
    }
    if (section === 'quiz'){
      if ((m = t.match(/^Q\s*[:.)]\s*(.*)$/i))){ cur = {q:m[1].trim(), options:[], correct:-1, expl:'', line:i}; out.quiz.push(cur); return; }
      if (!cur){ err(i, 'une question de quiz doit commencer par « Q: ».'); return; }
      if ((m = t.match(/^\*\s*(.*)$/))){ if (cur.correct >= 0) err(i, 'deux bonnes réponses (*) pour la même question : la première est gardée.'); else cur.correct = cur.options.length; cur.options.push(m[1].trim()); return; }
      if ((m = t.match(/^[-–—•]\s*(.*)$/))){ cur.options.push(m[1].trim()); return; }
      if ((m = t.match(/^E\s*[:.)]\s*(.*)$/i))){ cur.expl = m[1].trim(); return; }
      if (!cur.options.length){ cur.q += ' ' + t; return; }
      err(i, 'ligne non comprise dans le quiz (commence par *, - ou E:).'); return;
    }
    if (section === 'vf'){
      if ((m = t.match(/^(V|VRAI|F|FAUX)\s*[:.)]\s*(.*)$/i))){ cur = {q:m[2].trim(), a:/^v/i.test(m[1]), expl:''}; out.vf.push(cur); return; }
      if ((m = t.match(/^E\s*[:.)]\s*(.*)$/i)) && cur){ cur.expl = m[1].trim(); return; }
      err(i, 'un vrai-faux commence par « V: » (vrai) ou « F: » (faux).'); return;
    }
    if (section === 'actions'){
      if ((m = t.match(/^A\s*[:.)]\s*(.*)$/i))){ cur = {text:m[1].trim(), hint:''}; out.actions.push(cur); return; }
      if ((m = t.match(/^R\s*[:.)]\s*(.*)$/i)) && cur){ cur.hint = m[1].trim(); return; }
      if (!cur){ cur = {text:t, hint:''}; out.actions.push(cur); return; }
      err(i, 'une action commence par « A: », sa réponse par « R: ».'); return;
    }
    if (section === 'mimes'){ const w = t.replace(/^[-–—•*]\s*/, '').trim(); if (w) out.mimes.push(w); return; }
    if (section === 'chance' || section === 'malchance'){
      const parts = t.split('|'); if (parts.length < 2){ err(i, 'carte non comprise (format : effet | texte).'); return; }
      const eff = parts[0].trim(), txt = parts.slice(1).join('|').trim();
      if (!txt){ err(i, 'la carte n\'a pas de texte.'); return; }
      const e = txtNorm(eff);
      if (e.startsWith('REJOUE')){ out[section].push({text:txt, kind:'replay', value:0}); return; }
      if (e.startsWith('PRISON')){ out[section].push({text:txt, kind:'prison', value:0}); return; }
      m = eff.replace('−', '-').match(/^([+-]?)\s*(\d+)\s*([a-zA-Zèé]*)/);
      if (!m){ err(i, `effet « ${eff} » non compris (ex. : +3 pièces, -2 cases, Rejoue, Prison).`); return; }
      let v = parseInt(m[2], 10); if (m[1] === '-' || (!m[1] && section === 'malchance')) v = -v;
      const unit = txtNorm(m[3]);
      out[section].push({text:txt, kind: unit.startsWith('CASE') ? 'move' : 'coins', value:v}); return;
    }
  });
  out.quiz = out.quiz.filter(q => {
    const n = q.line + 1; q.options = q.options.filter(o => o);
    if (!q.q){ errors.push(`Ligne ${n} : question vide, ignorée.`); return false; }
    if (q.options.length < 2){ errors.push(`Ligne ${n} : « ${q.q.slice(0, 40)} » a moins de 2 réponses, ignorée.`); return false; }
    if (q.correct < 0){ errors.push(`Ligne ${n} : « ${q.q.slice(0, 40)} » n'a pas de bonne réponse (*), ignorée.`); return false; }
    if (q.options.length > 4){ errors.push(`Ligne ${n} : « ${q.q.slice(0, 40)} » a plus de 4 réponses, seules les 4 premières sont gardées.`); if (q.correct > 3){ q.options[3] = q.options[q.correct]; q.correct = 3; } q.options = q.options.slice(0, 4); }
    while (q.options.length < 4) q.options.push('');
    delete q.line; return true;
  });
  out.vf = out.vf.filter(v => v.q); out.actions = out.actions.filter(a => a.text);
  errors.sort((x, y) => parseInt(x.slice(6), 10) - parseInt(y.slice(6), 10));
  return {data:out, errors};
}

window.txtToBank = txtToBank;
})();
