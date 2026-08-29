// ==UserScript==
// @name         FC2CMADB-improved
// @namespace    [https://sleazyfork.org/zh-CN/scripts/583333-fc2cmadb-improved](https://sleazyfork.org/zh-CN/scripts/583333-fc2cmadb-improved)
// @version      1.4.10
// @description  参考Duckee KememChan的fc2脚本用AI重构(精简版)
// @author       Awei
// @icon         [https://fc2cmadb.com/favicon.ico](https://fc2cmadb.com/favicon.ico)
// @match        *://fc2cmadb.com/*
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// @license      MIT
// @downloadURL https://raw.githubusercontent.com/iahg0/lib-improved/master/FC2CMADB-improved.js
// @updateURL https://raw.githubusercontent.com/iahg0/lib-improved/master/FC2CMADB-improved.js
// ==/UserScript==
(function() {
'use strict';

const CSS = `
@import url("https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css");
#fc2-custom-panel{background:rgba(17,25,40,.75);backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:20px;margin:20px 0 30px;width:100%;color:#fff;box-shadow:0 8px 32px rgba(0,0,0,.3)}
.fc2-btn-row{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:20px;padding-bottom:15px;border-bottom:1px solid rgba(255,255,255,.1)}
.fc2-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:8px 16px;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none!important;transition:all .2s ease;background:rgba(255,255,255,.1);color:#fff}
.fc2-btn:hover{transform:translateY(-2px);background:rgba(255,255,255,.25);box-shadow:0 4px 12px rgba(0,0,0,.2)}
.fc2-btn-missav{color:#ff9e9e}.fc2-btn-njav{color:#a78bfa}.fc2-btn-sukebei{color:#ffda9e}.fc2-btn-magnet{color:#9eecff;background:rgba(59,130,246,.2)}
.fc2-preview-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:15px}
.fc2-media{width:100%;height:auto;border-radius:8px;object-fit:cover;box-shadow:0 4px 10px rgba(0,0,0,.2);background:#1a1a2e}
.fc2-custom-card-wrapper{display:flex;flex-direction:column;background:rgba(30,41,59,.5);border:1px solid rgba(255,255,255,.08);border-radius:12px;overflow:hidden;transition:transform .2s,box-shadow .2s}
.fc2-custom-card-wrapper:hover{transform:translateY(-4px);box-shadow:0 12px 24px rgba(0,0,0,.4)}
.fc2-original-card-override{background:transparent!important;border:none!important;box-shadow:none!important;border-radius:12px 12px 0 0!important;flex-grow:1}
.fc2-card-btn-row{display:flex;gap:8px;flex-wrap:wrap;padding:12px;width:100%;background:rgba(15,23,42,.7);border-top:1px solid rgba(255,255,255,.05);margin-top:auto;justify-content:center;position:relative;z-index:20}
.fc2-card-btn{display:inline-flex;align-items:center;justify-content:center;gap:4px;padding:5px 10px;border-radius:6px;font-size:11px;font-weight:600;text-decoration:none!important;transition:all .2s ease}
.fc2-card-btn:hover{transform:translateY(-2px);filter:brightness(1.2)}
.fc2-card-btn-missav{color:#ff9e9e;background:rgba(255,158,158,.15)}.fc2-card-btn-njav{color:#a78bfa;background:rgba(167,139,250,.15)}.fc2-card-btn-sukebei{color:#ffda9e;background:rgba(255,218,158,.15)}.fc2-card-btn-magnet{color:#9eecff;background:rgba(158,236,255,.15)}.fc2-card-bookmark-count{color:#fbbf24;background:rgba(251,191,36,.15);cursor:default}
#fc2-magnet-toggle,#fc2-bookmark-toggle,#fc2-sort-toggle{position:fixed;right:20px;z-index:2147483647;display:flex;align-items:center;gap:10px;padding:8px 14px;background:rgba(17,25,40,.85);backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,.1);border-radius:24px;box-shadow:0 8px 32px rgba(0,0,0,.3);color:#fff;font-size:13px;font-weight:600;cursor:pointer;user-select:none;transition:all .2s ease}
#fc2-magnet-toggle{top:70px}
#fc2-bookmark-toggle{top:116px}
#fc2-sort-toggle{top:162px}
#fc2-magnet-toggle:hover,#fc2-bookmark-toggle:hover,#fc2-sort-toggle:hover{background:rgba(30,41,59,.9)}
.fc2-toggle-track{width:36px;height:20px;background:rgba(255,255,255,.2);border-radius:10px;position:relative;transition:background .2s;flex-shrink:0}
.fc2-toggle-track::after{content:'';position:absolute;top:2px;left:2px;width:16px;height:16px;background:#fff;border-radius:50%;transition:transform .2s}
.fc2-toggle-on .fc2-toggle-track{background:rgba(59,130,246,.8)}
.fc2-toggle-on .fc2-toggle-track::after{transform:translateX(16px)}
#fc2-rate-limit-toast{position:fixed;bottom:20px;right:20px;z-index:2147483647;background:rgba(220,38,38,.92);color:#fff;padding:10px 16px;border-radius:8px;font-size:13px;font-weight:600;box-shadow:0 8px 32px rgba(0,0,0,.4);display:none;max-width:340px}
#fc2-lightbox{position:fixed;inset:0;z-index:2147483646;background:rgba(0,0,0,.9);display:none;align-items:center;justify-content:center;cursor:zoom-out;padding:20px;box-sizing:border-box}
#fc2-lightbox img{max-width:100%;max-height:100%;object-fit:contain;border-radius:4px;box-shadow:0 0 40px rgba(0,0,0,.6);cursor:zoom-out}
`;
GM_addStyle(CSS);

// ============ 持久化缓存 (刷新后直接读缓存，不重复请求) ============
const store = {
    get(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); if (v && v.value !== undefined && v.exp > Date.now()) return v.value; } catch (e) {} return d; },
    set(k, v, ttl) { try { localStorage.setItem(k, JSON.stringify({ value: v, exp: Date.now() + ttl })); } catch (e) {} }
};
const makeCache = (key, ttl) => {
    const data = store.get(key, {});
    const mem = new Map(typeof data === 'object' && data ? Object.entries(data) : []);
    return { has: k => mem.has(k), get: k => mem.get(k), set(k, v) { mem.set(k, v); store.set(key, Object.fromEntries(mem), ttl); } };
};

// ============ 节流 + 429 退避 (本站实测 ~5.5 req/s 连续不 429) ============
const H = 3600e3;
const seedCache = makeCache('fc2-seed', 12 * H);
const bookmarkCache = makeCache('fc2-bm', 6 * H);
const baihuseCache = new Map();
let lastSelf = 0, lastExt = 0, until = 0, toastEl;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const limited = () => Date.now() < until;
function backoff() {
    until = Date.now() + 60000;
    if (!toastEl) { toastEl = document.createElement('div'); toastEl.id = 'fc2-rate-limit-toast'; document.body.appendChild(toastEl); }
    toastEl.textContent = '⚠ 触发站点限流 (429)，已暂停请求 60 秒';
    toastEl.style.display = 'block';
    setTimeout(() => toastEl.style.display = 'none', 4000);
}
async function throttle(self, task) {
    while (limited()) await sleep(Math.min(until - Date.now(), 500));
    const wait = (self ? lastSelf : lastExt) + (self ? 900 : 600) + Math.random() * 250 - Date.now();
    if (wait > 0) await sleep(wait);
    if (self) lastSelf = Date.now(); else lastExt = Date.now();
    try { return await task(); } catch (e) { return undefined; }
}

// ============ 书签数低频限流（详情页批量请求容易触发站点反自动化） ============
// 书签数只在用户主动开启后查询；串行且每 5 秒最多一条。
const BM_RATE = 0.2;        // 令牌/秒 → 1 req / 5 秒，避免触发站点反自动化
const BM_BURST = 1;         // 不允许启动突发
const BM_CONCURRENCY = 1;   // 详情页请求必须串行
let bmInFlight = 0, bmTokens = BM_BURST, bmLast = Date.now();
async function bmAcquire() {
    while (limited()) await sleep(Math.min(until - Date.now(), 500));
    while (bmInFlight >= BM_CONCURRENCY) await sleep(60);
    bmInFlight++;
    for (;;) {
        const now = Date.now();
        bmTokens = Math.min(BM_BURST, bmTokens + (now - bmLast) / 1000 * BM_RATE);
        bmLast = now;
        if (bmTokens >= 1) { bmTokens -= 1; break; }
        await sleep(Math.max(50, (1 - bmTokens) / BM_RATE * 1000));
    }
}
function bmRelease() { bmInFlight--; }

const API = {
    // Sukebei 磁力批量查询 (外部站点)。输入已用 Set 去重且为串行 await 调用，
    // 配合 seedCache 缓存即可避免重复请求，无需额外 pending 去重表。
    async sukebei(input) {
        const todo = [...new Set(input)].filter(c => !seedCache.has(c));
        if (!todo.length) return;
        await throttle(false, () => new Promise(r => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: `https://sukebei.nyaa.si/?f=0&c=0_0&q=${encodeURIComponent(todo.join('|'))}&s=seeders&o=desc`,
                onload: res => {
                    if (res.status === 429) return backoff(), r();
                    if (res.status !== 200) return todo.forEach(c => seedCache.set(c, null)), r();
                    const doc = new DOMParser().parseFromString(res.responseText, 'text/html');
                    todo.forEach(c => seedCache.set(c, null));
                    doc.querySelectorAll('tbody > tr').forEach(row => {
                        const title = Array.from(row.querySelectorAll('td a:not(.comments)')).map(a => a.textContent).join(' ');
                        const c = todo.find(code => title.includes(code));
                        if (c && !seedCache.get(c)) {
                            const dl = row.querySelector('td a i.fa-download')?.parentElement?.href || '';
                            seedCache.set(c, {
                                torrent: dl ? new URL(dl, 'https://sukebei.nyaa.si').href : '',
                                magnet: row.querySelector('td a i.fa-magnet')?.parentElement?.href || '',
                                seed: row.querySelector('td:nth-last-child(3)')?.textContent.replace(/[^0-9]/g, '') || '0'
                            });
                        }
                    });
                    r();
                },
                onerror: () => { todo.forEach(c => seedCache.set(c, null)); r(); }
            });
        }));
    },

    // Baihuse 预览图/视频 (外部站点)
    baihuse(code) {
        if (baihuseCache.has(code)) return baihuseCache.get(code);
        const p = throttle(false, () => new Promise(r => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: `https://baihuse.com/fc2daily/detail/FC2-PPV-${code}`,
                onload: res => {
                    if (res.status !== 200) return r({ images: [], videos: [] });
                    const doc = new DOMParser().parseFromString(res.responseText, 'text/html');
                    const path = `/fc2daily/data/FC2-PPV-${code}/`;
                    const abs = src => src && src.includes(path) ? (src[0] === '/' ? 'https://baihuse.com' : 'https://baihuse.com/') + src : null;
                    r({
                        images: [...doc.querySelectorAll('img')].map(i => abs(i.getAttribute('src'))).filter(Boolean),
                        videos: [...doc.querySelectorAll('video')].map(v => abs(v.getAttribute('src') || v.querySelector('source')?.getAttribute('src'))).filter(Boolean)
                    });
                },
                onerror: () => r({ images: [], videos: [] })
            });
        }));
        p.then(v => { baihuseCache.set(code, v); });
        return p;
    },

    // 书签数 (打本站 → 并发限流 + 429 退避)
    async bookmark(code) {
        if (bookmarkCache.has(code)) return bookmarkCache.get(code);
        const v = await (async () => {
            await bmAcquire();
            try {
                const res = await fetch(`/articles/${encodeURIComponent(code)}`, { credentials: 'same-origin' });
                if (res.status === 429) return backoff(), undefined;
                if (!res.ok) return undefined;
                const m = (await res.text()).match(/"bookmark_count"\s*:\s*(\d+)/);
                return m ? +m[1] : null;
            } finally { bmRelease(); }
        })();
        if (v !== undefined) bookmarkCache.set(code, v);
        return v;
    },

    // 批次查书签数：并发拉取，受 bmAcquire/bmRelease 限流控制；命中 429 由 backoff 统一暂停
    async bookmarkBatch(codes) {
        if (!bookmarkEnabled) return;
        const todo = [...new Set(codes)].filter(c => !bookmarkCache.has(c));
        if (!todo.length) return;
        await Promise.all(todo.map(c => this.bookmark(c)));
    }
};

// ============ 开关 ============
const load = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : v === '1'; } catch (e) { return d; } };
let hideNoMagnet = load('fc2-hide-no-magnet', false);
// v2 deliberately defaults to off.  Bookmark counts require opening a detail
// page for every card, which can otherwise trigger the site's rate limit.
let bookmarkEnabled = load('fc2-bookmark-enabled-v2', false);
let sortByBookmark = load('fc2-sort-by-bookmark', false);

const isBookmarkRankingPage = () => /^\/articles\/bookmark-ranking\/?$/.test(location.pathname);

function makeToggle(id, label, key, onChange) {
    let el = document.getElementById(id);
    if (!el) {
        el = document.createElement('div');
        el.id = id;
        el.innerHTML = `<span class="fc2-toggle-track"></span><span>${label}</span>`;
        el.addEventListener('click', () => {
            const on = el.classList.toggle('fc2-toggle-on');
            try { localStorage.setItem(key, on ? '1' : '0'); } catch (e) {}
            onChange(on);
        });
        document.body.appendChild(el);
    }
    return el;
}

function applyMagnetFilter() {
    document.querySelectorAll('.fc2-custom-card-wrapper').forEach(w => {
        w.style.display = hideNoMagnet && w.dataset.fc2HasMagnet !== 'true' ? 'none' : '';
    });
}

// Sort complete cards (rather than just their image wrappers), keeping items with an
// unavailable bookmark count at the end.  Remembering the initial index lets the
// toggle restore the site's natural order without another page load.
function applyBookmarkSort() {
    // This route is already ordered by the server and must never cause client-side
    // detail-page activity or be reordered using incomplete cached values.
    if (isBookmarkRankingPage()) return;
    const groups = new Map();
    const codeOf = card => (card.matches('.fc2-custom-card-wrapper') ? card : card.querySelector('.fc2-custom-card-wrapper'))?.dataset.code;
    document.querySelectorAll('.fc2-custom-card-wrapper[data-code]').forEach((wrap, index) => {
        const card = wrap.closest('.card') || wrap;
        const parent = card.parentElement;
        if (!parent || !card.isConnected) return;
        if (!card.dataset.fc2BookmarkOrder) card.dataset.fc2BookmarkOrder = String(index);
        if (!groups.has(parent)) groups.set(parent, []);
        groups.get(parent).push(card);
    });
    groups.forEach(cards => {
        cards.sort((a, b) => {
            if (!sortByBookmark) return Number(a.dataset.fc2BookmarkOrder) - Number(b.dataset.fc2BookmarkOrder);
            const av = bookmarkCache.get(codeOf(a));
            const bv = bookmarkCache.get(codeOf(b));
            const an = typeof av === 'number', bn = typeof bv === 'number';
            if (an && bn) return bv - av || Number(a.dataset.fc2BookmarkOrder) - Number(b.dataset.fc2BookmarkOrder);
            if (an) return -1;
            if (bn) return 1;
            return Number(a.dataset.fc2BookmarkOrder) - Number(b.dataset.fc2BookmarkOrder);
        });
        cards.forEach(card => card.parentElement.appendChild(card));
    });
}

// 判断卡片图片是否为站点的 no-image 占位图（image_url 为空或真实缩略图加载失败时）
function isNoImage(img) {
    const src = img.getAttribute('src') || img.src || '';
    return src.includes('no-image.jpg');
}

// 无图/坏图卡片：尝试从 baihuse 明细页读取 cover.jpg 作为封面（data-fc2Cover 防重复）
function fetchCover(img, code) {
    if (img.dataset.fc2Cover === code || !img.isConnected) return;
    if (!isNoImage(img)) return;
    img.dataset.fc2Cover = code;
    API.baihuse(code).then(media => {
        const cover = media.images.find(s => /cover\.jpg$/i.test(s)) || media.images[0];
        if (cover && img.isConnected) {
            img.src = cover;
            img.removeAttribute('srcset');
        }
    });
}

// 懒加载封面：仅在卡片进入视口时才请求 cover.jpg，避免一次性请求整页明细图
// 触发 baihuse 限流、进而拖慢/拖垮详情页预览（详情页预览同样依赖 baihuse）。
let coverObserver = null;
function setupCoverFallback(img, code) {
    // 真实缩略图失效时站点 onError 会回退到 no-image.jpg，这里补一次兜底
    // （懒加载图通常只在进入视口后才触发 error，天然不会造成瞬时大量请求）
    img.addEventListener('error', () => setTimeout(() => fetchCover(img, code), 0));
    if (!('IntersectionObserver' in window)) { fetchCover(img, code); return; }
    if (!coverObserver) {
        coverObserver = new IntersectionObserver(entries => {
            entries.forEach(en => {
                if (!en.isIntersecting) return;
                coverObserver.unobserve(en.target);
                fetchCover(en.target, en.target.dataset.fc2CoverCode);
            });
        }, { rootMargin: '200px' });
    }
    img.dataset.fc2CoverCode = code;
    coverObserver.observe(img);
}


// 详情页预览图点击放大 (lightbox)
function bindLightbox(container) {
    container.querySelectorAll('img.fc2-media').forEach(img => {
        if (img.dataset.lb) return;
        img.dataset.lb = '1';
        img.style.cursor = 'zoom-in';
        img.addEventListener('click', () => {
            let box = document.getElementById('fc2-lightbox');
            if (!box) {
                box = document.createElement('div');
                box.id = 'fc2-lightbox';
                // 单击图片本身也可关闭（不再要求点图片旁边的空白区域）
                box.addEventListener('click', () => box.style.display = 'none');
                document.body.appendChild(box);
            }
            box.innerHTML = `<img src="${img.src}" alt=""/>`;
            box.style.display = 'flex';
        });
    });
}

// ============ 渲染 ============
const escapeHtml = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// 从 Inertia 挂载点读取当前组件名 / 版本 / URL (用于按需拉取后续分页数据)
function inertiaMeta() {
    const el = document.querySelector('script[data-page="app"]');
    if (!el) return null;
    try {
        const d = JSON.parse(el.textContent || '');
        return { component: d.component, version: d.version, url: d.url };
    } catch (e) { return null; }
}

// 通过 Inertia partial reload 请求指定页的 articles 数据，返回 { data, last_page, ... } 或 null
// 注意：请求必须纳入本站节流 (throttle self) + 429 退避，
// 否则会产生不受限流的连续请求，极易触发站点限流导致强制登出。
async function fetchPageData(meta, page) {
    const url = new URL(meta.url || location.href, location.origin);
    url.searchParams.set('page', String(page));
    return throttle(true, () => new Promise(r => {
        fetch(url.toString(), {
            headers: {
                'X-Inertia': 'true',
                'X-Inertia-Version': meta.version,
                'X-Inertia-Partial-Component': meta.component,
                'X-Inertia-Partial-Data': 'articles'
            },
            credentials: 'same-origin'
        }).then(res => {
            if (res.status === 429) { backoff(); return r(null); }   // 被限流：退避 60s 并停止翻页
            if (res.status === 409 || !res.ok) return r(null);
            return res.json().then(d => r((d && d.props && d.props.articles) || null)).catch(() => r(null));
        }).catch(() => r(null));
    }));
}

// 找出文章卡片所在的列表容器 (flex-wrap)
function findListContainer(firstFigure) {
    return (firstFigure?.closest('.card')?.parentElement)
        || document.querySelector('div.flex.flex-wrap.bg-base-100.p-2')
        || null;
}

// （已移除 fillTo30 补页：从后续页拉项目补当前页会导致跨页重复，并把后续页的项目
//   从它们原生页移除而变空。隐藏无磁力时仅过滤当前页，各页独立稳定，不再注入后续页项目。）

// 为单张卡片创建(或复用)增强按钮行，返回按钮行元素
// 恢复到"最开始"的样式：只包 <figure>（图片区），wrapper 深色圆角卡片 + 底部按钮行，
// 标题(card-body)留在 wrapper 外、由站点正常渲染在图片下方。
function wrapCardRow(figure, code) {
    let row;
    if (figure?.parentElement && !figure.parentElement.classList.contains('fc2-custom-card-wrapper')) {
        const wrap = document.createElement('div');
        wrap.className = 'fc2-custom-card-wrapper'; wrap.dataset.code = code;
        if (figure.classList.contains('h-full')) { figure.classList.remove('h-full'); wrap.classList.add('h-full'); }
        figure.parentNode.insertBefore(wrap, figure);
        wrap.appendChild(figure);
        figure.classList.add('fc2-original-card-override');
        row = document.createElement('div');
        row.className = 'fc2-card-btn-row';
        row.addEventListener('click', e => e.stopPropagation());
        row.innerHTML = `
            <span class="fc2-card-btn fc2-card-bookmark-count" title="收藏"><i class="fa-solid fa-bookmark"></i> <span class="fc2-bookmark-value">…</span></span>
            <a href="https://missav.ws/en/fc2-ppv-${code}" target="_blank" class="fc2-card-btn fc2-card-btn-missav">MissAV</a>
            <a href="https://123av.com/en/v/fc2-ppv-${code}" target="_blank" class="fc2-card-btn fc2-card-btn-njav">Njav</a>
            <a href="https://sukebei.nyaa.si/?f=0&c=0_0&q=${code}&s=seeders&o=desc" target="_blank" class="fc2-card-btn fc2-card-btn-sukebei fc2-sukebei-btn-${code}"><i class="fa-solid fa-magnifying-glass"></i> 搜索</a>
        `;
        wrap.appendChild(row);
    } else if (figure?.parentElement?.classList.contains('fc2-custom-card-wrapper')) {
        row = figure.parentElement.querySelector('.fc2-card-btn-row');
    }
    return row;
}

const App = {
    async renderList() {
        const map = new Map(), entries = [];
        const seenCodes = new Set();
        document.querySelectorAll('a[href*="/articles/"]').forEach(link => {
            const m = link.href.match(/\/articles\/(\d{6,8})/);
            const img = m && link.querySelector('img');
            const anchor = img?.parentElement;
            if (!anchor || anchor.dataset.fc2P === m[1]) return;
            // 防重复：同一编号只处理第一处；若页面已有同编号卡片，则移除重复项
            if (seenCodes.has(m[1]) || document.querySelector(`[data-fc2P="${m[1]}"]`)) {
                link.closest('.card')?.remove();
                return;
            }
            anchor.dataset.fc2P = m[1];
            seenCodes.add(m[1]);
            setupCoverFallback(img, m[1]);   // 无图/坏图卡片：用明细页 cover.jpg 作为封面
            const figure = link.closest('.rounded-lg') || link.closest('.bg-gray-800') || link.parentElement;
            if (!figure || !figure.isConnected) return;
            entries.push({ code: m[1], figure });
        });
        if (!entries.length) return;

        // 预先检索磁力：先批量查询本页所有 FC 号的磁力情况
        const unique = [...new Set(entries.map(e => e.code))];
        await API.sukebei(unique);

        // 决定保留哪些卡片
        const keep = [];
        if (hideNoMagnet) {
            const magnet = new Set(unique.filter(c => { const s = seedCache.get(c); return !!(s && s.magnet); }));
            entries.forEach(e => {
                if (magnet.has(e.code)) keep.push(e);
                else e.figure.closest('.card')?.remove();   // 无磁力：整卡移除，不留占位、不请求
            });
            // 隐藏无磁力：仅过滤当前页，不请求后续页补页（fillTo30 已移除，避免跨页重复/后续页被清空）
        } else {
            keep.push(...entries);
        }
        if (!keep.length) return;

        // 为保留的卡片创建(或复用)增强按钮行
        const keptCodes = [];
        keep.forEach(e => {
            const row = wrapCardRow(e.figure, e.code);
            if (!row) return;
            if (!map.has(e.code)) { map.set(e.code, []); keptCodes.push(e.code); }
            map.get(e.code).push(row);
        });
        if (!keptCodes.length) return;

        keptCodes.forEach(code => {
            const s = seedCache.get(code), cached = bookmarkCache.get(code);
            (map.get(code) || []).forEach(row => {
                const bv = row.querySelector('.fc2-bookmark-value');
                if (bv) { bv.dataset.code = code; bv.textContent = cached === undefined ? '…' : cached === null ? '-' : cached; }
                row.parentElement.dataset.code = code; row.parentElement.dataset.fc2HasMagnet = !!(s && s.magnet);
                if (s) {
                    const sb = row.querySelector(`.fc2-sukebei-btn-${code}`);
                    if (sb) sb.innerHTML = `<i class="fa-solid fa-seedling"></i> ${s.seed}`;
                    if (!row.querySelector('.fc2-card-btn-magnet') && s.magnet) {
                        row.insertAdjacentHTML('beforeend', `<a href="${s.magnet}" class="fc2-card-btn fc2-card-btn-magnet" title="Magnet (${s.seed})"><i class="fa-solid fa-magnet"></i> 磁力</a>`);
                    }
                }
            });
        });
        applyMagnetFilter();
        applyBookmarkSort();

        // 只对保留(有磁力)的项目请求书签数
        // The server-side bookmark ranking already has the desired order.  Do not
        // request every article detail page here: that reliably trips rate limits.
        if (isBookmarkRankingPage()) return;
        API.bookmarkBatch(keptCodes).then(() => {
            keptCodes.forEach(code => {
                const v = bookmarkCache.get(code);
                if (v === undefined) return;
                const t = v === null ? '-' : String(v);
                document.querySelectorAll(`.fc2-bookmark-value[data-code="${code}"]`).forEach(el => el.textContent = t);
            });
            applyBookmarkSort();
        });
    },

    async renderDetail() {
        if (document.getElementById('fc2-custom-panel')) return;
        const m = location.href.match(/articles\/(\d+)/);
        if (!m) return;
        const code = m[1];
        const target = document.querySelector('h1')?.parentElement || document.querySelector('.container') || document.querySelector('main');
        if (!target?.parentNode) return;

        const panel = document.createElement('div');
        panel.id = 'fc2-custom-panel';
        panel.innerHTML = `<div class="fc2-btn-row" id="fc2-btn-row"><span style="color:#a5a5b5;font-size:14px;display:flex;align-items:center"><i class="fa-solid fa-spinner fa-spin" style="margin-right:8px"></i> 正在获取数据...</span></div><div class="fc2-preview-grid" id="fc2-preview-grid"></div>`;
        target.parentNode.insertBefore(panel, target.nextSibling);

        const [sukebei, media] = await Promise.all([
            API.sukebei([code]).then(() => seedCache.get(code)),
            API.baihuse(code)
        ]);
        document.getElementById('fc2-btn-row').innerHTML = `
            <a href="https://missav.ws/en/fc2-ppv-${code}" target="_blank" class="fc2-btn fc2-btn-missav"><i class="fa-solid fa-globe"></i> MissAV</a>
            <a href="https://123av.com/en/v/fc2-ppv-${code}" target="_blank" class="fc2-btn fc2-btn-njav"><i class="fa-solid fa-globe"></i> Njav</a>
            <a href="https://sukebei.nyaa.si/?f=0&c=0_0&q=${code}&s=seeders&o=desc" target="_blank" class="fc2-btn fc2-btn-sukebei"><i class="fa-solid fa-magnifying-glass"></i> Sukebei</a>
            ${sukebei ? `<a href="${sukebei.magnet}" class="fc2-btn fc2-btn-magnet" title="Magnet"><i class="fa-solid fa-magnet"></i> Magnet (${sukebei.seed})</a>` : ''}
        `;
        const grid = document.getElementById('fc2-preview-grid');
        const html = [
            ...media.videos.map(s => `<video src="${s}" class="fc2-media" autoplay loop muted playsinline controls></video>`),
            ...media.images.map(s => `<img src="${s}" class="fc2-media" loading="lazy"/>`)
        ].join('');
        grid.innerHTML = html || '<div style="color:gray;padding:20px;text-align:center;grid-column:1/-1">暂无可用预览图或视频</div>';
        bindLightbox(grid);
    },

    init() {
        const mt = makeToggle('fc2-magnet-toggle', '仅显示有磁力链接的项目', 'fc2-hide-no-magnet', on => { hideNoMagnet = on; applyMagnetFilter(); });
        if (hideNoMagnet) mt.classList.add('fc2-toggle-on');
        const bt = makeToggle('fc2-bookmark-toggle', '书签数查询（低频）', 'fc2-bookmark-enabled-v2', on => {
            bookmarkEnabled = on;
            if (!on) document.querySelectorAll('.fc2-bookmark-value[data-code]').forEach(el => { if (el.textContent === '…') el.textContent = '-'; });
        });
        if (bookmarkEnabled) bt.classList.add('fc2-toggle-on');
        const st = makeToggle('fc2-sort-toggle', '按书签数排序', 'fc2-sort-by-bookmark', on => {
            sortByBookmark = on;
            applyBookmarkSort();
        });
        if (sortByBookmark) st.classList.add('fc2-toggle-on');
        this.renderList();
        if (location.href.includes('/articles/')) this.renderDetail();
    }
};

// ============ SPA 监听 + 延迟初始化 ============
let lastUrl = location.href, renderTimer;
new MutationObserver(() => {
    if (location.href !== lastUrl) {
        lastUrl = location.href;
        document.getElementById('fc2-custom-panel')?.remove();
        setTimeout(() => App.init(), 800);
    } else {
        clearTimeout(renderTimer);
        renderTimer = setTimeout(() => App.renderList(), 200);
    }
}).observe(document.body, { childList: true, subtree: true });

setTimeout(() => App.init(), 1500);
})();
