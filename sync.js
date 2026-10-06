/* ══════════════════════════════════════════════════════════
   進捗の同期とバックアップ

   ① GitHub Gist で自動同期
      各端末に GitHub の Personal Access Token（gist の権限だけ）を1回入れると、
      あなたの非公開（シークレット）Gist の1ファイルに ○△× の記録を保存し、
      どの端末からも同じ記録を読み書きする。
        ・ページを開いたとき／タブに戻ったとき … Gist から読み込んで合わせる
        ・○△× を付けたとき                   … 数秒後に Gist へ保存する
   ② 引き継ぎコード
      記録を1つの文字列に書き出し、別の端末で読み込む（サーバーを使わない）。

   合わせ方：問題ごとに updatedAt（評価した日時）が新しいほうを残す。
   updatedAt のない古い記録は、lastDate の 0 時に評価したものとして扱う。

   この端末にだけ保存するもの（localStorage）：
     sync_token   トークン
     sync_gist_id 進捗ファイルを置いた Gist の ID
     sync_user    GitHub のユーザー名（表示用）
     sync_last    最後に同期した日時
     sync_error   直近の同期エラー（なければ空）
   ══════════════════════════════════════════════════════════ */

(function () {
  var PROGRESS_KEY = 'srs_progress';
  var GIST_FILE = 'spanish-site-progress.json';
  var GIST_DESC = 'スペイン語学習ポータルの進捗（自動同期）';
  var API = 'https://api.github.com';
  var CODE_PREFIX = 'SPS1.';
  var PUSH_DELAY = 2500;      /* ○△× を付けてから保存するまでの待ち時間（連打をまとめる） */
  var RESYNC_AFTER = 60000;   /* タブに戻ったとき、前回からこれ以上たっていれば読み込み直す */

  /* ── localStorage の読み書き（失敗しても止まらないようにする） ── */
  function lsGet(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
  function lsSet(key, val) { try { localStorage.setItem(key, val); return true; } catch (e) { return false; } }
  function lsDel(key) { try { localStorage.removeItem(key); } catch (e) {} }

  function readLocal() {
    try { var raw = lsGet(PROGRESS_KEY); return raw ? JSON.parse(raw) : {}; } catch (e) { return {}; }
  }
  function writeLocal(progress) { return lsSet(PROGRESS_KEY, JSON.stringify(progress)); }

  /* ── 記録を合わせる ── */
  function stamp(entry) {
    if (!entry) return '';
    if (entry.updatedAt) return entry.updatedAt;
    return entry.lastDate ? entry.lastDate + 'T00:00:00.000Z' : '';
  }
  /* a と b を問題ごとに比べ、新しいほうを残す（同じなら a を残す） */
  function merge(a, b) {
    var out = {};
    var k;
    for (k in a) if (Object.prototype.hasOwnProperty.call(a, k)) out[k] = a[k];
    for (k in b) {
      if (!Object.prototype.hasOwnProperty.call(b, k)) continue;
      if (!out[k] || stamp(b[k]) > stamp(out[k])) out[k] = b[k];
    }
    return out;
  }
  function sameProgress(a, b) {
    var ka = Object.keys(a), kb = Object.keys(b);
    if (ka.length !== kb.length) return false;
    for (var i = 0; i < ka.length; i++) {
      var k = ka[i];
      if (!b[k] || JSON.stringify(a[k]) !== JSON.stringify(b[k])) return false;
    }
    return true;
  }
  function countRated(progress) { return Object.keys(progress).length; }

  /* ── GitHub API ── */
  function token() { return lsGet('sync_token') || ''; }
  function isEnabled() { return !!token(); }

  function api(method, path, body) {
    var opts = {
      method: method,
      cache: 'no-store',
      headers: {
        'Accept': 'application/vnd.github+json',
        'Authorization': 'Bearer ' + token(),
        'X-GitHub-Api-Version': '2022-11-28'
      }
    };
    if (body !== undefined) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    return fetch(API + path, opts).then(function (res) {
      if (res.status === 401) throw new Error('トークンが無効か、期限が切れています。新しいトークンを入れ直してください。');
      if (res.status === 403 && res.headers.get('x-ratelimit-remaining') === '0') {
        throw new Error('GitHub への接続回数の上限に達しました。しばらくしてから同期してください。');
      }
      if (res.status === 403 || (res.status === 404 && method !== 'GET')) {
        throw new Error('Gist を読み書きする権限がありません。トークンの権限に「gist」が入っているか確かめてください。');
      }
      if (!res.ok) {
        var err = new Error('GitHub との通信に失敗しました（' + res.status + '）。');
        err.status = res.status;
        throw err;
      }
      return res.status === 204 ? null : res.json();
    });
  }

  /* Gist の中身から進捗を取り出す */
  function progressFromGist(gist) {
    var f = gist && gist.files && gist.files[GIST_FILE];
    if (!f) return Promise.resolve({});
    var text = f.truncated && f.raw_url
      ? fetch(f.raw_url, { cache: 'no-store' }).then(function (r) { return r.text(); })
      : Promise.resolve(f.content || '');
    return text.then(function (t) {
      try {
        var data = JSON.parse(t);
        return (data && data.progress) ? data.progress : {};
      } catch (e) { return {}; }
    });
  }

  function gistBody(progress) {
    var files = {};
    files[GIST_FILE] = { content: JSON.stringify({ version: 1, savedAt: new Date().toISOString(), progress: progress }) };
    return files;
  }

  /* 進捗用の Gist を探す。なければ作る */
  function findOrCreateGist() {
    var id = lsGet('sync_gist_id');
    if (id) {
      return api('GET', '/gists/' + id).catch(function (e) {
        if (e.status === 404) { lsDel('sync_gist_id'); return findOrCreateGist(); }
        throw e;
      });
    }
    return api('GET', '/gists?per_page=100').then(function (list) {
      var found = (list || []).filter(function (g) { return g.files && g.files[GIST_FILE]; })[0];
      if (found) {
        lsSet('sync_gist_id', found.id);
        return api('GET', '/gists/' + found.id);
      }
      return api('POST', '/gists', { description: GIST_DESC, 'public': false, files: gistBody(readLocal()) })
        .then(function (g) { lsSet('sync_gist_id', g.id); return g; });
    });
  }

  /* ── 同期 ── */
  var running = null;
  var pushTimer = null;

  function notify(changed) {
    try { window.dispatchEvent(new CustomEvent('srs-synced', { detail: { changed: changed } })); } catch (e) {}
    renderPanel();
  }
  function setError(msg) {
    if (msg) lsSet('sync_error', msg); else lsDel('sync_error');
  }

  /* Gist から読み込み、この端末の記録と合わせ、違いがあれば Gist にも保存する */
  function sync() {
    if (!isEnabled()) return Promise.resolve(false);
    if (running) return running;
    running = findOrCreateGist().then(function (gist) {
      return progressFromGist(gist).then(function (remote) {
        /* 通信中に付けた ○△× を失わないよう、書き込む直前の記録と合わせる */
        var local = readLocal();
        var merged = merge(local, remote);
        var localChanged = !sameProgress(merged, local);
        if (localChanged) writeLocal(merged);
        var needPush = !sameProgress(merged, remote);
        var done = needPush
          ? api('PATCH', '/gists/' + gist.id, { files: gistBody(merged) })
          : Promise.resolve();
        return done.then(function () {
          lsSet('sync_last', new Date().toISOString());
          setError('');
          return localChanged;
        });
      });
    }).then(function (changed) {
      running = null;
      notify(changed);
      return changed;
    }, function (e) {
      running = null;
      setError(e && e.message ? e.message : String(e));
      notify(false);
      if (window.console) console.warn('[sync]', e);
      return false;
    });
    return running;
  }

  /* ○△× を付けたら呼ばれる。少し待ってから同期する */
  function schedulePush() {
    if (!isEnabled()) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(function () {
      pushTimer = null;
      if (running) running.then(sync); else sync();
    }, PUSH_DELAY);
  }

  /* ページを離れる前に、待っている保存があれば急いで送る */
  function flushOnLeave() {
    if (!pushTimer) return;
    clearTimeout(pushTimer);
    pushTimer = null;
    sync();
  }

  /* トークンを確かめて保存し、最初の同期をする */
  function connect(newToken) {
    newToken = (newToken || '').trim();
    if (!newToken) return Promise.reject(new Error('トークンを入力してください。'));
    var prev = token();
    lsSet('sync_token', newToken);
    return api('GET', '/user').then(function (user) {
      lsSet('sync_user', user && user.login ? user.login : '');
      return sync().then(function () {
        var err = lsGet('sync_error');
        if (err) throw new Error(err);
      });
    }).catch(function (e) {
      if (prev) lsSet('sync_token', prev); else lsDel('sync_token');
      lsDel('sync_user');
      setError('');
      renderPanel();
      throw e;
    });
  }

  /* この端末の同期設定だけを消す（記録と Gist は残る） */
  function disconnect() {
    ['sync_token', 'sync_gist_id', 'sync_user', 'sync_last', 'sync_error'].forEach(lsDel);
    renderPanel();
  }

  /* ── 引き継ぎコード ── */
  function exportCode() {
    var json = JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), progress: readLocal() });
    var bytes = new TextEncoder().encode(json);
    var bin = '';
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return CODE_PREFIX + btoa(bin);
  }
  function parseCode(code) {
    code = (code || '').replace(/\s+/g, '');
    if (code.indexOf(CODE_PREFIX) !== 0) throw new Error('引き継ぎコードの形式が正しくありません（「' + CODE_PREFIX + '」で始まるコードを貼り付けてください）。');
    try {
      var bin = atob(code.slice(CODE_PREFIX.length));
      var bytes = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      var data = JSON.parse(new TextDecoder().decode(bytes));
      if (!data || typeof data.progress !== 'object') throw new Error();
      return data.progress;
    } catch (e) {
      throw new Error('引き継ぎコードを読み取れませんでした。途中で切れていないか確かめてください。');
    }
  }
  /* mode: 'merge'（合わせる）または 'replace'（置き換える） */
  function importCode(code, mode) {
    var incoming = parseCode(code);
    var result = mode === 'replace' ? incoming : merge(readLocal(), incoming);
    writeLocal(result);
    var p;
    if (isEnabled()) {
      if (mode === 'replace') {
        /* 置き換えのときは Gist も同じ内容で上書きする */
        p = findOrCreateGist().then(function (g) {
          return api('PATCH', '/gists/' + g.id, { files: gistBody(readLocal()) });
        }).then(function () {
          lsSet('sync_last', new Date().toISOString());
          setError('');
        }, function (e) { setError(e.message); });
      } else {
        p = sync();
      }
    } else {
      p = Promise.resolve();
    }
    return p.then(function () { notify(true); return countRated(incoming); });
  }

  /* ══ ホームの設定欄（#sync-panel があるページだけ） ══ */
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmtTime(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d)) return '';
    function p(n) { return String(n).padStart(2, '0'); }
    return d.getFullYear() + '/' + p(d.getMonth() + 1) + '/' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }

  function renderPanel() {
    var el = document.getElementById('sync-status');
    if (!el) return;
    var n = countRated(readLocal());
    var html = '<div class="sync-count">この端末の記録：<b>' + n + '</b> 問</div>';
    var err = lsGet('sync_error');
    if (isEnabled()) {
      var user = lsGet('sync_user');
      html += '<div class="sync-state on">● 自動同期：オン' + (user ? '（GitHub：' + esc(user) + '）' : '') + '</div>';
      var last = fmtTime(lsGet('sync_last'));
      html += '<div class="sync-sub">最後に同期した日時：' + (last || 'まだ同期していません') + '</div>';
      if (err) html += '<div class="sync-error">⚠ ' + esc(err) + '</div>';
    } else {
      html += '<div class="sync-state off">○ 自動同期：オフ（記録はこの端末にだけ保存されています）</div>';
    }
    el.innerHTML = html;
    var on = document.getElementById('sync-on-controls');
    var off = document.getElementById('sync-off-controls');
    if (on) on.hidden = !isEnabled();
    if (off) off.hidden = isEnabled();
  }

  function setMsg(id, text, isError) {
    var m = document.getElementById(id);
    if (!m) return;
    m.textContent = text;
    m.className = 'sync-msg' + (isError ? ' error' : '');
  }

  function copyText(textarea) {
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(textarea.value).catch(function () {
        return document.execCommand('copy') ? null : Promise.reject();
      });
    }
    return document.execCommand('copy') ? Promise.resolve() : Promise.reject();
  }

  function setupPanel() {
    if (!document.getElementById('sync-panel')) return;
    renderPanel();

    var connectBtn = document.getElementById('sync-connect-btn');
    var tokenInput = document.getElementById('sync-token-input');
    if (connectBtn && tokenInput) {
      connectBtn.addEventListener('click', function () {
        connectBtn.disabled = true;
        setMsg('sync-connect-msg', '接続しています…');
        connect(tokenInput.value).then(function () {
          tokenInput.value = '';
          setMsg('sync-connect-msg', '接続しました。これからは自動で同期します。');
        }, function (e) {
          setMsg('sync-connect-msg', e.message, true);
        }).then(function () { connectBtn.disabled = false; });
      });
    }

    var nowBtn = document.getElementById('sync-now-btn');
    if (nowBtn) nowBtn.addEventListener('click', function () {
      nowBtn.disabled = true;
      setMsg('sync-on-msg', '同期しています…');
      sync().then(function () {
        var err = lsGet('sync_error');
        setMsg('sync-on-msg', err ? '同期できませんでした。' : '同期しました。', !!err);
        nowBtn.disabled = false;
      });
    });

    var offBtn = document.getElementById('sync-disconnect-btn');
    if (offBtn) offBtn.addEventListener('click', function () {
      if (!confirm('この端末の同期を解除しますか？\n（この端末の記録と、GitHub に保存された記録はどちらも残ります）')) return;
      disconnect();
      setMsg('sync-on-msg', '');
      setMsg('sync-connect-msg', 'この端末の同期を解除しました。');
    });

    var exportBtn = document.getElementById('sync-export-btn');
    var exportArea = document.getElementById('sync-export-code');
    if (exportBtn && exportArea) exportBtn.addEventListener('click', function () {
      exportArea.value = exportCode();
      exportArea.hidden = false;
      copyText(exportArea).then(function () {
        setMsg('sync-export-msg', 'コピーしました（' + countRated(readLocal()) + '問分）。メモなどに貼り付けて保存するか、別の端末で読み込んでください。');
      }, function () {
        setMsg('sync-export-msg', '自動でコピーできませんでした。上の欄のコードを長押しして全選択し、コピーしてください。', true);
      });
    });

    var importArea = document.getElementById('sync-import-code');
    function doImport(mode) {
      if (!importArea) return;
      if (mode === 'replace' && !confirm('この端末の記録を、コードの内容で置き換えます。' + (isEnabled() ? '\nGitHub に保存された記録も同じ内容になります。' : '') + '\nよろしいですか？')) return;
      var n;
      try { parseCode(importArea.value); } catch (e) { setMsg('sync-import-msg', e.message, true); return; }
      setMsg('sync-import-msg', '読み込んでいます…');
      importCode(importArea.value, mode).then(function (count) {
        n = count;
        importArea.value = '';
        setMsg('sync-import-msg', (mode === 'replace' ? '置き換えました' : '合わせました') + '（コード内の記録：' + n + '問）。');
      }, function (e) { setMsg('sync-import-msg', e.message, true); });
    }
    var mergeBtn = document.getElementById('sync-import-merge-btn');
    var replaceBtn = document.getElementById('sync-import-replace-btn');
    if (mergeBtn) mergeBtn.addEventListener('click', function () { doImport('merge'); });
    if (replaceBtn) replaceBtn.addEventListener('click', function () { doImport('replace'); });
  }

  /* ── 起動 ── */
  var lastFocusSync = 0;
  function start() {
    setupPanel();
    if (isEnabled()) { lastFocusSync = Date.now(); sync(); }
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') { flushOnLeave(); return; }
      if (isEnabled() && Date.now() - lastFocusSync > RESYNC_AFTER) { lastFocusSync = Date.now(); sync(); }
    });
    window.addEventListener('pagehide', flushOnLeave);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

  window.SiteSync = {
    sync: sync,
    schedulePush: schedulePush,
    isEnabled: isEnabled,
    merge: merge,
    exportCode: exportCode,
    parseCode: parseCode,
    importCode: importCode
  };
})();
