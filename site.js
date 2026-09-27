/* ============================================================
   site.js
   スペイン語学習ポータル（個人版）共通スクリプト
   タブ切り替え・目次・検索・答え/ヒント表示・PDF印刷・
   ページ先頭へ戻るボタン、を実装する。
   ============================================================ */

/* ── タブ切り替え ── */
function switchTab(key, btnEl) {
  document.querySelectorAll('.tab-content').forEach(function (tc) {
    tc.classList.remove('active');
  });
  var target = document.getElementById('tab-' + key);
  if (target) target.classList.add('active');

  document.querySelectorAll('.tab-btn').forEach(function (b) {
    b.classList.remove('active-grammar', 'active-renshu', 'active-vocab');
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
    resultsEl.innerHTML = '<div class="sr-none">このページには検索データがありません</div>';
    resultsEl.classList.add('has-results');
    return;
  }

  var matches = GRAMMAR_TERMS.filter(function (entry) {
    return entry.terms.some(function (t) {
      return t.toLowerCase().indexOf(query) !== -1;
    });
  });

  if (matches.length === 0) {
    resultsEl.innerHTML = '<div class="sr-none">一致する項目が見つかりませんでした</div>';
  } else {
    matches.forEach(function (m) {
      var item = document.createElement('div');
      item.className = 'sr-item';
      item.innerHTML =
        '<span class="sr-ja">' + m.label + '</span>' +
        '<span class="sr-jump">ジャンプ →</span>';
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
  btn.textContent = revealed ? 'ヒントを隠す ▲' : 'ヒントを見る ▾';
}
function toggleAns(btn) {
  var item = btn.closest('.q-item');
  if (!item) return;
  var row = item.querySelector('.q-answer-row');
  var exp = item.querySelector('.q-exp');
  var revealed = btn.classList.toggle('revealed');
  if (row) row.classList.toggle('visible', revealed);
  if (exp) exp.classList.toggle('visible', revealed);
  btn.textContent = revealed ? '答えを隠す ▲' : '答えを見る ▾';
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
  btn.textContent = anyHidden ? 'すべて隠す' : 'すべて表示';
}

/* ── まとめクイズ／ミニ確認：解説の表示切り替え ── */
function toggleQuizExp(btn) {
  var exp = btn.nextElementSibling;
  var revealed = btn.classList.toggle('revealed');
  if (exp) exp.classList.toggle('visible', revealed);
  btn.textContent = revealed ? '解説を隠す ▲' : '解説を見る ▾';
}

/* ══════════════════════════════════════════════════════════
   復習スケジュール
   localStorage キー: "srs_progress"
   構造: { [qid]: { nextReview: "YYYY-MM-DD" | null, lastRating: 0|1|2, lastDate: "YYYY-MM-DD" } }

   評価の意味と、復習ページに出るタイミング：
     ×（0）わからなかった。復習必須     → 翌日
     △（1）今は分かったが復習が必要     → 3日後
     ○（2）完全に理解した。復習不要     → 出さない
   期限が来た問題は、解きなおして評価し直すまで復習ページに残り続ける。
   ══════════════════════════════════════════════════════════ */

/* 評価ごとの次回復習までの日数（null は復習に出さない） */
const SRS_DAYS_BY_RATING = [1, 3, null];

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
    return true;
  } catch (e) {
    return false;
  }
}

/* rating: 0=×（わからなかった） 1=△（復習が必要） 2=○（復習不要） */
function srsRate(qid, rating) {
  var progress = srsLoadProgress();
  var today = srsToday();
  var days = SRS_DAYS_BY_RATING[rating];
  var entry = {
    nextReview: days === null ? null : srsAddDays(today, days),
    lastRating: rating,
    lastDate: today
  };
  progress[qid] = entry;
  srsSaveProgress(progress);
  return entry;
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
  'srs-x':   '×：わからなかった（明日の復習に出ます）',
  'srs-tri': '△：今は分かったが復習が必要（3日後の復習に出ます）',
  'srs-o':   '○：完全に理解した（復習には出しません）'
};
function srsAddButtonTitles(root) {
  Object.keys(SRS_BUTTON_TITLES).forEach(function (cls) {
    (root || document).querySelectorAll('.srs-btn.' + cls).forEach(function (b) {
      b.title = SRS_BUTTON_TITLES[cls];
    });
  });
}

/* レッスンページ内の評価ボタンから呼ばれる */
function rateQuestion(qid, rating, btnEl) {
  srsRate(qid, rating);
  var container = btnEl.closest('.srs-rate');
  if (!container) return;
  container.querySelectorAll('.srs-btn').forEach(function (b) { b.classList.remove('active'); });
  btnEl.classList.add('active');
  var msg = container.querySelector('.srs-rated-msg');
  if (msg) {
    var labels = ['記録しました（明日の復習に出ます）', '記録しました（3日後の復習に出ます）', '記録しました（復習には出しません）'];
    msg.textContent = '✓ ' + labels[rating];
    setTimeout(function () { msg.textContent = ''; }, 3000);
  }
}

/* レッスンページ表示時、以前の評価があればボタンをハイライトしておく */
function srsRestoreRatingButtons() {
  var progress = srsLoadProgress();
  document.querySelectorAll('.srs-rate').forEach(function (el) {
    var qid = el.getAttribute('data-qid');
    if (progress[qid] && typeof progress[qid].lastRating === 'number') {
      var idx = progress[qid].lastRating;
      var classes = ['srs-x', 'srs-tri', 'srs-o'];
      var btn = el.querySelector('.' + classes[idx]);
      if (btn) btn.classList.add('active');
    }
  });
}

/* ── ページ読み込み時の初期化 ── */
document.addEventListener('DOMContentLoaded', function () {

  /* 復習：以前の評価があればボタンを復元し、ボタンに説明を付ける */
  srsRestoreRatingButtons();
  srsAddButtonTitles();

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
