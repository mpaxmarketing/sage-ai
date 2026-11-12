/**
 * ApplyCorrections.gs  (Sage_AI Edits, version 2)
 * Applies a JSON array of edits to the Google Doc this script is attached to, all tabs.
 * Specified in MPX 1.2.2 Sage_AI Doc Edits, Version C.
 *
 * Install once: Extensions > Apps Script, paste this file, save, then run onOpen once to authorize.
 * After that the Doc has a Sage_AI Edits menu.
 *
 * Use:
 *   1. Sage_AI Edits > Apply edits...
 *   2. Paste the JSON array. Click Apply.
 *   3. Read the overall message. If an edit failed, click Copy result and send it to Sage_AI.
 *
 * Actions: delete, delete_block, replace, insert_after_block.
 * An inserted line takes the style of a template paragraph (style_from template_starts_with),
 * or a named style such as Heading 2 set on a copy of a plain body paragraph (style_from named_style).
 * Each anchor must match exactly once across all tabs, or that item fails and is skipped.
 * A failed item never stops the run. The run goes on to the next item.
 * After each edit the script reads the Doc again and checks the result.
 * A file problem stops the run before any change: not valid JSON, not an array, empty,
 * an item that is not an object, or an item with a missing or duplicate id.
 * The script does not roll back. Version history in Google Docs is the way back.
 */
const VERSION = '2';
const PAGE_URL = 'https://mpaxmarketing.com/sage-ai-doc-edits/';

const CONFIG = {
  TAB_NAME: ''   // Optional. Restrict the search to one tab by its title.
};

const REQUIRED_ = {
  'delete': ['find'],
  'delete_block': ['starts_with', 'ends_with'],
  'replace': ['find', 'replace_with'],
  'insert_after_block': ['starts_with', 'ends_with', 'insert_text']
};

const HINTS_ = {
  NOT_FOUND: 'Read the document again and quote the anchor from it.',
  AMBIGUOUS: 'Lengthen the anchor until it matches once.',
  MALFORMED: 'Fix the field named in the notes and send the item again.',
  UNSUPPORTED_SHAPE: 'Split the item into a delete and an insert_after_block.',
  CROSSES_TABLE: 'Split the block, or use the pairs form for this passage.',
  BAD_ORDER: 'Swap the anchors so starts_with comes before ends_with.',
  TEMPLATE_NOT_FOUND: 'Name a paragraph that is in the document in style_from, or remove the rule.',
  EXEC_ERROR: 'Read the document, then try the item again or use the pairs form.',
  VERIFY_FAILED: 'Read the document before writing a retry. The document changed.'
};

// ---------- menu and dialog ----------
function onOpen() {
  DocumentApp.getUi().createMenu('Sage_AI Edits').addItem('Apply edits...', 'showDialog').addToUi();
}

function showDialog() {
  const html = HtmlService.createHtmlOutput(dialogHtml_()).setWidth(760).setHeight(700);
  DocumentApp.getUi().showModalDialog(html, 'Apply edits');
}

function dialogHtml_() {
  return DIALOG_HTML_.split('%%VERSION%%').join(VERSION).split('%%PAGE_URL%%').join(PAGE_URL);
}

// Called by the dialog. Applies the list, item by item, and returns the result.
function applyFromDialog(text) {
  const p = parseFile_(text);
  if (p.error) return { error: p.error };
  try {
    const doc = DocumentApp.getActiveDocument();
    const results = applyList_(doc, p.list);
    return buildResult_(doc, results);
  } catch (e) {
    return { error: 'The run stopped with an error: ' + e.message };
  }
}

// A problem with the file as a whole stops the run before any change.
function parseFile_(text) {
  let list;
  try { list = JSON.parse(text); } catch (e) { return { error: 'This is not valid JSON: ' + e.message }; }
  if (!Array.isArray(list)) return { error: 'Expected a JSON array of edits.' };
  if (!list.length) return { error: 'The array is empty. There is nothing to apply.' };
  const seen = {};
  for (let i = 0; i < list.length; i++) {
    const c = list[i];
    if (!c || typeof c !== 'object' || Array.isArray(c)) return { error: 'Item ' + (i + 1) + ' is not an object.' };
    if (c.id === undefined || c.id === null || c.id === '') return { error: 'Item ' + (i + 1) + ' has no id.' };
    if (seen[c.id]) return { error: 'Duplicate id ' + c.id + '.' };
    seen[c.id] = true;
  }
  return { list: list };
}

// ---------- the run ----------
function isGone_(op) { return op.action === 'delete' || op.action === 'delete_block'; }

function applyList_(doc, list) {
  // Internal read only pass. It changes nothing and is not shown. It exists for one rule:
  // a delete whose text is gone reads ALREADY_APPLIED when another item in the file does.
  let items = scan_(doc);
  const first = list.map(op => plan_(op, items));
  const confirmed = first.some(p => p.status === 'ALREADY_APPLIED');
  const out = [];
  list.forEach(op => {
    let pl = plan_(op, items);
    if (confirmed && isGone_(op) && pl.status === 'FAILED' && pl.code === 'NOT_FOUND') pl = { status: 'ALREADY_APPLIED', detail: 'text is already gone' };
    if (pl.status === 'ALREADY_APPLIED') { out.push(row_(op, 'ALREADY_APPLIED', null, pl.detail || '', null, '')); return; }
    if (pl.status === 'FAILED') { out.push(row_(op, 'FAILED', pl.code, pl.detail, pl.found, pl.hint)); return; }
    try { exec_(pl); } catch (e) {
      items = safeScan_(doc, items);
      out.push(row_(op, 'FAILED', 'EXEC_ERROR', String(e), { message: String(e) }, HINTS_.EXEC_ERROR));
      return;
    }
    items = scan_(doc);
    const v = verify_(op, items);
    if (v.ok) out.push(row_(op, 'APPLIED, VERIFIED', null, v.msg, null, ''));
    else out.push(row_(op, 'APPLIED, VERIFY FAILED', 'VERIFY_FAILED', v.msg, v.found, HINTS_.VERIFY_FAILED));
  });
  return out;
}

function safeScan_(doc, fallback) {
  try { return scan_(doc); } catch (e) { return fallback; }
}

function row_(op, status, code, detail, found, hint) {
  return { id: String(op.id), action: String(op.action), status: status, code: code || '', detail: detail || '', found: found || null, hint: hint || '' };
}

function buildResult_(doc, rows) {
  const c = { total: rows.length, applied_verified: 0, already_applied: 0, failed: 0, verify_failed: 0 };
  rows.forEach(r => {
    if (r.status === 'APPLIED, VERIFIED') c.applied_verified++;
    else if (r.status === 'ALREADY_APPLIED') c.already_applied++;
    else if (r.status === 'FAILED') c.failed++;
    else c.verify_failed++;
  });
  const message = overallMessage_(c);
  const clean = c.failed === 0 && c.verify_failed === 0;
  const report = {
    script: 'Sage_AI Edits',
    version: VERSION,
    document: doc.getName(),
    ran_at: new Date().toISOString(),
    summary: {
      message: message, total: c.total, applied_verified: c.applied_verified,
      already_applied: c.already_applied, failed: c.failed, verify_failed: c.verify_failed
    },
    results: rows.map(r => {
      const o = { id: r.id, action: r.action, result: r.status };
      if (r.code) o.code = r.code;
      const notes = {};
      if (r.detail) notes.detail = r.detail;
      if (r.found) Object.keys(r.found).forEach(k => { notes[k] = r.found[k]; });
      if (Object.keys(notes).length) o.notes = notes;
      if (r.hint) o.hint = r.hint;
      return o;
    })
  };
  return { rows: rows, message: message, clean: clean, counts: c, report: JSON.stringify(report, null, 1) };
}

function overallMessage_(c) {
  const done = c.applied_verified + c.already_applied;
  if (c.failed === 0 && c.verify_failed === 0) {
    if (c.applied_verified === 0) return 'Every item is already applied. Nothing was changed.';
    if (c.already_applied === 0) return 'All ' + c.total + ' edits applied and verified.';
    return c.total + ' edits done. ' + c.applied_verified + ' applied and verified, ' + c.already_applied + ' already applied.';
  }
  if (c.applied_verified === 0 && c.verify_failed === 0 && c.already_applied === 0) {
    return 'No edits were applied. ' + c.failed + ' failed. Copy the result and send it to Sage_AI.';
  }
  let m = c.applied_verified + ' of ' + c.total + ' edits applied. ' + c.failed + (c.failed === 1 ? ' failed and was skipped.' : ' failed and were skipped.');
  if (c.verify_failed) m += ' ' + c.verify_failed + (c.verify_failed === 1 ? ' applied but did not pass the check.' : ' applied but did not pass the check.');
  return m + ' Copy the result and send it to Sage_AI.';
}

const DIALOG_HTML_ = `<!DOCTYPE html><html><head><base target="_top"><style>
body{font:14px Archivo,'Segoe UI',Arial,sans-serif;margin:0;color:#131418}
.hdr{background:#131418;color:#e6e8ec;display:flex;align-items:center;padding:10px 16px}
.hdr svg{width:40px;height:40px;flex:none}
.wm{font-weight:600;font-size:21px;margin-left:12px}
.lbl{margin-left:auto;font:11px 'JetBrains Mono',Consolas,monospace;letter-spacing:.1em;text-transform:uppercase}
.main{padding:12px 16px}
p{margin:0 0 8px}
.note{color:#4a4d57;font-size:12px}
a{color:#8a6a00;text-decoration:underline}
textarea{width:100%;height:150px;box-sizing:border-box;font:12px 'JetBrains Mono',Consolas,monospace;border:1px solid #8b8f9c;border-radius:3px;padding:6px}
button{font:600 14px Archivo,'Segoe UI',Arial,sans-serif;padding:8px 16px;border-radius:3px;border:1px solid transparent;margin:8px 8px 8px 0;cursor:pointer;line-height:1.25}
#ap{background:#d6a302;color:#131418}#ap:hover{background:#b98c02}
#cp{background:#fff;color:#131418;border-color:#8b8f9c}
button:disabled{opacity:.5;cursor:default}
button:focus-visible,textarea:focus-visible,a:focus-visible{outline:2px solid #8a6a00;outline-offset:2px}
#overall{margin:6px 0;padding:8px 10px;border-radius:5px;font-weight:600;display:none}
.good{background:#f1f7f1;color:#276b2b}.bad{background:#fdf1f0;color:#8f1d17}.neutral{background:#f3f4f6;color:#363942}
#res{max-height:210px;overflow:auto;margin-top:4px}
table{border-collapse:collapse;width:100%}td,th{border:1px solid #d3d6dd;padding:4px 6px;text-align:left;font-size:12px;vertical-align:top}
td.ok{color:#276b2b}td.na{color:#636773}td.fail{color:#8f1d17;background:#fdf1f0;font-weight:600}
#rep{height:90px;display:none;margin-top:6px}
</style></head><body>
<div class="hdr">
<svg viewBox="0 0 560 560" role="img" aria-label="M-PaX"><path d="M80,110 A24,24 0 0 1 104,86 L456,86 A24,24 0 0 1 480,110 L480,264 C480,372 402,448 280,496 C158,448 80,372 80,264 Z" fill="#d6a302"/><path d="M150,314 L218,314 L218,392 L150,392 Z" fill="#131418"/><path d="M246,260 L314,260 L314,392 L246,392 Z" fill="#131418"/><path d="M342,206 L410,206 L410,392 L342,392 Z" fill="#131418"/></svg>
<span class="wm">M-PaX</span><span class="lbl">Sage_AI Edits</span>
</div>
<div class="main">
<p>Sage_AI prepared a list of edits for this document. Nothing changes until you click Apply. Each edit is checked after it is made. An edit that fails is skipped and reported.</p>
<div class="note"><a href="%%PAGE_URL%%" target="_blank" rel="noopener">How Sage_AI Edits works</a>. Sage_AI Edits version %%VERSION%%.</div>
<p style="margin-top:10px">Paste the edits JSON array:</p>
<textarea id="json"></textarea>
<div><button id="ap" onclick="apply()">Apply</button><span id="msg" class="note"></span></div>
<div id="overall"></div>
<div id="res"></div>
<div id="cpbar" style="display:none"><button id="cp" onclick="copyResult()">Copy result</button><span id="cpmsg" class="note"></span></div>
<textarea id="rep" readonly aria-label="Result report"></textarea>
</div>
<script>
function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
function cls(st){if(st==='APPLIED, VERIFIED')return 'ok';if(st==='ALREADY_APPLIED')return 'na';return 'fail'}
function notes(r){
  var h='';
  if(r.detail)h+=esc(r.detail);
  if(r.hint&&(r.status==='FAILED'||r.status==='APPLIED, VERIFY FAILED'))h+='<div class="note">'+esc(r.hint)+'</div>';
  return h;
}
function show(r){
  var o=document.getElementById('overall');
  o.style.display='block';o.className=r.clean?(r.counts.applied_verified?'good':'neutral'):'bad';o.textContent=r.message;
  var h='<table><tr><th>Id</th><th>Action</th><th>Result</th><th>Notes</th></tr>';
  r.rows.forEach(function(x){
    h+='<tr><td>'+esc(x.id)+'</td><td>'+esc(x.action)+'</td><td class="'+cls(x.status)+'">'+esc(x.status)+(x.code?' ('+esc(x.code)+')':'')+'</td><td>'+notes(x)+'</td></tr>';
  });
  document.getElementById('res').innerHTML=h+'</table>';
  var rep=document.getElementById('rep');rep.value=r.report;rep.style.display='block';
  document.getElementById('cpbar').style.display='block';
  document.getElementById('cpmsg').textContent='';
}
function busy(on,t){document.getElementById('ap').disabled=on;document.getElementById('msg').textContent=t||'';}
function failBox(t){var o=document.getElementById('overall');o.style.display='block';o.className='bad';o.textContent=t;
  document.getElementById('res').innerHTML='';document.getElementById('cpbar').style.display='none';document.getElementById('rep').style.display='none';}
function apply(){
  busy(true,'Applying...');
  google.script.run.withSuccessHandler(function(r){busy(false,'');
    if(r.error){failBox(r.error);return;}
    show(r);
  }).withFailureHandler(function(e){busy(false,'');failBox(e.message);}).applyFromDialog(document.getElementById('json').value);
}
function copyResult(){
  var ta=document.getElementById('rep'),m=document.getElementById('cpmsg');
  function manual(){ta.focus();ta.select();var ok=false;try{ok=document.execCommand('copy');}catch(e){}
    m.textContent=ok?'Copied.':'Select the text in the box and copy it.';}
  if(navigator.clipboard&&navigator.clipboard.writeText){
    navigator.clipboard.writeText(ta.value).then(function(){m.textContent='Copied.';},manual);
  }else{manual();}
}
</script></body></html>`;

// ---------- reading the doc ----------
function norm_(s) {
  return String(s).replace(/[ \u000b\t]/g, ' ').replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim();
}
function fold_(s) { // one for one, so offsets stay valid
  return String(s).replace(/[ \u000b\t]/g, ' ').replace(/[‘’]/g, "'").replace(/[“”]/g, '"');
}
function splitLines_(s) { return String(s).split('\n'); }
function stripBullet_(l) { return l.replace(/^- /, ''); }

function scan_(doc) {
  const items = [];
  const bodies = [];
  if (typeof doc.getTabs === 'function') {
    const walk = tabs => tabs.forEach(t => {
      const dt = t.asDocumentTab();
      if (dt) bodies.push({ name: t.getTitle(), body: dt.getBody() });
      walk(t.getChildTabs());
    });
    walk(doc.getTabs());
  } else {
    bodies.push({ name: '(document)', body: doc.getBody() });
  }
  bodies.forEach(b => {
    if (CONFIG.TAB_NAME && b.name !== CONFIG.TAB_NAME) return;
    const n = b.body.getNumChildren();
    let pos = 0;
    for (let i = 0; i < n; i++) {
      const el = b.body.getChild(i);
      const ty = el.getType();
      let text = null;
      if (ty === DocumentApp.ElementType.PARAGRAPH) text = el.asParagraph().getText();
      else if (ty === DocumentApp.ElementType.LIST_ITEM) text = el.asListItem().getText();
      if (text === null) continue;
      pos++;
      items.push({ tab: b.name, body: b.body, idx: i, pos: pos, el: el, type: ty, text: norm_(text), raw: text });
    }
  });
  return items;
}

function findConsecutive_(items, lines) {
  const L = lines.map(norm_), res = [];
  for (let j = 0; j + L.length <= items.length; j++) {
    let ok = true;
    for (let t = 0; t < L.length; t++) {
      const it = items[j + t];
      if (it.text !== L[t] || it.body !== items[j].body || it.idx !== items[j].idx + t) { ok = false; break; }
    }
    if (ok) res.push(j);
  }
  return res;
}

// ---------- notes for a failure ----------
function snippet_(s, n) { s = String(s); return s.length > n ? s.slice(0, n) : s; }

function where_(items, positions) {
  return positions.slice(0, 5).map(p => ({ tab: items[p].tab, position: items[p].pos, text: snippet_(items[p].text, 80) }));
}

// The paragraph that shares the longest opening (or ending) with the anchor, with where the two first differ.
function closest_(items, text, atEnd) {
  const a = norm_(text);
  let best = null, bestLen = 0;
  items.forEach(it => {
    const t = it.text;
    let n = 0;
    if (atEnd) { while (n < a.length && n < t.length && a[a.length - 1 - n] === t[t.length - 1 - n]) n++; }
    else { while (n < a.length && n < t.length && a[n] === t[n]) n++; }
    if (n > bestLen) { bestLen = n; best = it; }
  });
  if (!best || bestLen < 20) return null;
  const t = best.text;
  const o = { tab: best.tab, position: best.pos, text: snippet_(t, 160), shared_characters: bestLen };
  if (atEnd) {
    o.anchor_before_the_shared_end = a.slice(Math.max(0, a.length - bestLen - 30), a.length - bestLen);
    o.document_before_the_shared_end = t.slice(Math.max(0, t.length - bestLen - 30), t.length - bestLen);
  } else {
    o.anchor_next = a.slice(bestLen, bestLen + 30);
    o.document_next = t.slice(bestLen, bestLen + 30);
  }
  return o;
}

function fail_(code, detail, found) {
  return { status: 'FAILED', code: code, detail: detail, found: found || null, hint: HINTS_[code] || '' };
}

function notFoundFind_(items, F, label) {
  const lines = F.map(norm_);
  for (let i = 0; i < lines.length; i++) {
    if (!items.some(it => it.text === lines[i])) {
      return fail_('NOT_FOUND', label + ' line ' + (i + 1) + ' is not in any tab', {
        anchor: label + ' line ' + (i + 1), anchor_text: snippet_(lines[i], 120), closest: closest_(items, lines[i], false) });
    }
  }
  return fail_('NOT_FOUND', 'every line is in the document, but not as consecutive paragraphs in this order', {
    anchor: label, anchor_text: snippet_(lines[0], 120), closest: null });
}

// ---------- planning (read only) ----------
function validate_(op) {
  const req = REQUIRED_[op.action];
  if (!req) return fail_('MALFORMED', 'unknown action: ' + op.action, { field: 'action' });
  for (let k = 0; k < req.length; k++) {
    if (typeof op[req[k]] !== 'string' || !op[req[k]].length) return fail_('MALFORMED', 'missing field ' + req[k], { field: req[k] });
  }
  return null;
}

function plan_(op, items) {
  const bad = validate_(op);
  if (bad) return bad;
  try {
    switch (op.action) {
      case 'delete': return planDelete_(op, items);
      case 'delete_block': return planDeleteBlock_(op, items);
      case 'replace': return planReplace_(op, items);
      case 'insert_after_block': return planInsertAfterBlock_(op, items);
    }
    return fail_('MALFORMED', 'unknown action: ' + op.action, { field: 'action' });
  } catch (e) { return fail_('EXEC_ERROR', String(e), { message: String(e) }); }
}

function planDelete_(op, items) {
  const F = splitLines_(op.find), m = findConsecutive_(items, F);
  if (m.length === 0) return notFoundFind_(items, F, 'find');
  if (m.length > 1) return fail_('AMBIGUOUS', m.length + ' matches', { matches: m.length, where: where_(items, m) });
  const acts = [];
  for (let t = 0; t < F.length; t++) acts.push({ type: 'remove', item: items[m[0] + t] });
  return { status: 'OK', detail: 'remove ' + F.length + ' paragraph(s) in ' + items[m[0]].tab, actions: acts };
}

function blockRange_(op, items) {
  const s = norm_(op.starts_with), e = norm_(op.ends_with);
  const S = [], E = [];
  items.forEach((it, p) => { if (it.text.indexOf(s) === 0) S.push(p); if (it.text.length >= e.length && it.text.slice(-e.length) === e) E.push(p); });
  return { S: S, E: E };
}

// Shared by delete_block and insert_after_block. Returns { fail } or { a, b }.
function checkBlock_(op, items) {
  const r = blockRange_(op, items);
  if (r.S.length === 0 || r.E.length === 0) {
    const found = {};
    found.starts_with = r.S.length === 0
      ? { matches: 0, anchor_text: snippet_(norm_(op.starts_with), 120), closest: closest_(items, op.starts_with, false) }
      : { matches: r.S.length };
    found.ends_with = r.E.length === 0
      ? { matches: 0, anchor_text: snippet_(norm_(op.ends_with), 120), closest: closest_(items, op.ends_with, true) }
      : { matches: r.E.length };
    return { fail: fail_('NOT_FOUND', (r.S.length === 0 ? 'starts_with' : 'ends_with') + ' is not in any tab', found) };
  }
  if (r.S.length !== 1 || r.E.length !== 1) {
    const found = {};
    found.starts_with = { matches: r.S.length, where: where_(items, r.S) };
    found.ends_with = { matches: r.E.length, where: where_(items, r.E) };
    return { fail: fail_('AMBIGUOUS', 'starts_with matches ' + r.S.length + ', ends_with matches ' + r.E.length, found) };
  }
  const a = r.S[0], b = r.E[0];
  if (b < a) return { fail: fail_('BAD_ORDER', 'ends_with is before starts_with', {
    starts_with: { tab: items[a].tab, position: items[a].pos }, ends_with: { tab: items[b].tab, position: items[b].pos } }) };
  if (items[a].body !== items[b].body || items[b].idx - items[a].idx !== b - a) {
    return { fail: fail_('CROSSES_TABLE', items[a].body !== items[b].body ? 'the block crosses into another tab' : 'something other than paragraphs sits inside the block, such as a table', {
      starts_with: { tab: items[a].tab, position: items[a].pos }, ends_with: { tab: items[b].tab, position: items[b].pos },
      note: items[a].body !== items[b].body ? 'The two anchors are in different tabs.' : 'A table or other element sits between the two anchors.' }) };
  }
  return { a: a, b: b };
}

function planDeleteBlock_(op, items) {
  const c = checkBlock_(op, items);
  if (c.fail) return c.fail;
  const acts = [];
  for (let p = c.a; p <= c.b; p++) acts.push({ type: 'remove', item: items[p] });
  return { status: 'OK', detail: 'remove ' + (c.b - c.a + 1) + ' paragraph(s) in ' + items[c.a].tab, actions: acts };
}

const NAMED_STYLES_ = ['Normal', 'Title', 'Subtitle', 'Heading 1', 'Heading 2', 'Heading 3', 'Heading 4', 'Heading 5', 'Heading 6'];

function namedStyle_(name) {
  const H = DocumentApp.ParagraphHeading;
  const map = { 'Normal': H.NORMAL, 'Title': H.TITLE, 'Subtitle': H.SUBTITLE, 'Heading 1': H.HEADING1, 'Heading 2': H.HEADING2,
    'Heading 3': H.HEADING3, 'Heading 4': H.HEADING4, 'Heading 5': H.HEADING5, 'Heading 6': H.HEADING6 };
  return map[String(name)] || null;
}

// A plain body paragraph to copy when a named style is set: the first at or after fromPos, else the first in the document.
function bodyBase_(items, fromPos) {
  const plain = [];
  items.forEach((it, p) => {
    if (it.type === DocumentApp.ElementType.PARAGRAPH && it.text.length > 0 &&
        it.el.asParagraph().getHeading() === DocumentApp.ParagraphHeading.NORMAL) plain.push(p);
  });
  if (!plain.length) return null;
  const after = plain.filter(p => p >= fromPos);
  return items[after.length ? after[0] : plain[0]];
}

function pickTemplate_(op, items, line, defTpl, fromPos) {
  const rules = op.style_from || [];
  for (let i = 0; i < rules.length; i++) {
    if (line.indexOf(rules[i].line_starts_with) === 0) {
      if (rules[i].named_style !== undefined) {
        const h = namedStyle_(rules[i].named_style);
        if (!h) { const e = new Error('unknown named_style: ' + rules[i].named_style); e.code = 'MALFORMED'; e.found = { field: 'style_from', named_style: String(rules[i].named_style), allowed: NAMED_STYLES_ }; throw e; }
        const base = bodyBase_(items, fromPos);
        if (!base) { const e = new Error('no plain body paragraph to copy for named_style'); e.code = 'TEMPLATE_NOT_FOUND'; e.found = { named_style: String(rules[i].named_style) }; throw e; }
        return { el: base.el, type: base.type, body: base.body, namedStyle: h };
      }
      const ts = norm_(rules[i].template_starts_with);
      const c = [];
      items.forEach((it, p) => { if (it.text.indexOf(ts) === 0) c.push(p); });
      if (!c.length) { const e = new Error('template not found: ' + rules[i].template_starts_with); e.code = 'TEMPLATE_NOT_FOUND'; e.found = { template_starts_with: rules[i].template_starts_with }; throw e; }
      const after = c.filter(p => p >= fromPos);
      return items[after.length ? after[0] : c[0]];
    }
  }
  return defTpl;
}

function planReplace_(op, items) {
  const F = splitLines_(op.find), R = splitLines_(op.replace_with);
  const done = findConsecutive_(items, R.map(stripBullet_));
  if (done.length === 1) return { status: 'ALREADY_APPLIED', detail: '' };
  if (done.length > 1) return fail_('AMBIGUOUS', 'replacement text appears ' + done.length + ' times', { matches: done.length, where: where_(items, done) });
  const m = findConsecutive_(items, F);
  if (m.length === 0) return notFoundFind_(items, F, 'find');
  if (m.length > 1) return fail_('AMBIGUOUS', m.length + ' matches', { matches: m.length, where: where_(items, m) });
  const j = m[0], k = F.length, mm = R.length;
  const nf = F.map(norm_), nr = R.map(norm_);
  let p = 0; while (p < k && p < mm && nr[p] === nf[p]) p++;
  let s = 0; while (s < k - p && s < mm - p && nr[mm - 1 - s] === nf[k - 1 - s]) s++;
  if (p + s === k && mm > k) {
    const lines = R.slice(p, mm - s);
    const ref = p > 0 ? items[j + p - 1] : items[j];
    let acts;
    try {
      acts = [{ type: 'insert', where: p > 0 ? 'after' : 'before', ref: ref, lines: lines.map(l => ({
        text: stripBullet_(l), tpl: pickTemplate_(op, items, l, ref, j) })) }];
    } catch (e) { if (e.code) return fail_(e.code, e.message, e.found); throw e; }
    return { status: 'OK', detail: 'insert ' + lines.length + ' paragraph(s) in ' + ref.tab, actions: acts };
  }
  if (mm === k) {
    const acts = [];
    for (let i = 0; i < k; i++) if (nr[i] !== nf[i]) acts.push({ type: 'edit', item: items[j + i], newText: stripBullet_(R[i]) });
    return { status: 'OK', detail: 'edit ' + acts.length + ' paragraph(s) in ' + items[j].tab, actions: acts };
  }
  return fail_('UNSUPPORTED_SHAPE', 'unsupported replace shape', {
    find_lines: k, replace_with_lines: mm,
    supported: ['replace_with is find with new lines added at the start or the end', 'find and replace_with have the same number of lines'] });
}

function planInsertAfterBlock_(op, items) {
  const r = blockRange_(op, items);
  const lines = splitLines_(op.insert_text);
  if (r.S.length === 1 && r.E.length === 1) {
    const b = r.E[0], n = lines.length;
    if (b + n < items.length) {
      const next = items.slice(b + 1, b + 1 + n).map(it => it.text).join('\n');
      if (next === lines.map(l => norm_(stripBullet_(l))).join('\n')) return { status: 'ALREADY_APPLIED', detail: '' };
    }
  }
  const c = checkBlock_(op, items);
  if (c.fail) return c.fail;
  const defTpl = items[c.a]; // the first item of the block carries the level to copy
  let acts;
  try {
    acts = [{ type: 'insert', where: 'after', ref: items[c.b], lines: lines.map(l => ({
      text: stripBullet_(l), tpl: pickTemplate_(op, items, l, defTpl, c.a) })) }];
  } catch (e) { if (e.code) return fail_(e.code, e.message, e.found); throw e; }
  return { status: 'OK', detail: 'insert ' + lines.length + ' paragraph(s) after the block in ' + items[c.b].tab, actions: acts };
}

// ---------- executing ----------
function exec_(pl) {
  pl.actions.forEach(a => {
    if (a.type === 'remove') a.item.el.removeFromParent();
    else if (a.type === 'edit') editText_(a.item, a.newText);
    else if (a.type === 'insert') insertLines_(a);
  });
}

function editText_(item, newText) {
  const actual = item.raw, fa = fold_(actual), fn = fold_(newText);
  let pre = 0; while (pre < fa.length && pre < fn.length && fa[pre] === fn[pre]) pre++;
  let suf = 0; while (suf < fa.length - pre && suf < fn.length - pre && fa[fa.length - 1 - suf] === fn[fn.length - 1 - suf]) suf++;
  const t = item.el.editAsText();
  const endA = actual.length - suf;
  if (endA > pre) t.deleteText(pre, endA - 1);
  const ins = newText.slice(pre, newText.length - suf);
  if (ins.length) t.insertText(pre, ins);
}

function insertLines_(a) {
  const body = a.ref.body;
  let idx = a.where === 'after' ? body.getChildIndex(a.ref.el) + 1 : body.getChildIndex(a.ref.el);
  a.lines.forEach(l => {
    const copy = l.tpl.el.copy();
    if (l.tpl.namedStyle) {
      const pg = copy.asParagraph(); pg.setText(l.text);
      try { pg.editAsText().setLinkUrl(null); } catch (e) {}
      pg.setHeading(l.tpl.namedStyle);
      body.insertParagraph(idx, pg);
    } else if (l.tpl.type === DocumentApp.ElementType.LIST_ITEM) {
      const li = copy.asListItem(); li.setText(l.text);
      try { li.editAsText().setLinkUrl(null); } catch (e) {}
      body.insertListItem(idx, li);
    } else {
      const pg = copy.asParagraph(); pg.setText(l.text);
      try { pg.editAsText().setLinkUrl(null); } catch (e) {}
      body.insertParagraph(idx, pg);
    }
    idx++;
  });
}

// ---------- verifying ----------
function verify_(op, items) {
  switch (op.action) {
    case 'delete': { const n = findConsecutive_(items, splitLines_(op.find)).length; return { ok: n === 0, msg: n ? 'find text still present' : 'gone', found: { expected: 'find text gone', found_count: n } }; }
    case 'delete_block': { const r = blockRange_(op, items); const n = r.S.length + r.E.length; return { ok: n === 0, msg: n ? 'anchors still present' : 'gone', found: { expected: 'anchors gone', found_count: n } }; }
    case 'replace': { const n = findConsecutive_(items, splitLines_(op.replace_with).map(stripBullet_)).length; return { ok: n === 1, msg: n === 1 ? 'new text present once' : 'new text found ' + n + ' times', found: { expected: 'new text present once', found_count: n } }; }
    case 'insert_after_block': { const n = findConsecutive_(items, splitLines_(op.insert_text).map(stripBullet_)).length; return { ok: n === 1, msg: n === 1 ? 'new text present once' : 'new text found ' + n + ' times', found: { expected: 'new text present once', found_count: n } }; }
  }
  return { ok: false, msg: 'unknown action', found: null };
}
