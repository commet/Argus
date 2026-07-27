/**
 * The settle card — MCP Apps view source (single self-contained document).
 *
 * Design language: the horizon system. No box frames; thin rules above and
 * below like a logbook page; the user's prediction is the hero line; five
 * reality outcomes as quiet buttons; the anchor ⚓ appears exactly once, on
 * the closing rule, only after the loop actually ties (the receipt state).
 * Dark and light themes follow the host (ui/initialize hostContext.theme).
 *
 * Protocol: SEP-1865 dialect over postMessage — ui/initialize handshake,
 * ui/notifications/tool-input | tool-result inbound, tools/call outbound.
 * Fully inline (default restrictive CSP applies; no external origins).
 */
export const SETTLE_APP_HTML = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<style>
  :root {
    --bg: #0e1116; --ink: #e9e5da; --sub: #98a0ad; --faint: #6a7280;
    --rule: #2a303a; --gold: #d3b271; --gold-dim: #9a824f;
    --tint: rgba(211,178,113,.08); --btn-bg: #141922; --danger: #c4756a;
  }
  [data-theme="light"] {
    --bg: #faf8f3; --ink: #23272e; --sub: #5c6470; --faint: #9aa1ab;
    --rule: #ddd6c8; --gold: #a37f35; --gold-dim: #bfa678;
    --tint: rgba(163,127,53,.07); --btn-bg: #f1ede3; --danger: #a04a3f;
  }
  * { box-sizing: border-box; margin: 0; }
  body {
    background: var(--bg); color: var(--ink);
    font: 14px/1.65 ui-monospace, 'Cascadia Code', 'D2Coding', Consolas, monospace;
    padding: 18px 20px 14px; max-width: 640px;
  }
  .head { display: flex; justify-content: space-between; align-items: baseline; }
  .brand { font-size: 11px; letter-spacing: .22em; color: var(--sub); }
  .brand b { color: var(--ink); font-weight: 600; }
  .when { font-size: 11px; color: var(--faint); }
  hr { border: 0; border-top: 1px solid var(--rule); margin: 10px 0 16px; }
  .predicate { font-size: 15px; line-height: 1.7; margin: 2px 0 6px; }
  .predicate::before { content: '\\201C'; color: var(--gold-dim); }
  .predicate::after  { content: '\\201D'; color: var(--gold-dim); }
  .meta { font-size: 12px; color: var(--sub); margin-bottom: 16px; }
  .ask { font-size: 12px; color: var(--sub); margin: 14px 0 8px; }
  .choices { display: grid; grid-template-columns: repeat(auto-fit, minmax(108px, 1fr)); gap: 8px; }
  button.outcome {
    font: inherit; color: var(--ink); background: var(--btn-bg);
    border: 1px solid var(--rule); border-radius: 8px; padding: 9px 6px 7px;
    cursor: pointer; text-align: center; transition: border-color .12s, background .12s;
  }
  button.outcome small { display: block; font-size: 10px; color: var(--faint); margin-top: 2px; }
  button.outcome:hover { border-color: var(--gold-dim); }
  button.outcome.sel { border-color: var(--gold); background: var(--tint); }
  button.outcome.sel small { color: var(--gold-dim); }
  .follow { display: none; margin-top: 14px; }
  .follow.show { display: block; }
  textarea, input[type=date] {
    font: inherit; width: 100%; color: var(--ink); background: var(--btn-bg);
    border: 1px solid var(--rule); border-radius: 8px; padding: 9px 11px; outline: none;
  }
  textarea { resize: vertical; min-height: 58px; }
  textarea:focus, input[type=date]:focus { border-color: var(--gold-dim); }
  label.small { display: block; font-size: 11px; color: var(--sub); margin: 10px 0 5px; }
  .actions { display: flex; align-items: center; gap: 14px; margin-top: 14px; }
  button.commit {
    font: inherit; font-weight: 600; color: var(--bg); background: var(--gold);
    border: 0; border-radius: 8px; padding: 9px 22px; cursor: pointer;
  }
  button.commit:disabled { opacity: .45; cursor: default; }
  a.skip { font-size: 12px; color: var(--faint); cursor: pointer; text-decoration: none; }
  a.skip:hover { color: var(--sub); }
  .foot { display: flex; justify-content: flex-end; margin-top: 14px; }
  .foot span { font-size: 11px; color: var(--gold-dim); letter-spacing: .04em; }
  .done-outcome { font-size: 13px; color: var(--gold); margin-bottom: 6px; letter-spacing: .06em; }
  .done-what { font-size: 14px; line-height: 1.7; }
  .quiet { font-size: 12px; color: var(--faint); }
  .err { font-size: 13px; color: var(--danger); }
</style>
</head>
<body>
  <div class="head">
    <div class="brand">A R G U S · <b id="title">판단 정산</b></div>
    <div class="when" id="when"></div>
  </div>
  <hr>
  <div id="stage"><div class="quiet" id="loading">…</div></div>
  <div class="foot" id="foot" style="display:none"><span id="sig"></span></div>

<script>
(function () {
  'use strict';
  var rpcId = 1, pending = {}, theme = 'dark';
  var inputArgs = {}, state = null, locale = 'ko';

  function send(m) { window.parent.postMessage(m, '*'); }
  function call(method, params) {
    return new Promise(function (res, rej) {
      var id = rpcId++;
      pending[id] = { res: res, rej: rej };
      send({ jsonrpc: '2.0', id: id, method: method, params: params });
    });
  }
  window.addEventListener('message', function (ev) {
    var m = ev.data;
    if (!m || m.jsonrpc !== '2.0') return;
    if (m.id !== undefined && (m.result !== undefined || m.error !== undefined)) {
      var p = pending[m.id]; delete pending[m.id];
      if (p) { if (m.error) { p.rej(m.error); } else { p.res(m.result); } }
      return;
    }
    if (m.method === 'ui/notifications/tool-input') { inputArgs = (m.params && m.params.arguments) || {}; }
    if (m.method === 'ui/notifications/tool-result') { onResult(m.params || {}); }
  });

  var T = {
    ko: {
      title: '판단 정산', ask: '현실이 어떻게 답했나요?',
      due: function (d) { return '확인일 ' + d; },
      overdue: function (n) { return ' · ' + n + '일 지남'; },
      what: '실제로 무슨 일이 있었나요? 당신의 말 그대로 남습니다.',
      whenAgain: '언제 다시 볼까요?',
      commit: '기록하기', later: '그날 다시', skip: '지금은 넘어가기',
      skipped: '넘어갔습니다. 조르지 않습니다.',
      recorded: '기록했습니다', deferred: function (d) { return d + '에 다시 가져오겠습니다.'; },
      sig: '예측 저장 → 실제 결과 기록 ⚓',
      needWhat: '한 줄이면 됩니다 — 비워두면 기록하지 않습니다.',
      outcomes: [
        ['held', '예측대로', 'held'], ['avoided', '걱정 피함', 'avoided'],
        ['partial', '일부만', 'partial'], ['still_pending', '아직', 'later'],
        ['missed', '빗나감', 'missed']
      ],
      errNoAnswer: '기록하지 못했습니다 — 대화로 이어서 알려주셔도 됩니다.'
    },
    en: {
      title: 'SETTLEMENT', ask: 'What did reality do?',
      due: function (d) { return 'check-by ' + d; },
      overdue: function (n) { return ' · ' + n + 'd past'; },
      what: 'What actually happened? Recorded verbatim, in your words.',
      whenAgain: 'When should I look again?',
      commit: 'Record', later: 'Come back then', skip: 'skip for now',
      skipped: 'Skipped. No re-asking.',
      recorded: 'Recorded', deferred: function (d) { return 'Coming back on ' + d + '.'; },
      sig: 'prediction saved → reality recorded ⚓',
      needWhat: 'One line is enough — blank records nothing.',
      outcomes: [
        ['held', 'Held', ''], ['avoided', 'Avoided', ''],
        ['partial', 'Partially', ''], ['still_pending', 'Not yet', ''],
        ['missed', 'Missed', '']
      ],
      errNoAnswer: 'Nothing was recorded — you can also just tell me in chat.'
    }
  };

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }
  function stage() { var s = document.getElementById('stage'); s.innerHTML = ''; return s; }
  function plusDays(n) {
    var d = new Date(Date.now() + n * 86400000);
    return d.toISOString().slice(0, 10);
  }

  function onResult(result) {
    var sc = result.structuredContent || {};
    var data = sc.data || {};
    if (sc.ok === false) { renderQuiet(T[locale].errNoAnswer, true); return; }
    if (data.status === 'awaiting_picker') {
      locale = data.locale === 'en' ? 'en' : 'ko';
      state = data;
      renderPicker();
      return;
    }
    if (data.outcome) { // settle already completed (conversationally or via this card)
      locale = data.locale === 'en' ? 'en' : (locale || 'ko');
      renderDone(data.outcome, data.what_happened_echo || '', data.deferred_to || null);
      return;
    }
    renderQuiet('', false);
  }

  function renderPicker() {
    var t = T[locale];
    document.getElementById('title').textContent = t.title;
    var whenEl = document.getElementById('when');
    whenEl.textContent = t.due(state.check_by || '') +
      (state.days_overdue > 0 ? t.overdue(state.days_overdue) : '');
    var s = stage();
    s.appendChild(el('div', 'predicate', state.predicate || state.id));
    s.appendChild(el('div', 'ask', t.ask));

    var grid = el('div', 'choices');
    var selected = null;
    var follow = el('div', 'follow');
    var ta = document.createElement('textarea');
    ta.placeholder = t.needWhat;
    var whatLbl = el('label', 'small', t.what);
    var dateLbl = el('label', 'small', t.whenAgain);
    var date = document.createElement('input');
    date.type = 'date'; date.value = plusDays(7); date.min = plusDays(1);
    var actions = el('div', 'actions');
    var commit = el('button', 'commit', t.commit);
    var skip = el('a', 'skip', t.skip);
    skip.addEventListener('click', function () { renderQuiet(t.skipped, false); });
    actions.appendChild(commit); actions.appendChild(skip);

    t.outcomes.forEach(function (o) {
      var b = el('button', 'outcome');
      b.appendChild(document.createTextNode(o[1]));
      if (o[2]) b.appendChild(el('small', null, o[2]));
      b.addEventListener('click', function () {
        selected = o[0];
        Array.prototype.forEach.call(grid.children, function (c) { c.classList.remove('sel'); });
        b.classList.add('sel');
        follow.className = 'follow show';
        follow.innerHTML = '';
        if (selected === 'still_pending') {
          follow.appendChild(dateLbl); follow.appendChild(date);
          commit.textContent = t.later;
        } else {
          follow.appendChild(whatLbl); follow.appendChild(ta);
          commit.textContent = t.commit;
        }
        follow.appendChild(actions);
        standaloneSkip.style.display = 'none';
        ta.focus();
      });
      grid.appendChild(b);
    });
    s.appendChild(grid);
    s.appendChild(follow);
    // The escape hatch is visible from the FIRST paint, not after the user has
    // already engaged (found 2026-07-27 by executing this card for the first
    // time). Putting "skip" inside \`actions\` meant a user who did not want to
    // answer at all had to pick an outcome just to find the way out — the
    // friction escape has to be there before the commitment, or it is not an
    // escape. Once an outcome is picked, \`actions\` carries its own copy and
    // this standalone one steps aside.
    var standaloneSkip = el('div', 'actions');
    var skipOnly = el('a', 'skip', t.skip);
    skipOnly.addEventListener('click', function () { renderQuiet(t.skipped, false); });
    standaloneSkip.appendChild(skipOnly);
    s.appendChild(standaloneSkip);

    commit.addEventListener('click', function () {
      if (!selected) return;
      var args = { id: state.id, outcome: selected, outcome_source: 'user_stated' };
      if (inputArgs.argus_dir) args.argus_dir = inputArgs.argus_dir;
      if (selected === 'still_pending') {
        args.defer_to = date.value;
      } else {
        var w = (ta.value || '').trim();
        if (!w) { ta.focus(); ta.placeholder = t.needWhat; return; }
        args.what_happened = w;
      }
      commit.disabled = true;
      call('tools/call', { name: 'argus_resolve', arguments: args }).then(function (res) {
        var sc = (res && res.structuredContent) || {};
        if (sc.ok === false) { commit.disabled = false; renderQuiet(T[locale].errNoAnswer, true); return; }
        var d = sc.data || {};
        renderDone(d.outcome || selected, args.what_happened || '', d.deferred_to || (selected === 'still_pending' ? args.defer_to : null));
      }).catch(function () { commit.disabled = false; });
    });
  }

  function outcomeWord(o) {
    var t = T[locale], i;
    for (i = 0; i < t.outcomes.length; i++) if (t.outcomes[i][0] === o) return t.outcomes[i][1];
    return o;
  }

  function renderDone(outcome, what, deferredTo) {
    var t = T[locale];
    var s = stage();
    if (deferredTo) {
      s.appendChild(el('div', 'done-outcome', outcomeWord('still_pending')));
      s.appendChild(el('div', 'done-what', t.deferred(deferredTo)));
    } else {
      s.appendChild(el('div', 'done-outcome', t.recorded + ' · ' + outcomeWord(outcome)));
      if (what) s.appendChild(el('div', 'done-what', '\\u201C' + what + '\\u201D'));
    }
    if (state && state.predicate) {
      var m = el('div', 'meta', ''); m.style.marginTop = '10px';
      m.textContent = '\\u201C' + state.predicate + '\\u201D';
      s.appendChild(m);
    }
    var foot = document.getElementById('foot');
    foot.style.display = 'flex';
    document.getElementById('sig').textContent = t.sig;
  }

  function renderQuiet(msg, isErr) {
    var s = stage();
    if (msg) s.appendChild(el('div', isErr ? 'err' : 'quiet', msg));
  }

  call('ui/initialize', { appCapabilities: { availableDisplayModes: ['inline'] } })
    .then(function (init) {
      theme = (init && init.hostContext && init.hostContext.theme) || 'dark';
      if (theme === 'light') document.documentElement.setAttribute('data-theme', 'light');
      send({ jsonrpc: '2.0', method: 'ui/notifications/initialized' });
    })
    .catch(function () { /* headless host — stay dark, wait for notifications */ });
})();
</script>
</body>
</html>`;
