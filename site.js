/* ============================================================
   site.js
   スペイン語学習ポータル共通スクリプト
   タブ切り替え・目次・検索・答え/ヒント表示・PDF印刷・
   ページ先頭へ戻るボタン、を実装する。
   ============================================================ */

/* ══════════════════════════════════════════════════════════
   日本語版／英語版の切り替え
   英語版があるページは <html data-bilingual> を持ち、本文を lang="ja" / lang="en" の
   要素に書き分ける（どちらを隠すかは CSS が決める）。選んだ言語は localStorage の
   "siteLang" に保存し、英語版があるページにだけ反映する。
   JS が書き換える文言は、両方の言語を <span lang> で出しておき、表示は CSS に任せる。
   ══════════════════════════════════════════════════════════ */
var I18N = {
  showAll:      { ja: 'すべて表示', en: 'Show all' },
  hideAll:      { ja: 'すべて隠す', en: 'Hide all' },
  showExp:      { ja: '解説を見る ▾', en: 'Show explanation ▾' },
  hideExp:      { ja: '解説を隠す ▲', en: 'Hide explanation ▲' },
  showHint:     { ja: 'ヒントを見る ▾', en: 'Show hint ▾' },
  hideHint:     { ja: 'ヒントを隠す ▲', en: 'Hide hint ▲' },
  showAns:      { ja: '答えを見る ▾', en: 'Show answer ▾' },
  hideAns:      { ja: '答えを隠す ▲', en: 'Hide answer ▲' },
  rateLabel:    { ja: 'この問題の理解度：', en: 'How well did you get it? ' },
  hideJa:       { ja: '🙈 和訳を隠す', en: '🙈 Hide translations' },
  showJa:       { ja: '👀 和訳を表示', en: '👀 Show translations' },
  noSearchData: { ja: 'このページには検索データがありません', en: 'No search data on this page' },
  noMatch:      { ja: '一致する項目が見つかりませんでした', en: 'No matches found' },
  jump:         { ja: 'ジャンプ →', en: 'Go →' },
  orderLabel:   { ja: '並び順：', en: 'Order: ' },
  orderTopic:   { ja: '内容ごと', en: 'By topic' },
  orderRandom:  { ja: 'ランダム', en: 'Random' },
  reshuffle:    { ja: '🔀 並べ直す', en: '🔀 Reshuffle' },
  tanren:       { ja: '鍛錬', en: 'Drill' },
  items:        { ja: '問', en: ' items' }
};

function siteLangSaved() {
  try { return localStorage.getItem('siteLang') === 'en' ? 'en' : 'ja'; } catch (e) { return 'ja'; }
}
function isBilingualPage() {
  return document.documentElement.hasAttribute('data-bilingual');
}
/* 今ページに表示している言語 */
function siteLang() {
  return isBilingualPage() && document.documentElement.getAttribute('data-lang') === 'en' ? 'en' : 'ja';
}
/* 文言を「今の言語の文字列」で返す（title 属性など、span を入れられない所で使う） */
function t(key) {
  var e = I18N[key];
  return e ? e[siteLang()] : key;
}
/* 両方の言語を span で返す（表示は CSS が切り替える） */
function bi(ja, en) {
  if (en === undefined || en === null || en === '') return ja;
  return '<span lang="ja">' + ja + '</span><span lang="en">' + en + '</span>';
}
function biKey(key) { return bi(I18N[key].ja, I18N[key].en); }

/* 切り替えても読んでいた場所がずれないように、画面上端にある「両言語で共通の要素」を
   目印にして、切り替え後も同じ位置に来るようにスクロールを戻す */
var LANG_ANCHOR_SELECTOR = '.sec-heading, .sub, .sub2, .ex, .mini-check, .quiz-item, .quiz-block-title, ' +
  '.box, .tbl-wrap, .trivia, .q-item, .daimon, .ex-block-title, .vocab-category, .pill, .tanren-intro, .cover-goal';
function langAnchorElement() {
  var nav = document.getElementById('top-nav');
  var top = nav ? nav.getBoundingClientRect().bottom : 0;
  var best = null, bestDist = Infinity;
  document.querySelectorAll(LANG_ANCHOR_SELECTOR).forEach(function (el) {
    if (el.closest('body [lang]') || !el.offsetParent) return;
    var r = el.getBoundingClientRect();
    if (r.bottom <= top || r.top >= window.innerHeight) return;   /* 画面に見えているものだけ */
    var d = Math.abs(r.top - top);
    if (d < bestDist) { best = el; bestDist = d; }
  });
  return best;
}
function setSiteLang(lang) {
  var anchor = langAnchorElement();
  var before = anchor ? anchor.getBoundingClientRect().top : 0;
  try { localStorage.setItem('siteLang', lang); } catch (e) {}
  applySiteLang();
  if (anchor) window.scrollBy(0, anchor.getBoundingClientRect().top - before);
}
function applySiteLang() {
  if (!isBilingualPage()) return;
  var lang = siteLangSaved();
  document.documentElement.setAttribute('data-lang', lang);
  document.documentElement.setAttribute('lang', lang);
  document.querySelectorAll('.lang-switch button').forEach(function (b) {
    var on = b.getAttribute('data-lang-btn') === lang;
    b.classList.toggle('active', on);
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
  /* 左下の丸いボタンは「押すと切り替わる先の言語」を表示する */
  var fab = document.getElementById('lang-fab');
  if (fab) {
    fab.textContent = lang === 'en' ? '日' : 'EN';
    fab.title = lang === 'en' ? '日本語で表示' : 'Show in English';
    fab.setAttribute('aria-label', fab.title);
  }
  /* 入力欄の案内文は CSS で切り替えられないので、data-placeholder-en を見て差し替える */
  document.querySelectorAll('[data-placeholder-en]').forEach(function (el) {
    if (!el.hasAttribute('data-placeholder-ja')) el.setAttribute('data-placeholder-ja', el.getAttribute('placeholder') || '');
    el.setAttribute('placeholder', el.getAttribute(lang === 'en' ? 'data-placeholder-en' : 'data-placeholder-ja'));
  });
  srsAddButtonTitles();
}

/* 要素が今の言語で表示されているか（lang="ja"/"en" の中にあれば、その言語のときだけ表示） */
function isInCurrentLang(el) {
  var holder = el && el.closest ? el.closest('body [lang]') : null;
  if (!holder || !isBilingualPage()) return true;
  var l = holder.getAttribute('lang');
  return (l !== 'ja' && l !== 'en') || l === siteLang();
}
/* 英語版があるページに、表紙と目次メニューの切り替えボタンを置く */
function setupLangSwitch() {
  if (!isBilingualPage()) return;
  function makeSwitch() {
    var box = document.createElement('div');
    box.className = 'lang-switch';
    box.setAttribute('role', 'group');
    box.setAttribute('aria-label', 'Language');
    [['ja', '日本語'], ['en', 'English']].forEach(function (p) {
      var b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('data-lang-btn', p[0]);
      b.textContent = p[1];
      b.addEventListener('click', function () { setSiteLang(p[0]); });
      box.appendChild(b);
    });
    return box;
  }
  var cover = document.querySelector('.cover-title-block');
  if (cover) cover.appendChild(makeSwitch());
  var menu = document.getElementById('top-toc-menu');
  if (menu) menu.insertBefore(makeSwitch(), menu.firstChild);
  /* どこまでスクロールしていても押せるよう、左下に固定の切り替えボタンも置く */
  var fab = document.createElement('button');
  fab.id = 'lang-fab';
  fab.type = 'button';
  fab.addEventListener('click', function () { setSiteLang(siteLang() === 'en' ? 'ja' : 'en'); });
  document.body.appendChild(fab);
  applySiteLang();
}

/* ── タブ切り替え ── */
function switchTab(key, btnEl) {
  document.querySelectorAll('.tab-content').forEach(function (tc) {
    tc.classList.remove('active');
  });
  var target = document.getElementById('tab-' + key);
  if (target) target.classList.add('active');

  document.querySelectorAll('.tab-btn').forEach(function (b) {
    b.classList.remove('active-grammar', 'active-renshu', 'active-vocab', 'active-tanren');
  });
  var activeClass = 'active-' + key;
  if (btnEl) {
    btnEl.classList.add(activeClass);
  } else {
    var btn = Array.prototype.find.call(
      document.querySelectorAll('.tab-btn'),
      function (b) {
        var oc = b.getAttribute('onclick') || '';
        return oc.indexOf("'" + key + "'") !== -1;
      }
    );
    if (btn) btn.classList.add(activeClass);
  }
}

/* ── 目次（TOC） ── */
function toggleToc() {
  var menu = document.getElementById('top-toc-menu');
  if (menu) menu.classList.toggle('open');
}
function closeToc() {
  var menu = document.getElementById('top-toc-menu');
  if (menu) menu.classList.remove('open');
}

/* ── セクションへジャンプ（TOC・検索結果から共通利用） ── */
function jumpToSection(id) {
  var el = document.getElementById(id);
  if (!el) return;
  var tabContent = el.closest ? el.closest('.tab-content') : null;
  if (tabContent) {
    var key = tabContent.id.replace('tab-', '');
    switchTab(key, null);
  }
  closeToc();
  setTimeout(function () {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    el.classList.add('sr-jump-hl');
    setTimeout(function () { el.classList.remove('sr-jump-hl'); }, 1400);
  }, 60);
}

/* ── 上部検索バーの開閉 ── */
function openSearch() {
  var bar = document.getElementById('search-bar');
  if (bar) bar.classList.add('open');
  var input = document.getElementById('search-input');
  if (input) { input.value = ''; input.focus(); }
  var results = document.getElementById('search-results');
  if (results) { results.innerHTML = ''; results.classList.remove('has-results'); }
}
function closeSearch() {
  var bar = document.getElementById('search-bar');
  if (bar) bar.classList.remove('open');
  var results = document.getElementById('search-results');
  if (results) { results.innerHTML = ''; results.classList.remove('has-results'); }
}

/* ── 辞書モーダル（本バージョンでは辞書データ未搭載のため何もしない） ── */
function closeDictModal() {
  var overlay = document.getElementById('dict-overlay');
  if (overlay) overlay.classList.remove('open');
}

/* ── 汎用の文法用語検索：各ページ末尾の GRAMMAR_TERMS を利用してジャンプする ── */
function runGrammarSearch(query, resultsEl) {
  if (!resultsEl) return;
  query = (query || '').trim().toLowerCase();
  resultsEl.innerHTML = '';
  if (!query) { resultsEl.classList.remove('has-results'); return; }

  if (typeof GRAMMAR_TERMS === 'undefined' || !GRAMMAR_TERMS.length) {
    resultsEl.innerHTML = '<div class="sr-none">' + biKey('noSearchData') + '</div>';
    resultsEl.classList.add('has-results');
    return;
  }

  var matches = GRAMMAR_TERMS.filter(function (entry) {
    /* 今の言語では表示されていない節（英語版だけの節など）へは飛べないので出さない */
    if (!isInCurrentLang(document.getElementById(entry.id))) return false;
    return entry.terms.some(function (t) {
      return t.toLowerCase().indexOf(query) !== -1;
    });
  });

  if (matches.length === 0) {
    resultsEl.innerHTML = '<div class="sr-none">' + biKey('noMatch') + '</div>';
  } else {
    matches.forEach(function (m) {
      var item = document.createElement('div');
      item.className = 'sr-item';
      item.innerHTML =
        '<span class="sr-ja">' + bi(m.label, m.label_en) + '</span>' +
        '<span class="sr-jump">' + biKey('jump') + '</span>';
      item.addEventListener('click', function () {
        jumpToSection(m.id);
        closeSearch();
      });
      resultsEl.appendChild(item);
    });
  }
  resultsEl.classList.add('has-results');
}

/* ── PDF保存（印刷） ── */
function savePdf() {
  document.body.classList.add('is-printing');
  window.print();
  setTimeout(function () {
    document.body.classList.remove('is-printing');
  }, 600);
}

/* ── 練習問題：ヒント／答えの表示切り替え ── */
function toggleHint(btn) {
  var item = btn.closest('.q-item');
  if (!item) return;
  var hint = item.querySelector('.q-hint');
  var revealed = btn.classList.toggle('revealed');
  if (hint) hint.classList.toggle('visible', revealed);
  btn.innerHTML = biKey(revealed ? 'hideHint' : 'showHint');
}
function toggleAns(btn) {
  var item = btn.closest('.q-item');
  if (!item) return;
  var row = item.querySelector('.q-answer-row');
  var exp = item.querySelector('.q-exp');
  var revealed = btn.classList.toggle('revealed');
  if (row) row.classList.toggle('visible', revealed);
  if (exp) exp.classList.toggle('visible', revealed);
  btn.innerHTML = biKey(revealed ? 'hideAns' : 'showAns');
}

/* ── 穴埋め問題：クリックで個別に開閉 ── */
function toggleBlank(el) {
  el.classList.toggle('revealed');
}

/* ── ヒントチップ：クリックで個別に開閉（穴埋めと同じ仕組み） ── */
function toggleHintChip(el) {
  el.classList.toggle('revealed');
}

/* ── まとめクイズ／ミニ確認：すべての穴埋めを一括表示・非表示 ── */
function toggleAllBlanks(btn) {
  var container = btn.closest('.quiz-item') || btn.closest('.mini-check');
  if (!container) return;
  var blanks = container.querySelectorAll('.fillblank');
  var anyHidden = Array.prototype.some.call(blanks, function (b) {
    return !b.classList.contains('revealed');
  });
  blanks.forEach(function (b) {
    b.classList.toggle('revealed', anyHidden);
  });
  btn.innerHTML = biKey(anyHidden ? 'hideAll' : 'showAll');
}

/* ── まとめクイズ／ミニ確認：解説の表示切り替え ── */
function toggleQuizExp(btn) {
  var exp = btn.nextElementSibling;
  var revealed = btn.classList.toggle('revealed');
  if (exp) exp.classList.toggle('visible', revealed);
  btn.innerHTML = biKey(revealed ? 'hideExp' : 'showExp');
}

/* ══════════════════════════════════════════════════════════
   鍛錬タブ
   <div id="tanren-app" data-lesson="2"></div> に、tanren-bank.js の問題を
   まとめクイズと同じ形式で並べる。「内容ごと」と「ランダム」を切り替えられる。
   ══════════════════════════════════════════════════════════ */

var tanrenState = { lesson: null, order: 'topic', shuffled: null };

function tanrenLoadOrder() {
  try { return localStorage.getItem('tanren_order') === 'random' ? 'random' : 'topic'; }
  catch (e) { return 'topic'; }
}
function tanrenSaveOrder(order) {
  try { localStorage.setItem('tanren_order', order); } catch (e) {}
}

function tanrenShuffle(list) {
  var a = list.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

function tanrenItemHtml(q, num, showGroup) {
  var exp = (showGroup ? '<span class="tanren-exp-group">' + q.group_num + ' ' + bi(q.group_title, q.group_title_en) + '</span>' : '') +
    bi(q.explanation_html, q.explanation_html_en);
  return '<div class="quiz-item" id="' + q.id + '">' +
    '<div class="quiz-item-head">' +
      '<span class="quiz-num tanren-num">' + num + '</span>' +
      '<button class="quiz-toggle-all-btn" onclick="toggleAllBlanks(this)">' + biKey('showAll') + '</button>' +
    '</div>' +
    '<div class="quiz-sentence">' + q.sentence_html + '</div>' +
    '<div class="quiz-ja">' + bi(q.ja, q.en) + '</div>' +
    '<button class="quiz-exp-btn" onclick="toggleQuizExp(this)">' + biKey('showExp') + '</button>' +
    '<div class="quiz-exp">' + exp + '</div>' +
    '<div class="srs-rate" data-qid="' + q.id + '"><span class="srs-rate-label">' + biKey('rateLabel') + '</span>' +
      '<button class="srs-btn srs-x" onclick="rateQuestion(\'' + q.id + '\', 0, this)">×</button>' +
      '<button class="srs-btn srs-tri" onclick="rateQuestion(\'' + q.id + '\', 1, this)">△</button>' +
      '<button class="srs-btn srs-o" onclick="rateQuestion(\'' + q.id + '\', 2, this)">○</button>' +
      '<span class="srs-rated-msg"></span></div>' +
  '</div>';
}

/* ○△× の記録数を数えて表示する */
function tanrenUpdateSummary(questions) {
  var el = document.getElementById('tanren-summary');
  if (!el) return;
  var progress = srsLoadProgress();
  var counts = [0, 0, 0];
  questions.forEach(function (q) {
    var p = progress[q.id];
    if (p && typeof p.lastRating === 'number') counts[p.lastRating] += 1;
  });
  var done = counts[0] + counts[1] + counts[2];
  el.innerHTML = bi('記録済み <b>' + done + '</b> / ' + questions.length + ' 問', 'Rated <b>' + done + '</b> / ' + questions.length) + '　' +
    '<span class="tanren-count-o">○ ' + counts[2] + '</span>　' +
    '<span class="tanren-count-tri">△ ' + counts[1] + '</span>　' +
    '<span class="tanren-count-x">× ' + counts[0] + '</span>';
}

function renderTanren() {
  var app = document.getElementById('tanren-app');
  if (!app || typeof TANREN_BANK === 'undefined') return;
  var lesson = Number(app.getAttribute('data-lesson'));
  var questions = TANREN_BANK.filter(function (q) { return q.lesson === lesson; });
  if (tanrenState.lesson !== lesson) {
    tanrenState = { lesson: lesson, order: tanrenLoadOrder(), shuffled: null };
  }
  if (tanrenState.order === 'random' && !tanrenState.shuffled) {
    tanrenState.shuffled = tanrenShuffle(questions);
  }

  var isRandom = tanrenState.order === 'random';
  var html =
    '<div class="tanren-controls">' +
      '<span class="tanren-controls-label">' + biKey('orderLabel') + '</span>' +
      '<div class="tanren-seg" role="group" aria-label="並び順 / Order">' +
        '<button class="tanren-seg-btn' + (isRandom ? '' : ' active') + '" aria-pressed="' + !isRandom + '" onclick="tanrenSetOrder(\'topic\')">' + biKey('orderTopic') + '</button>' +
        '<button class="tanren-seg-btn' + (isRandom ? ' active' : '') + '" aria-pressed="' + isRandom + '" onclick="tanrenSetOrder(\'random\')">' + biKey('orderRandom') + '</button>' +
      '</div>' +
      (isRandom ? '<button class="tanren-reshuffle-btn" onclick="tanrenReshuffle()">' + biKey('reshuffle') + '</button>' : '') +
    '</div>' +
    '<div class="tanren-summary" id="tanren-summary"></div>';

  if (isRandom) {
    html += '<div class="quiz-block tanren-block"><div class="quiz-block-title">💪 ' +
      bi('鍛錬：ランダム（' + questions.length + '問）', 'Drill: random (' + questions.length + ' items)') + '</div>';
    tanrenState.shuffled.forEach(function (q, i) { html += tanrenItemHtml(q, i + 1, true); });
    html += '</div>';
  } else {
    var num = 0;
    var groups = [];
    questions.forEach(function (q) {
      var last = groups[groups.length - 1];
      if (!last || last.num !== q.group_num) groups.push(last = { num: q.group_num, title: q.group_title, title_en: q.group_title_en, items: [] });
      last.items.push(q);
    });
    groups.forEach(function (g) {
      html += '<div class="quiz-block tanren-block"><div class="quiz-block-title">💪 ' +
        bi('鍛錬：' + g.num + ' ' + g.title, g.title_en ? 'Drill: ' + g.num + ' ' + g.title_en : '') +
        '<span class="tanren-block-count">' + bi(g.items.length + '問', g.items.length + ' items') + '</span></div>';
      g.items.forEach(function (q) { num += 1; html += tanrenItemHtml(q, num, false); });
      html += '</div>';
    });
  }

  app.innerHTML = html;
  srsRestoreRatingButtons();
  srsAddButtonTitles(app);
  tanrenUpdateSummary(questions);
  if (!app.getAttribute('data-listening')) {
    app.setAttribute('data-listening', '1');
    app.addEventListener('click', function (e) {
      if (e.target.closest('.srs-btn')) tanrenUpdateSummary(questions);
    });
  }
}

function tanrenSetOrder(order) {
  if (tanrenState.order === order) return;
  tanrenState.order = order;
  tanrenSaveOrder(order);
  renderTanren();
}

function tanrenReshuffle() {
  tanrenState.shuffled = null;
  renderTanren();
  var app = document.getElementById('tanren-app');
  if (app) app.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ══════════════════════════════════════════════════════════
   復習スケジュール
   localStorage キー: "srs_progress"
   構造: { [qid]: { nextReview: "YYYY-MM-DD" | null, lastRating: 0|1|2,
                     lastDate: "YYYY-MM-DD", triStreak: △が続いた回数 } }

   評価の意味と、復習ページに出るタイミング：
     ×（0）わからなかった。復習必須     → 翌日（△の回数はリセット）
     △（1）今は分かったが復習が必要     → 続けて△を付けるほど間隔が伸びる
                                          1回目 3日後 → 7日後 → 14日後 → 30日後 → 以降 60日後
     ○（2）完全に理解した。復習不要     → 出さない
   期限が来た問題は、解きなおして評価し直すまで復習ページに残り続ける。

   △の間隔は、思い出すたびに記憶が長持ちするようになる「間隔反復」の考え方に沿って、
   おおむね 2 倍ずつ伸ばしている。忘れかけた頃に思い出すのが最も定着しやすいため。
   ══════════════════════════════════════════════════════════ */

const SRS_DAYS_X = 1;
const SRS_DAYS_TRI = [3, 7, 14, 30, 60];

function srsToday() {
  var d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function srsAddDays(dateStr, days) {
  var d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function srsLoadProgress() {
  try {
    var raw = localStorage.getItem('srs_progress');
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

function srsSaveProgress(progress) {
  try {
    localStorage.setItem('srs_progress', JSON.stringify(progress));
    /* 自動同期がオンなら、少し待って GitHub にも保存する（sync.js） */
    if (window.SiteSync) window.SiteSync.schedulePush();
    return true;
  } catch (e) {
    return false;
  }
}

/* rating: 0=×（わからなかった） 1=△（復習が必要） 2=○（復習不要） */
function srsRate(qid, rating) {
  var progress = srsLoadProgress();
  var today = srsToday();
  var prev = progress[qid] || {};
  var streak = 0;
  var days = null;

  if (rating === 0) {
    days = SRS_DAYS_X;
  } else if (rating === 1) {
    /* 旧データ（回数の記録がない△）は 1 回目として扱う */
    var prevStreak = prev.lastRating === 1 ? (prev.triStreak || 1) : 0;
    /* 同じ日に△を押し直しても回数は増やさない（押し間違い・連打対策） */
    streak = (prev.lastRating === 1 && prev.lastDate === today) ? prevStreak : prevStreak + 1;
    days = SRS_DAYS_TRI[Math.min(streak, SRS_DAYS_TRI.length) - 1];
  }

  var entry = {
    nextReview: days === null ? null : srsAddDays(today, days),
    lastRating: rating,
    lastDate: today,
    triStreak: streak,
    /* 端末どうしの記録を合わせるとき、新しいほうを選ぶための日時（sync.js） */
    updatedAt: new Date().toISOString()
  };
  progress[qid] = entry;
  srsSaveProgress(progress);
  entry.days = days;
  return entry;
}

/* 評価を記録したときに表示する文 */
function srsRatedMessage(entry) {
  if (entry.days === null) return bi('記録しました（復習には出しません）', 'Saved (won’t come up for review)');
  if (entry.days === 1) return bi('記録しました（明日の復習に出ます）', 'Saved (review tomorrow)');
  return bi('記録しました（' + entry.days + '日後の復習に出ます）', 'Saved (review in ' + entry.days + ' days)');
}

function srsGetDueIds(progress) {
  var today = srsToday();
  var due = [];
  for (var qid in progress) {
    var entry = progress[qid];
    /* ○ の問題は出さない（旧方式で保存された ○ の日付も無視する） */
    if (entry.lastRating === 2 || !entry.nextReview) continue;
    if (entry.nextReview <= today) due.push(qid);
  }
  return due;
}

/* ○△×ボタンにマウスを乗せたとき、意味が分かるように説明を付ける */
var SRS_BUTTON_TITLES = {
  'srs-x':   { ja: '×：わからなかった（明日の復習に出ます）',
               en: '×: Didn’t get it (review tomorrow)' },
  'srs-tri': { ja: '△：今は分かったが復習が必要（3日後の復習に出ます。続けて△だと間隔が伸びます）',
               en: '△: Got it now but need review (in 3 days; the gap grows with each △)' },
  'srs-o':   { ja: '○：完全に理解した（復習には出しません）',
               en: '○: Fully understood (won’t come up for review)' }
};
function srsAddButtonTitles(root) {
  Object.keys(SRS_BUTTON_TITLES).forEach(function (cls) {
    (root || document).querySelectorAll('.srs-btn.' + cls).forEach(function (b) {
      b.title = SRS_BUTTON_TITLES[cls][siteLang()];
    });
  });
}

/* レッスンページ内の評価ボタンから呼ばれる */
function rateQuestion(qid, rating, btnEl) {
  var entry = srsRate(qid, rating);
  var container = btnEl.closest('.srs-rate');
  if (!container) return;
  container.querySelectorAll('.srs-btn').forEach(function (b) { b.classList.remove('active'); });
  btnEl.classList.add('active');
  var msg = container.querySelector('.srs-rated-msg');
  if (msg) {
    msg.innerHTML = '✓ ' + srsRatedMessage(entry);
    setTimeout(function () { msg.textContent = ''; }, 3000);
  }
}

/* レッスンページ表示時、以前の評価があればボタンをハイライトしておく */
function srsRestoreRatingButtons() {
  var progress = srsLoadProgress();
  document.querySelectorAll('.srs-rate').forEach(function (el) {
    var qid = el.getAttribute('data-qid');
    /* 同期で記録が変わったときにも呼ぶので、いったん全部消してから付け直す */
    el.querySelectorAll('.srs-btn.active').forEach(function (b) { b.classList.remove('active'); });
    if (progress[qid] && typeof progress[qid].lastRating === 'number') {
      var idx = progress[qid].lastRating;
      var classes = ['srs-x', 'srs-tri', 'srs-o'];
      var btn = el.querySelector('.' + classes[idx]);
      if (btn) btn.classList.add('active');
    }
  });
}

/* ── 和訳を隠すボタン：例文カード（.ex-ja）があるページだけに出す ──
   隠している間は、タップした和訳だけが表示される。設定はこの端末にだけ保存する。 */
function jaHiddenLoad() {
  try { return localStorage.getItem('hideJa') === '1'; } catch (e) { return false; }
}
function jaHiddenSave(hidden) {
  try { localStorage.setItem('hideJa', hidden ? '1' : '0'); } catch (e) {}
}
function setupJaToggle() {
  if (!document.querySelector('.ex-ja')) return;
  var btn = document.createElement('button');
  btn.id = 'ja-toggle-btn';
  btn.type = 'button';
  function apply(hidden) {
    document.body.classList.toggle('hide-ja', hidden);
    document.querySelectorAll('.ex-ja.revealed').forEach(function (el) { el.classList.remove('revealed'); });
    btn.innerHTML = biKey(hidden ? 'showJa' : 'hideJa');
    btn.setAttribute('aria-pressed', hidden ? 'true' : 'false');
  }
  btn.addEventListener('click', function () {
    var hidden = !document.body.classList.contains('hide-ja');
    jaHiddenSave(hidden);
    apply(hidden);
  });
  document.addEventListener('click', function (e) {
    var ja = e.target.closest ? e.target.closest('.ex-ja') : null;
    if (ja && document.body.classList.contains('hide-ja')) ja.classList.toggle('revealed');
  });
  document.body.appendChild(btn);
  apply(jaHiddenLoad());
}

/* ── ページ読み込み時の初期化 ── */
document.addEventListener('DOMContentLoaded', function () {

  setupJaToggle();
  setupLangSwitch();

  /* 鍛錬タブがあるページでは問題を並べる（評価ボタンの復元より先に行う） */
  renderTanren();

  /* 復習：以前の評価があればボタンを復元し、ボタンに説明を付ける */
  srsRestoreRatingButtons();
  srsAddButtonTitles();

  /* 別の端末の記録が同期で届いたら、○△× の表示と鍛錬の記録数を更新する */
  window.addEventListener('srs-synced', function (e) {
    if (!e.detail || !e.detail.changed) return;
    srsRestoreRatingButtons();
    var app = document.getElementById('tanren-app');
    if (app && typeof TANREN_BANK !== 'undefined') {
      var lesson = Number(app.getAttribute('data-lesson'));
      tanrenUpdateSummary(TANREN_BANK.filter(function (q) { return q.lesson === lesson; }));
    }
  });

  /* トグルボタンを持たない問題は、答え・解説・ヒントを最初から表示する */
  document.querySelectorAll('.q-item').forEach(function (item) {
    var hasToggle = item.querySelector('.ans-toggle-btn');
    if (!hasToggle) {
      item.querySelectorAll('.q-answer-row, .q-exp, .q-hint').forEach(function (el) {
        el.classList.add('visible');
      });
    }
  });

  /* 上部検索バー */
  var searchInput = document.getElementById('search-input');
  var searchResults = document.getElementById('search-results');
  if (searchInput && searchResults) {
    searchInput.addEventListener('input', function () {
      runGrammarSearch(searchInput.value, searchResults);
    });
  }

  /* 表紙内検索ボックス */
  var coverInput = document.getElementById('cover-search-input');
  var coverResults = document.getElementById('cover-search-results');
  if (coverInput && coverResults) {
    coverInput.addEventListener('input', function () {
      runGrammarSearch(coverInput.value, coverResults);
    });
  }

  /* ページ先頭へ戻るボタンを動的に追加 */
  if (!document.getElementById('back-to-top')) {
    var backBtn = document.createElement('button');
    backBtn.id = 'back-to-top';
    backBtn.setAttribute('aria-label', 'ページ先頭へ戻る');
    backBtn.textContent = '↑';
    backBtn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    document.body.appendChild(backBtn);
    window.addEventListener('scroll', function () {
      backBtn.classList.toggle('visible', window.scrollY > 400);
    });
  }
});
