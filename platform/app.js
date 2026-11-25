'use strict';
/* SCIVILL platform
 * - 대회: 자동 수집 서버(config.json의 apiBase) + 운영진이 직접 확인한 curated.json
 * - 팀·프로젝트·일정·관심: 이 브라우저(localStorage)에만 저장
 */
(() => {
  // ---------------------------------------------------------------- utils
  const $ = (s, root = document) => root.querySelector(s);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = p => `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  const safeLink = v => { try { const u = new URL(v); return u.protocol === 'https:' && !u.username && !u.password ? u.href : '#'; } catch { return '#'; } };

  const ICON = {
    home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5"/>',
    trophy: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4Z"/><path d="M7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M21.5 20a6.5 6.5 0 0 0-4-6"/>',
    folder: '<path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H9l2 2.5h8.5A1.5 1.5 0 0 1 21 9v9.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5Z"/>',
    calendar: '<rect x="3" y="4.5" width="18" height="16.5" rx="2.5"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    bell: '<path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8Z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
    bookmark: '<path d="M6 3.5h12v17l-6-4-6 4Z"/>',
    chevronRight: '<path d="m9 6 6 6-6 6"/>',
    chevronLeft: '<path d="m15 6-6 6 6 6"/>',
    back: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    external: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    award: '<circle cx="12" cy="9" r="6"/><path d="m8.5 14-1.5 7 5-3 5 3-1.5-7"/>',
    cog: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M4.6 4.6l2.1 2.1M17.3 17.3l2.1 2.1M2.5 12h3M18.5 12h3M4.6 19.4l2.1-2.1M17.3 6.7l2.1-2.1"/>',
    code: '<path d="m8 7-5 5 5 5M16 7l5 5-5 5M14 4l-4 16"/>',
    leaf: '<path d="M4 20s1-11 16-16c0 11-7 16-13 16"/><path d="M4 20 12 12"/>',
    archive: '<rect x="3" y="4" width="18" height="5" rx="1.5"/><path d="M5 9v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9M10 13h4"/>',
    activity: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.01"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11Z"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16Z"/><path d="m13.5 6.5 4 4"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
    lock: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/>'
  };
  const ic = (n, s = 20, fill = false) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="${fill ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[n] || ''}</svg>`;

  // ---------------------------------------------------------------- dates (KST)
  const KST = 'Asia/Seoul';
  const WD = ['일', '월', '화', '수', '목', '금', '토'];
  const kstKey = d => new Intl.DateTimeFormat('sv-SE', { timeZone: KST, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  const todayKey = () => kstKey(new Date());
  const ymd = s => s.slice(0, 10).split('-').map(Number);
  const weekday = s => { const [y, m, d] = ymd(s); return WD[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]; };
  function fmtDay(s, withYear = false) { if (!s) return ''; const [y, m, d] = ymd(s); const cy = +todayKey().slice(0, 4); return `${withYear || y !== cy ? y + '년 ' : ''}${m}월 ${d}일 (${weekday(s)})`; }
  const fmtToday = () => { const k = todayKey(); const [, m, d] = ymd(k); return `${m}월 ${d}일 ${weekday(k)}요일`; };
  function daysUntil(s) { const t = Date.parse(todayKey() + 'T00:00:00+09:00'); const d = Date.parse(s.slice(0, 10) + 'T00:00:00+09:00'); return Math.round((d - t) / 864e5); }
  function addDays(key, n) { const [y, m, d] = ymd(key); const t = new Date(Date.UTC(y, m - 1, d + n)); return t.toISOString().slice(0, 10); }
  const fmtStamp = v => v ? new Intl.DateTimeFormat('ko-KR', { timeZone: KST, month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(v)) : '기록 없음';

  // ---------------------------------------------------------------- competition helpers
  const endAt = c => new Date(c.applicationEndAt.length === 10 ? `${c.applicationEndAt}T23:59:59.999+09:00` : c.applicationEndAt);
  const startAt = c => c.applicationStartAt ? new Date(`${c.applicationStartAt.slice(0, 10)}T00:00:00+09:00`) : null;
  function status(c) {
    const now = Date.now(), e = +endAt(c);
    if (!Number.isFinite(e)) return 'unknown';
    if (now > e) return 'closed';
    const s = startAt(c);
    if (s && now < +s) return 'upcoming';
    return 'open';
  }
  function dday(c) {
    const st = status(c);
    if (st === 'closed') return '마감';
    if (st === 'upcoming') { const n = daysUntil(c.applicationStartAt); return n <= 0 ? '곧 시작' : n === 1 ? '내일 시작' : `${n}일 후 시작`; }
    const n = daysUntil(c.applicationEndAt);
    return n <= 0 ? '오늘 마감' : `D-${n}`;
  }
  const endTime = c => c.deadlineTimeConfirmed && c.applicationEndAt.length > 10 ? c.applicationEndAt.slice(11, 16) : '';
  const CATS = [
    { key: '장관상 대회', label: '장관상', icon: 'award', tone: 'gold' },
    { key: '공학', label: '공학', icon: 'cog', tone: 'blue' },
    { key: '소프트웨어', label: '소프트웨어', icon: 'code', tone: 'violet' },
    { key: '기타·환경', label: '환경·기타', icon: 'leaf', tone: 'green' }
  ];
  const catOf = key => CATS.find(c => c.key === key) || CATS[3];
  const subjectCat = c => CATS.slice(1).find(x => c.tags.includes(x.key)) || (c.tags.includes('장관상 대회') ? CATS[0] : CATS[3]);
  const modeLabel = c => c.participation === 'individual' ? '개인' : c.participation === 'team' ? '팀' : c.participation === 'both' ? '개인·팀' : '참가 형태 확인';
  function people(c) {
    if (c.participationLabel) return c.participationLabel;
    if (c.participation === 'individual') return '개인 1명';
    if (c.teamMinSize && c.teamMaxSize) return c.teamMinSize === c.teamMaxSize ? `팀당 ${c.teamMaxSize}명` : `팀당 ${c.teamMinSize}~${c.teamMaxSize}명`;
    return '공식 공고에서 확인';
  }
  function scoreNow(c) {
    const days = (+endAt(c) - Date.now()) / 864e5;
    const t = days >= 7 && days <= 60 ? 10 : days > 60 ? 7 : days >= 3 ? 4 : days >= 0 ? 1 : 0;
    return (c.relevanceScore || 0) - (c.scoreBreakdown?.['준비 기간'] || 0) + t;
  }
  function posterSrc(c) {
    if (!(c.posterUrl && c.posterDisplayAllowed)) return '';
    return /^assets\/[a-zA-Z0-9._-]+\.(jpg|png|webp)$/.test(c.posterAsset || '') ? c.posterAsset : safeLink(c.posterUrl);
  }
  const byDeadline = (a, b) => +endAt(a) - +endAt(b);
  const byStart = (a, b) => (a.applicationStartAt || '').localeCompare(b.applicationStartAt || '');

  // ---------------------------------------------------------------- local state
  const STORE_KEY = 'scvill.workspace.v1';
  const EXAMPLE_TEAMS = new Set(['t1', 't2', 't3']);
  function seed() {
    const t = todayKey();
    return {
      version: 1, profile: { name: '싸이빌 부원', interest: '과학 · 공학' }, saved: [], applications: [], competitions: [],
      teams: [
        { id: 't1', name: '지구를 구하는 작은 기술', category: '기타·환경', competition: '', description: '교실의 에너지 낭비를 줄이는 스마트 절전 시스템을 만들고 있어요. 함께 실험하고 아이디어를 구체화할 팀원을 찾아요.', roles: '실험 설계, 하드웨어', members: 2, capacity: 4, owner: false },
        { id: 't2', name: '데이터 속 숨은 이야기', category: '소프트웨어', competition: '', description: '공공데이터로 우리 동네 환경을 분석해 보려고 해요. 데이터 분석이나 시각화에 관심 있으면 함께해요.', roles: 'Python, 데이터 시각화', members: 2, capacity: 3, owner: false },
        { id: 't3', name: '호기심 실험실', category: '기타·환경', competition: '', description: '식물의 생장 조건을 직접 비교하는 실험을 준비하고 있어요. 관찰하고 기록하는 걸 좋아하는 분을 기다려요.', roles: '생명과학, 관찰 기록', members: 1, capacity: 3, owner: false }
      ],
      projects: [
        { id: 'p1', name: '스마트팜 탐구 프로젝트', description: '센서 데이터로 식물이 좋아하는 환경을 찾아요.', tasks: [
          { id: 'k1', title: '관련 논문과 선행 사례 조사', description: '빛, 온도, 습도 조건을 중심으로 정리하기', status: 'done', tag: '리서치', assignee: '나' },
          { id: 'k2', title: '탐구 질문과 가설 정리', description: '실험에서 검증할 수 있는 질문 선정하기', status: 'done', tag: '기획', assignee: '나' },
          { id: 'k3', title: '센서 측정값 기록하기', description: '같은 시간에 온도와 습도를 기록해요.', status: 'doing', tag: '실험', assignee: '나' },
          { id: 'k4', title: '결과 그래프 초안 제작', description: '측정한 데이터의 추세를 살펴보기', status: 'todo', tag: '분석', assignee: '나' },
          { id: 'k5', title: '탐구 보고서 구성', description: '가설, 방법, 결과, 한계를 담아요.', status: 'todo', tag: '기록', assignee: '나' }] },
        { id: 'p2', name: '교내 에너지 데이터 분석', description: '우리 학교 전력 사용 패턴을 살펴보는 데이터 탐구', tasks: [
          { id: 'k6', title: '분석할 데이터 항목 정하기', description: '기간과 장소, 측정 단위 정의', status: 'done', tag: '기획', assignee: '나' },
          { id: 'k7', title: '데이터 수집 계획 세우기', description: '기록 양식과 측정 주기 정하기', status: 'doing', tag: '리서치', assignee: '나' },
          { id: 'k8', title: '분석 결과 시각화', description: '요일과 시간대별 사용량 비교', status: 'todo', tag: '분석', assignee: '나' }] }
      ],
      events: [
        { id: 'e1', title: '동아리 정기 모임', date: addDays(t, 2), time: '16:30', description: '탐구실 · 이번 주 진행 상황 나누기' },
        { id: 'e2', title: '스마트팜 실험 중간 점검', date: addDays(t, 5), time: '15:00', description: '센서 기록을 함께 확인해요.' }
      ]
    };
  }
  function loadState() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      const s = raw ? JSON.parse(raw) : null;
      if (s && s.version === 1 && s.profile && ['teams', 'projects', 'events', 'saved', 'applications'].every(k => Array.isArray(s[k]))) { s.competitions = []; return s; }
    } catch { /* fall through */ }
    return seed();
  }
  let state = loadState();
  let canStore = true;
  function persist() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify({ ...state, competitions: [] })); }
    catch { if (canStore) toast('이 브라우저에서는 저장이 안 돼요. 창을 닫으면 사라져요.'); canStore = false; }
  }
  const isExample = t => EXAMPLE_TEAMS.has(t.id) && !t.owner;

  // ---------------------------------------------------------------- catalogue
  const catalogue = { list: [], ready: false, loading: true, error: '', partial: '', lastCollectedAt: null, lastVerifiedAt: null, changes: [], curatedUpdatedAt: null, curatedCount: 0, serverCount: 0 };
  let ops = {};
  let lastFetch = 0;
  const fetchJSON = url => fetch(url, { cache: 'no-store' }).then(r => { if (!r.ok) throw new Error(String(r.status)); return r.json(); });
  const valid = c => c && c.publicationStatus === 'published' && c.verificationStatus === 'verified' && c.eligibilityStatus === 'confirmed'
    && typeof c.applicationEndAt === 'string' && Array.isArray(c.tags) && safeLink(c.officialUrl) !== '#';

  async function loadCatalogue() {
    lastFetch = Date.now();
    catalogue.loading = true;
    let cfg = {};
    try { cfg = await fetchJSON('config.json'); } catch { /* optional */ }
    let base = null;
    try { if (cfg.apiBase) { const u = new URL(cfg.apiBase); if (u.protocol === 'https:') base = u.href.replace(/\/$/, ''); } } catch { /* ignore */ }
    const [srv, st, cur] = await Promise.allSettled([
      fetchJSON(base ? `${base}/api/competitions` : 'data/competitions.json'),
      fetchJSON(base ? `${base}/api/status` : 'data/status.json'),
      fetchJSON('curated.json')
    ]);
    const map = new Map();
    let serverOk = false, curatedOk = false;
    if (srv.status === 'fulfilled' && srv.value?.schemaVersion === 2 && Array.isArray(srv.value.competitions)) {
      serverOk = true;
      for (const c of srv.value.competitions) if (valid(c)) map.set(c.id, { ...c, source: 'server' });
      catalogue.serverCount = map.size;
      catalogue.lastCollectedAt = srv.value.lastCollectedAt || null;
      catalogue.lastVerifiedAt = srv.value.lastVerifiedAt || null;
      catalogue.changes = Array.isArray(srv.value.changes) ? srv.value.changes : [];
    }
    if (cur.status === 'fulfilled' && Array.isArray(cur.value?.competitions)) {
      curatedOk = true;
      catalogue.curatedUpdatedAt = cur.value.updatedAt || null;
      let n = 0;
      for (const c of cur.value.competitions) if (valid(c) && !map.has(c.id)) { map.set(c.id, { ...c, source: 'curated' }); n++; }
      catalogue.curatedCount = n;
    }
    if (st.status === 'fulfilled' && st.value) ops = st.value;
    catalogue.loading = false;
    if (serverOk || curatedOk) {
      catalogue.list = [...map.values()];
      catalogue.ready = true;
      catalogue.error = '';
      catalogue.partial = serverOk ? '' : '자동 수집 서버에 연결하지 못해서 운영진이 확인한 대회만 보여 드리고 있어요.';
    } else {
      catalogue.error = '대회 정보를 불러오지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.';
    }
    render(false);
  }
  const all = () => catalogue.list;
  const findComp = id => all().find(c => c.id === id);
  const active = () => all().filter(c => status(c) !== 'closed');
  const openList = () => all().filter(c => status(c) === 'open');

  // ---------------------------------------------------------------- shared UI bits
  function statusBadge(c) {
    const st = status(c);
    if (st === 'closed') return '<span class="badge">마감</span>';
    if (st === 'upcoming') return `<span class="badge blue">${esc(dday(c))}</span>`;
    const n = daysUntil(c.applicationEndAt);
    return `<span class="badge ${n <= 3 ? 'red' : n <= 7 ? 'orange' : 'brand'}">${esc(dday(c))}</span>`;
  }
  const compBadges = c => `<div class="badges">${statusBadge(c)}${c.hasMinisterAward ? '<span class="badge gold">장관상</span>' : ''}<span class="badge line">${esc(subjectCat(c).label)}</span></div>`;
  function whenText(c) {
    const st = status(c);
    if (st === 'upcoming') return `${fmtDay(c.applicationStartAt)} 접수 시작`;
    const t = endTime(c);
    return `${st === 'closed' ? '마감 ' : '~ '}${fmtDay(c.applicationEndAt)}${t ? ' ' + t : ''}`;
  }
  function bmBtn(c) {
    const on = state.saved.includes(c.id);
    return `<button class="bm-btn" type="button" data-act="bookmark" data-id="${esc(c.id)}" aria-pressed="${on}" aria-label="${esc(c.title)} ${on ? '관심 대회에서 빼기' : '관심 대회로 저장'}">${ic('bookmark', 20, on)}</button>`;
  }
  function thumb(c) {
    const src = posterSrc(c), cat = subjectCat(c);
    return src ? `<div class="thumb"><img src="${esc(src)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer"></div>` : `<div class="thumb tone-${cat.tone}">${ic(cat.icon, 26)}</div>`;
  }
  const compHref = c => `#competition/${encodeURIComponent(c.id)}`;
  const compRow = c => `<article class="c-row ${status(c) === 'closed' ? 'closed' : ''}">${thumb(c)}<div class="info">${compBadges(c)}<a class="title clamp-2 stretched" href="${compHref(c)}">${esc(c.title)}</a><div class="org ellipsis">${esc(c.organizer)} · ${esc(modeLabel(c))}</div><div class="when">${esc(whenText(c))}</div></div>${bmBtn(c)}</article>`;
  function compCard(c) {
    const src = posterSrc(c), cat = subjectCat(c);
    return `<article class="c-card"><div class="cover tone-${cat.tone}">${src ? `<img src="${esc(src)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">` : `<span class="cover-cat">${esc(cat.label)}</span><span class="cover-icon">${ic(cat.icon, 34)}</span>`}${statusBadge(c)}</div><div class="body"><a class="title clamp-2 stretched" href="${compHref(c)}">${esc(c.title)}</a><div class="meta ellipsis">${esc(c.organizer)}</div></div>${bmBtn(c)}</article>`;
  }
  const empty = (icon, title, desc = '', action = '') => `<div class="empty"><div class="ic">${ic(icon, 24)}</div><b>${title}</b>${desc ? `<div>${desc}</div>` : ''}${action}</div>`;
  const ext = (url, label, cls = 'btn') => `<a class="${cls}" href="${esc(safeLink(url))}" target="_blank" rel="noopener noreferrer">${label}${ic('external', 16)}</a>`;
  const pageHead = (title, sub = '', action = '') => `<div class="page-head"><div><h1>${title}</h1>${sub ? `<p>${sub}</p>` : ''}</div>${action}</div>`;
  const skeletonCards = n => `<div class="hscroll">${Array.from({ length: n }, () => '<div class="c-card"><div class="cover skel" style="border-radius:0"></div><div class="body"><div class="skel" style="height:18px;width:85%"></div><div class="skel" style="height:14px;width:50%;margin-top:8px"></div></div></div>').join('')}</div>`;
  const skeletonRows = n => `<div class="c-list">${Array.from({ length: n }, () => '<div class="c-row"><div class="thumb skel"></div><div class="info"><div class="skel" style="height:18px;width:40%"></div><div class="skel" style="height:18px;width:90%"></div><div class="skel" style="height:14px;width:60%"></div></div></div>').join('')}</div>`;
  function catalogueNotice() {
    if (catalogue.error && !catalogue.ready) return `<div class="notice error">${ic('info', 20)}<span>${esc(catalogue.error)}</span><button class="btn sm secondary" type="button" data-act="reload">다시 시도</button></div>`;
    if (catalogue.partial) return `<div class="notice">${ic('info', 20)}<span>${esc(catalogue.partial)}</span><button class="btn sm secondary" type="button" data-act="reload">다시 시도</button></div>`;
    return '';
  }
  const TONE_BY_CAT = { '장관상 대회': 'gold', '공학': 'blue', '소프트웨어': 'violet', '기타·환경': 'green' };
  const teamAvatar = t => `<span class="avatar tone-${TONE_BY_CAT[t.category] || 'green'}">${esc((t.name || '?').trim().slice(0, 1))}</span>`;

  // ---------------------------------------------------------------- router
  const NAV = [
    { id: 'home', icon: 'home', label: '홈' },
    { id: 'competitions', icon: 'trophy', label: '대회' },
    { id: 'teams', icon: 'users', label: '팀원 모집', short: '팀' },
    { id: 'projects', icon: 'folder', label: '프로젝트' },
    { id: 'calendar', icon: 'calendar', label: '캘린더', short: '일정' },
    { id: 'my', icon: 'user', label: 'MY' }
  ];
  const MORE = [{ id: 'archive', icon: 'archive', label: '지난 대회' }, { id: 'monitor', icon: 'activity', label: '수집 현황' }];
  const TABS = ['home', 'competitions', 'teams', 'calendar', 'my'];
  const TITLES = { home: '홈', competitions: '대회', competition: '대회 정보', archive: '지난 대회', monitor: '수집 현황', teams: '팀원 모집', projects: '프로젝트', calendar: '캘린더', my: 'MY' };
  let route = 'home', routeId = '';
  function parseHash() {
    const [r, id] = (location.hash.slice(1) || 'home').split('/');
    const alias = { saved: 'my', competition: 'competition' };
    const next = alias[r] || r;
    route = TITLES[next] ? next : 'home';
    routeId = id ? decodeURIComponent(id) : '';
    if (route === 'projects' && routeId) selectedProject = routeId;
  }

  // ---------------------------------------------------------------- chrome
  function renderChrome() {
    const navActive = route === 'competition' || route === 'archive' ? (route === 'archive' ? 'archive' : 'competitions') : route;
    const savedCount = state.saved.filter(id => { const c = findComp(id); return c && status(c) !== 'closed'; }).length;
    $('#side-nav').innerHTML = NAV.map(n => `<a class="nav-link ${navActive === n.id ? 'active' : ''}" href="#${n.id}" ${navActive === n.id ? 'aria-current="page"' : ''}>${ic(n.icon, 20)}<span>${n.label}</span>${n.id === 'my' && savedCount ? `<span class="count">${savedCount}</span>` : ''}</a>`).join('')
      + '<div class="nav-group">더보기</div>'
      + MORE.map(n => `<a class="nav-link ${navActive === n.id ? 'active' : ''}" href="#${n.id}" ${navActive === n.id ? 'aria-current="page"' : ''}>${ic(n.icon, 20)}<span>${n.label}</span></a>`).join('');
    const dark = document.documentElement.dataset.theme === 'dark';
    $('#side-foot').innerHTML = `<button class="side-profile" type="button" data-act="profile"><span class="avatar" style="width:36px;height:36px;border-radius:11px;font-size:14px;background:var(--brand-weak);color:var(--brand-ink)">${esc((state.profile.name || '나').slice(0, 1))}</span><span class="grow"><b class="ellipsis">${esc(state.profile.name)}</b><span class="ellipsis">${esc(state.profile.interest || '관심 분야를 적어 주세요')}</span></span></button>`
      + `<button class="nav-link" type="button" data-act="toggle-theme" style="border:0;background:none;width:100%">${ic(dark ? 'sun' : 'moon', 20)}<span>${dark ? '라이트 모드' : '다크 모드'}</span></button>`
      + `<button class="nav-link" type="button" data-act="about" style="border:0;background:none;width:100%">${ic('info', 20)}<span>이용 안내</span></button>`;
    const tabActive = navActive === 'archive' || navActive === 'monitor' || navActive === 'projects' ? 'my' : navActive;
    $('#tabbar').innerHTML = TABS.map(id => { const n = NAV.find(x => x.id === id); const on = tabActive === id; return `<a class="tab ${on ? 'active' : ''}" href="#${id}" ${on ? 'aria-current="page"' : ''}>${ic(n.icon, 24)}<span>${n.short || n.label}</span></a>`; }).join('');
    const hasAlert = allEvents().some(e => e.date >= todayKey() && daysUntil(e.date) <= 3);
    const sub = route !== 'home' && !TABS.includes(route);
    const left = route === 'home'
      ? `<a class="topbar-logo" href="#home" aria-label="SCIVILL 홈"><span class="logo-mark" aria-hidden="true">S</span>SCIVILL</a><div class="topbar-title only-desktop"><span>${TITLES[route]}</span></div>`
      : `${sub ? `<button class="icon-btn back-btn" type="button" data-act="back" aria-label="뒤로">${ic('back', 22)}</button>` : ''}<div class="topbar-title"><span>${TITLES[route]}</span></div>`;
    $('#topbar').innerHTML = `${left}<div class="topbar-actions"><button class="search-trigger" type="button" data-act="search">${ic('search', 18)}<span>대회, 팀, 프로젝트 검색</span><kbd>/</kbd></button><button class="icon-btn only-mobile" type="button" data-act="search" aria-label="검색">${ic('search', 22)}</button><button class="icon-btn" type="button" data-act="notifications" aria-label="알림${hasAlert ? ' (3일 안에 일정 있음)' : ''}">${ic('bell', 22)}${hasAlert ? '<span class="dot"></span>' : ''}</button></div>`;
    document.body.classList.toggle('has-cta', route === 'competition' && !!findComp(routeId));
  }

  // ---------------------------------------------------------------- views: home
  function stat(icon, label, n, href, alert = false) { return `<a class="stat ${alert ? 'alert' : ''}" href="${href}"><span class="label">${ic(icon, 16)}${label}</span><span class="value">${n}<small>개</small></span></a>`; }
  function allEvents() {
    const ev = state.events.map(e => ({ ...e, kind: 'event' }));
    const dl = all().map(c => ({ id: c.id, title: c.title, date: c.applicationEndAt.slice(0, 10), time: endTime(c), description: '접수 마감', kind: 'deadline' }));
    const st = all().filter(c => c.applicationStartAt && status(c) === 'upcoming').map(c => ({ id: c.id, title: c.title, date: c.applicationStartAt.slice(0, 10), time: '', description: '접수 시작', kind: 'start' }));
    return [...ev, ...dl, ...st].sort((a, b) => a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || ''));
  }
  function dateChip(date) { const [, m, d] = ymd(date); return `<span class="date-chip"><small>${m}월</small><b>${d}</b></span>`; }
  function eventRow(e) {
    const isComp = e.kind !== 'event';
    const sub = `${e.time ? e.time + ' · ' : ''}${isComp ? e.description : esc(e.description || '동아리 일정')}`;
    const attrs = isComp ? `data-act="open-comp" data-id="${esc(e.id)}"` : `data-act="edit-event" data-id="${esc(e.id)}"`;
    return `<button class="row" type="button" ${attrs}>${dateChip(e.date)}<span class="grow"><span class="t ellipsis" style="display:block">${esc(e.title)}</span><span class="s ellipsis" style="display:block">${sub}</span></span>${isComp ? `<span class="badge ${e.kind === 'deadline' ? 'red' : 'blue'}">${e.kind === 'deadline' ? '마감' : '시작'}</span>` : ''}</button>`;
  }
  function teamRow(t) {
    return `<button class="row" type="button" data-act="team" data-id="${esc(t.id)}">${teamAvatar(t)}<span class="grow"><span class="t ellipsis" style="display:block">${esc(t.name)}</span><span class="s ellipsis" style="display:block">${esc(t.roles)} · ${t.members}/${t.capacity}명</span></span>${isExample(t) ? '<span class="badge line">예시</span>' : ''}${ic('chevronRight', 18)}</button>`;
  }
  function viewHome() {
    const name = state.profile.name || '부원';
    const open = openList().sort(byDeadline);
    const soon = open.filter(c => daysUntil(c.applicationEndAt) <= 7);
    const upcoming = all().filter(c => status(c) === 'upcoming').sort(byStart);
    const tasks = state.projects.reduce((n, p) => n + p.tasks.filter(t => t.status !== 'done').length, 0);
    const savedActive = state.saved.filter(id => { const c = findComp(id); return c && status(c) !== 'closed'; }).length;
    const headline = !catalogue.ready ? '대회 정보를 불러오고 있어요' : open.length ? `지금 접수 중인 대회가 <b>${open.length}개</b> 있어요` : '지금 접수 중인 대회가 없어요';
    let h = `<section class="hello"><div class="date">${esc(fmtToday())}</div><h1>${esc(name)}님, ${headline}</h1></section>`;
    h += catalogueNotice();
    h += `<div class="stats" style="margin-top:${catalogueNotice() ? '12px' : '0'}">${stat('trophy', '접수 중', open.length, '#competitions')}${stat('clock', '7일 안에 마감', soon.length, '#competitions', soon.length > 0)}${stat('bookmark', '관심 대회', savedActive, '#my')}${stat('check', '남은 할 일', tasks, '#projects')}</div>`;
    h += `<section class="section"><div class="section-head"><h2>마감이 가까운 대회</h2><a class="text-btn" href="#competitions">전체 보기${ic('chevronRight', 16)}</a></div>`;
    if (!catalogue.ready) h += catalogue.error ? '' : skeletonCards(3);
    else if (open.length) h += `<div class="hscroll">${open.slice(0, 6).map(compCard).join('')}</div>`;
    else h += `<div class="card">${empty('trophy', '접수 중인 대회가 없어요', '지난 대회에서 해마다 열리는 대회를 미리 살펴보세요.', '<a class="btn sm secondary" href="#archive">지난 대회 보기</a>')}</div>`;
    h += '</section>';
    if (upcoming.length) h += `<section class="section"><div class="section-head"><h2>곧 접수를 시작해요</h2></div><div class="list">${upcoming.slice(0, 4).map(c => `<a class="row" href="${compHref(c)}">${dateChip(c.applicationStartAt)}<span class="grow"><span class="t ellipsis" style="display:block">${esc(c.title)}</span><span class="s ellipsis" style="display:block">${esc(c.organizer)} · ${esc(modeLabel(c))}</span></span><span class="badge blue">${esc(dday(c))}</span></a>`).join('')}</div></section>`;
    h += `<section class="section"><div class="section-head"><h2>분야별로 보기</h2></div><div class="cat-grid">${CATS.map(cat => { const n = active().filter(c => c.tags.includes(cat.key)).length; return `<button class="cat-tile" type="button" data-act="go-cat" data-id="${esc(cat.key)}"><span class="ic tone-${cat.tone}">${ic(cat.icon, 22)}</span><span><b>${cat.label}</b><span>${catalogue.ready ? `${n}개` : '…'}</span></span></button>`; }).join('')}</div></section>`;
    const teams = state.teams.slice(0, 3);
    const events = allEvents().filter(e => e.date >= todayKey()).slice(0, 4);
    h += `<div class="split"><section class="section"><div class="section-head"><h2>팀원 모집</h2><a class="text-btn" href="#teams">더보기${ic('chevronRight', 16)}</a></div>${teams.length ? `<div class="list">${teams.map(teamRow).join('')}</div>` : `<div class="card">${empty('users', '모집 중인 팀이 없어요', '', '<button class="btn sm secondary" type="button" data-act="new-team">모집글 쓰기</button>')}</div>`}</section>`;
    h += `<section class="section"><div class="section-head"><h2>다가오는 일정</h2><a class="text-btn" href="#calendar">캘린더${ic('chevronRight', 16)}</a></div>${events.length ? `<div class="list">${events.map(eventRow).join('')}</div>` : `<div class="card">${empty('calendar', '다가오는 일정이 없어요', '', '<button class="btn sm secondary" type="button" data-act="new-event">일정 추가</button>')}</div>`}</section></div>`;
    return h;
  }

  // ---------------------------------------------------------------- views: competitions
  const F = { cat: '전체', st: 'all', sort: 'deadline', q: '', minister: false, mode: 'all' };
  const matchQ = c => !F.q || `${c.title} ${c.organizer} ${c.theme || ''} ${c.tags.join(' ')}`.toLowerCase().includes(F.q.toLowerCase());
  function viewCompetitions(archive) {
    const head = archive
      ? pageHead('지난 대회', '접수가 끝난 대회예요. 해마다 열리는 대회는 다음 일정을 미리 챙겨 두세요.')
      : pageHead('대회', '공식 공고에서 참가 자격과 일정을 확인한 대회만 모았어요.');
    let base = archive ? all().filter(c => status(c) === 'closed') : active();
    if (!archive && F.st !== 'all') base = base.filter(c => status(c) === F.st);
    const pre = base.filter(c => (!F.minister || c.hasMinisterAward) && (F.mode === 'all' || c.participation === F.mode || c.participation === 'both') && matchQ(c));
    const list = pre.filter(c => F.cat === '전체' || c.tags.includes(F.cat));
    if (archive) list.sort((a, b) => byDeadline(b, a));
    else if (F.sort === 'score') list.sort((a, b) => scoreNow(b) - scoreNow(a) || byDeadline(a, b));
    else if (F.sort === 'new') list.sort((a, b) => (b.applicationStartAt || '').localeCompare(a.applicationStartAt || ''));
    else list.sort((a, b) => { const sa = status(a), sb = status(b); if (sa !== sb) return sa === 'open' ? -1 : 1; return sa === 'upcoming' ? byStart(a, b) : byDeadline(a, b); });
    const chips = [['전체', '전체'], ...CATS.map(c => [c.key, c.label])].map(([k, l]) => { const n = k === '전체' ? pre.length : pre.filter(c => c.tags.includes(k)).length; return `<button class="chip" type="button" data-act="cat" data-id="${esc(k)}" aria-pressed="${F.cat === k}">${l}<span class="n">${n}</span></button>`; }).join('');
    let h = head + catalogueNotice();
    h += `<div class="toolbar" style="margin-top:${catalogueNotice() ? '12px' : '0'}"><div class="search-box">${ic('search', 18)}<input class="field" id="comp-q" type="search" placeholder="대회 이름, 주최 기관으로 검색" value="${esc(F.q)}" aria-label="대회 검색" autocomplete="off"></div><div class="chips" role="group" aria-label="분야">${chips}</div><div class="toolbar-row">`;
    if (!archive) h += `<div class="seg" role="group" aria-label="접수 상태">${[['all', '전체'], ['open', '접수 중'], ['upcoming', '접수 예정']].map(([k, l]) => `<button type="button" data-act="st" data-id="${k}" aria-pressed="${F.st === k}">${l}</button>`).join('')}</div>`;
    h += `<select class="select" id="comp-mode" aria-label="참가 형태"><option value="all" ${F.mode === 'all' ? 'selected' : ''}>개인·팀 모두</option><option value="individual" ${F.mode === 'individual' ? 'selected' : ''}>개인 참가 가능</option><option value="team" ${F.mode === 'team' ? 'selected' : ''}>팀 참가 가능</option></select>`;
    if (!archive) h += `<select class="select" id="comp-sort" aria-label="정렬"><option value="deadline" ${F.sort === 'deadline' ? 'selected' : ''}>마감 빠른 순</option><option value="score" ${F.sort === 'score' ? 'selected' : ''}>추천 순</option><option value="new" ${F.sort === 'new' ? 'selected' : ''}>최근 시작 순</option></select>`;
    h += `<label class="check"><input type="checkbox" id="comp-minister" ${F.minister ? 'checked' : ''}>장관상만</label><span class="spacer"></span><span class="result-count"><b>${catalogue.ready ? list.length : '-'}</b>개</span></div></div>`;
    if (!catalogue.ready) h += catalogue.error ? '' : skeletonRows(4);
    else if (list.length) h += `<div class="c-list">${list.map(compRow).join('')}</div>`;
    else h += `<div class="card">${empty('search', '조건에 맞는 대회가 없어요', '검색어나 필터를 바꿔 보세요.', '<button class="btn sm secondary" type="button" data-act="reset-filters">필터 초기화</button>')}</div>`;
    h += `<div style="text-align:center;margin-top:24px">${archive ? `<a class="btn outline" href="#competitions">접수 중인 대회 보기</a>` : `<a class="btn outline" href="#archive">${ic('archive', 18)}지난 대회 보기</a>`}</div>`;
    return h;
  }

  // ---------------------------------------------------------------- views: detail
  function dSection(title, body) { return body ? `<section class="d-section"><h2>${title}</h2>${body}</section>` : ''; }
  function kv(pairs) { const rows = pairs.filter(([, v]) => v); return rows.length ? `<dl class="kv">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}</dl>` : ''; }
  function viewDetail(id) {
    if (!catalogue.ready) return catalogue.error ? catalogueNotice() : '<div class="card pad"><div class="skel" style="height:24px;width:60%"></div><div class="skel" style="height:16px;width:40%;margin-top:12px"></div><div class="skel" style="height:120px;margin-top:20px"></div></div>';
    const c = findComp(id);
    if (!c) return `<div class="card">${empty('search', '대회를 찾을 수 없어요', '접수가 끝나 목록에서 빠졌거나 주소가 바뀌었을 수 있어요.', '<a class="btn sm secondary" href="#competitions">대회 목록으로</a>')}</div>`;
    const st = status(c), cat = subjectCat(c), src = posterSrc(c), saved = state.saved.includes(c.id);
    const t = endTime(c);
    const deadlineLine = `${fmtDay(c.applicationEndAt, true)}${t ? ' ' + t : ''} 마감${t ? '' : ' (시각 미공개)'}`;
    const linked = state.teams.filter(x => x.competition === c.id);
    let main = `<article class="card">`;
    main += src ? `<div class="detail-poster"><img src="${esc(src)}" alt="${esc(c.title)} 공식 포스터" decoding="async" referrerpolicy="no-referrer"></div>` : `<div class="detail-banner tone-${cat.tone}">${ic(cat.icon, 44)}</div>`;
    main += `<div class="detail-head">${compBadges(c)}<h1>${esc(c.title)}</h1><div class="org">${esc(c.organizer)}${c.host && c.host !== c.organizer ? ` · 주관 ${esc(c.host)}` : ''}</div></div>`;
    main += `<dl class="facts"><dt>접수 기간</dt><dd>${c.applicationStartAt ? esc(fmtDay(c.applicationStartAt, true)) + ' ~ ' : ''}${esc(fmtDay(c.applicationEndAt, true))}${t ? ' ' + t : ''}${t ? '' : '<span class="small muted">마감 시각이 공개되지 않았어요. 마감일 하루 종일 유효한 것으로 표시해요.</span>'}</dd><dt>참가 대상</dt><dd>${esc(c.eligibility)}</dd><dt>참가 형태</dt><dd>${esc(people(c))}</dd><dt>참가비</dt><dd>${esc(c.fee || '공식 공고에서 확인')}</dd><dt>분야</dt><dd>${esc(c.tags.map(k => catOf(k).label).join(' · '))}</dd></dl>`;
    main += dSection('대회 소개', (c.description ? `<p>${esc(c.description)}</p>` : '') + (c.theme ? `<p><b>주제</b> · ${esc(c.theme)}</p>` : ''));
    main += dSection('꼭 확인하세요', c.eligibilityNote ? `<p>${esc(c.eligibilityNote)}</p>` : '');
    main += dSection('제출과 심사', kv([['제출물', c.submission], ['심사', c.judging], ['문의', c.contact]]));
    main += dSection('시상', `<p>${esc(c.awards || '공식 공고에서 확인해 주세요.')}</p>${c.hasMinisterAward ? '<div class="note-box">공식 시상 문구에서 장관상 수여를 확인했어요.</div>' : ''}`);
    main += dSection('같이 준비할 팀', `${c.participation === 'individual' ? '<p class="small muted" style="margin-bottom:12px">개인 참가 대회예요. 같이 공부할 모임은 만들 수 있지만 공동 출품은 안 돼요.</p>' : ''}${linked.length ? `<div class="list" style="box-shadow:none;border:1px solid var(--line)">${linked.map(teamRow).join('')}</div>` : `<p class="small muted">아직 이 대회로 모집 중인 팀이 없어요.${st === 'closed' ? '' : ' 팀원 모집하기 버튼으로 첫 모집글을 올려 보세요.'}</p>`}`);
    main += dSection('출처와 확인 내역', kv([['확인 방법', c.verificationMethod], ['자격 근거', c.evidence?.eligibility], ['일정 근거', c.evidence?.dates], ['시상 근거', c.evidence?.awards], ['마지막 확인', fmtStamp(c.lastVerifiedAt)]]) + `<p class="small muted" style="margin-top:12px">${c.source === 'curated' ? '운영진이 공식 공고를 직접 확인해 추가한 대회예요.' : '자동 수집한 뒤 참가 자격·일정 규칙 검사를 통과한 대회예요.'} 정확한 내용은 공식 공고를 기준으로 해 주세요.</p>` + (src && c.posterCredit ? `<p class="small muted" style="margin-top:6px">포스터 · ${esc(c.posterCredit)}${c.posterLicenseUrl ? ` · <a href="${esc(safeLink(c.posterLicenseUrl))}" target="_blank" rel="noopener noreferrer" style="text-decoration:underline">${esc(c.posterLicense || '이용 조건')}</a>` : ''}</p>` : ''));
    main += `</article>`;
    const links = [c.applicationUrl && c.applicationUrl !== c.officialUrl ? ext(c.applicationUrl, '신청 페이지', 'btn outline block') : '', c.documentUrl ? ext(c.documentUrl, esc(c.documentLabel || '공식 요강'), 'btn outline block') : '', c.posterUrl ? ext(c.posterUrl, '공식 포스터 원본', 'btn outline block') : ''].filter(Boolean).join('');
    const recruit = cls => st === 'closed'
      ? `<button class="${cls}" type="button" disabled>${ic('users', 18)}접수가 끝나 모집할 수 없어요</button>`
      : `<button class="${cls}" type="button" data-act="new-team" data-id="${esc(c.id)}">${ic('users', 18)}팀원 모집하기${linked.length ? ` <span style="opacity:.75;font-weight:600">· ${linked.length}팀 모집 중</span>` : ''}</button>`;
    const side = `<aside class="side-card"><div class="card cta-card"><div class="small muted">${st === 'upcoming' ? '접수 시작까지' : st === 'closed' ? '접수 상태' : '접수 마감까지'}</div><div class="deadline-big ${st === 'open' && daysUntil(c.applicationEndAt) <= 7 ? 'red' : ''}">${esc(dday(c))}</div><div class="small muted">${esc(st === 'upcoming' ? fmtDay(c.applicationStartAt, true) + ' 시작 · ' + deadlineLine : deadlineLine)}</div><div style="display:flex;flex-direction:column;gap:8px;margin-top:16px">${ext(c.officialUrl, '공식 공고 보기', 'btn block')}<button class="btn outline block" type="button" data-act="bookmark" data-id="${esc(c.id)}" aria-pressed="${saved}">${ic('bookmark', 18, saved)}${saved ? '관심 대회에 저장됨' : '관심 대회로 저장'}</button>${recruit('btn tint block')}</div></div>${links ? `<div class="card" style="display:flex;flex-direction:column;gap:8px"><div class="small muted strong" style="margin-bottom:2px">관련 링크</div>${links}</div>` : ''}</aside>`;
    const bar = `<div class="cta-bar"><button class="btn outline icon-only" type="button" data-act="bookmark" data-id="${esc(c.id)}" aria-pressed="${saved}" aria-label="${saved ? '관심 대회에서 빼기' : '관심 대회로 저장'}">${ic('bookmark', 22, saved)}</button>${st === 'closed' ? '' : `<button class="btn tint" type="button" data-act="new-team" data-id="${esc(c.id)}">${ic('users', 18)}팀원 모집하기</button>`}${ext(c.officialUrl, '공식 공고', 'btn')}</div>`;
    return `<div class="detail">${main}${side}</div>${bar}`;
  }

  // ---------------------------------------------------------------- views: teams
  const TF = { cat: '전체', view: 'all' };
  function teamCard(t) {
    const comp = t.competition ? findComp(t.competition) : null;
    const applied = state.applications.some(a => a.teamId === t.id);
    const pct = Math.max(0, Math.min(100, Math.round(t.members / Math.max(1, t.capacity) * 100)));
    const tag = isExample(t) ? '<span class="badge line">예시</span>' : t.owner ? '<span class="badge brand">내 모집글</span>' : applied ? '<span class="badge blue">지원함</span>' : '';
    return `<article class="team-card"><div class="team-top">${teamAvatar(t)}<div class="grow" style="min-width:0"><div class="name ellipsis">${esc(t.name)}</div><div class="small muted ellipsis">${esc(catOf(t.category).label)}${comp ? ` · ${esc(comp.title)}` : ''}</div></div>${tag}</div><p class="team-desc clamp-2">${esc(t.description)}</p><div class="small muted">찾는 역할 · ${esc(t.roles)}</div><div class="meter" aria-hidden="true"><i style="width:${pct}%"></i></div><div class="team-foot"><span>${t.members}/${t.capacity}명 모였어요</span><button class="btn sm secondary" type="button" data-act="team" data-id="${esc(t.id)}">${t.owner ? '관리' : applied ? '지원 내용' : '자세히'}</button></div></article>`;
  }
  function viewTeams() {
    let list = state.teams.filter(t => TF.cat === '전체' || t.category === TF.cat);
    if (TF.view === 'mine') list = list.filter(t => t.owner);
    if (TF.view === 'applied') list = list.filter(t => state.applications.some(a => a.teamId === t.id));
    let h = pageHead('팀원 모집', '같이 대회에 나가거나 탐구할 팀원을 찾아요.', `<button class="btn" type="button" data-act="new-team">${ic('plus', 18)}모집글 쓰기</button>`);
    h += `<div class="local-note">${ic('lock', 14)}모집글과 지원 기록은 이 기기에만 저장돼요. 다른 부원에게 전송되지 않아요.</div>`;
    h += `<div class="toolbar"><div class="chips">${[['전체', '전체'], ...CATS.map(c => [c.key, c.label])].map(([k, l]) => `<button class="chip" type="button" data-act="team-cat" data-id="${esc(k)}" aria-pressed="${TF.cat === k}">${l}</button>`).join('')}</div><div class="toolbar-row"><div class="seg">${[['all', '전체'], ['mine', '내 모집글'], ['applied', '지원한 팀']].map(([k, l]) => `<button type="button" data-act="team-view" data-id="${k}" aria-pressed="${TF.view === k}">${l}</button>`).join('')}</div></div></div>`;
    h += list.length ? `<div class="team-grid">${list.map(teamCard).join('')}</div>` : `<div class="card">${empty('users', TF.view === 'mine' ? '아직 쓴 모집글이 없어요' : TF.view === 'applied' ? '지원한 팀이 없어요' : '모집 중인 팀이 없어요', '', '<button class="btn sm secondary" type="button" data-act="new-team">모집글 쓰기</button>')}</div>`;
    return h;
  }

  // ---------------------------------------------------------------- views: projects
  let selectedProject = 'p1';
  const COLS = [['todo', '할 일'], ['doing', '진행 중'], ['done', '완료']];
  function viewProjects() {
    const p = state.projects.find(x => x.id === selectedProject) || state.projects[0];
    let h = pageHead('프로젝트', '탐구와 대회 준비를 할 일 단위로 나눠 관리해요.', `<button class="btn" type="button" data-act="new-project">${ic('plus', 18)}새 프로젝트</button>`);
    h += `<div class="local-note">${ic('lock', 14)}이 기기에만 저장돼요.</div>`;
    if (!p) return h + `<div class="card">${empty('folder', '프로젝트가 없어요', '첫 프로젝트를 만들어 할 일을 정리해 보세요.', '<button class="btn sm secondary" type="button" data-act="new-project">프로젝트 만들기</button>')}</div>`;
    selectedProject = p.id;
    const done = p.tasks.filter(t => t.status === 'done').length, pct = p.tasks.length ? Math.round(done / p.tasks.length * 100) : 0;
    h += `<div class="chips" style="margin-bottom:16px">${state.projects.map(x => `<button class="chip" type="button" data-act="open-project" data-id="${esc(x.id)}" aria-pressed="${x.id === p.id}">${esc(x.name)}</button>`).join('')}</div>`;
    h += `<div class="card pad" style="margin-bottom:12px"><div style="display:flex;align-items:flex-start;gap:12px"><div class="grow" style="min-width:0"><h2 style="font-size:20px;font-weight:800">${esc(p.name)}</h2><p class="muted" style="margin-top:4px">${esc(p.description || '')}</p></div><button class="icon-btn" type="button" data-act="delete-project" data-id="${esc(p.id)}" aria-label="프로젝트 삭제">${ic('trash', 20)}</button></div><div class="progress-line" style="margin:14px 0 0"><div class="meter"><i style="width:${pct}%"></i></div><span>${done}/${p.tasks.length} 완료 · ${pct}%</span></div></div>`;
    h += `<div class="board">${COLS.map(([k, l]) => { const ts = p.tasks.filter(t => t.status === k); return `<section class="col" aria-label="${l}"><div class="col-head"><span>${l}<span class="n">${ts.length}</span></span></div>${ts.map(t => `<button class="task ${k === 'done' ? 'done' : ''}" type="button" data-act="edit-task" data-id="${esc(t.id)}"><span class="badges"><span class="badge">${esc(t.tag || '할 일')}</span></span><span class="tt">${esc(t.title)}</span>${t.description ? `<span class="td clamp-2">${esc(t.description)}</span>` : ''}<span class="tf"><span>${esc(t.assignee || '')}</span></span></button>`).join('')}<button class="add-task" type="button" data-act="new-task" data-id="${k}">+ 추가</button></section>`; }).join('')}</div>`;
    return h;
  }

  // ---------------------------------------------------------------- views: calendar
  let calMonth = todayKey().slice(0, 7); // YYYY-MM
  let selDay = todayKey();
  function viewCalendar() {
    const [y, m] = calMonth.split('-').map(Number);
    const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const evs = allEvents();
    const byDay = new Map();
    for (const e of evs) { if (!byDay.has(e.date)) byDay.set(e.date, []); byDay.get(e.date).push(e); }
    const cells = [];
    for (let i = 0; i < first; i++) cells.push('<span></span>');
    for (let d = 1; d <= last; d++) {
      const key = `${calMonth}-${String(d).padStart(2, '0')}`;
      const list = byDay.get(key) || [];
      const hasComp = list.some(e => e.kind !== 'event'), hasEv = list.some(e => e.kind === 'event');
      cells.push(`<button class="day ${key === todayKey() ? 'today' : ''} ${key === selDay ? 'sel' : ''}" type="button" data-act="day" data-id="${key}" aria-label="${m}월 ${d}일${list.length ? `, 일정 ${list.length}개` : ''}" aria-pressed="${key === selDay}"><span class="n">${d}</span><span class="dots">${hasEv ? '<i></i>' : ''}${hasComp ? '<i class="c"></i>' : ''}</span></button>`);
    }
    const dayList = byDay.get(selDay) || [];
    let h = pageHead('캘린더', '동아리 일정과 대회 접수 일정을 같이 봐요.', `<button class="btn" type="button" data-act="new-event">${ic('plus', 18)}일정 추가</button>`);
    h += `<div class="cal"><div class="card"><div class="cal-head"><h2>${y}년 ${m}월</h2><div style="display:flex;gap:4px"><button class="icon-btn" type="button" data-act="month" data-id="-1" aria-label="이전 달">${ic('chevronLeft', 20)}</button><button class="btn sm ghost" type="button" data-act="month" data-id="0">오늘</button><button class="icon-btn" type="button" data-act="month" data-id="1" aria-label="다음 달">${ic('chevronRight', 20)}</button></div></div><div class="cal-grid">${WD.map((w, i) => `<span class="wd ${i === 0 ? 'sun' : ''}">${w}</span>`).join('')}${cells.join('')}</div><div class="small muted" style="display:flex;gap:14px;padding:0 16px 16px"><span style="display:inline-flex;align-items:center;gap:6px"><i style="width:7px;height:7px;border-radius:50%;background:var(--brand)"></i>동아리 일정</span><span style="display:inline-flex;align-items:center;gap:6px"><i style="width:7px;height:7px;border-radius:50%;background:var(--red)"></i>대회 접수</span></div></div>`;
    h += `<div><div class="section-head" style="margin-top:4px"><h2>${esc(fmtDay(selDay))}</h2></div>${dayList.length ? `<div class="list">${dayList.map(eventRow).join('')}</div>` : `<div class="card">${empty('calendar', '이날은 일정이 없어요', '', `<button class="btn sm secondary" type="button" data-act="new-event" data-id="${selDay}">이날 일정 추가</button>`)}</div>`}<p class="local-note" style="margin-top:12px">${ic('lock', 14)}직접 추가한 일정은 이 기기에만 저장돼요.</p></div></div>`;
    return h;
  }

  // ---------------------------------------------------------------- views: my
  function themePref() { try { const t = localStorage.getItem('scivill.theme'); return t === 'light' || t === 'dark' ? t : 'system'; } catch { return 'system'; } }
  function viewMy() {
    const saved = state.saved.map(findComp).filter(Boolean).sort((a, b) => (status(a) === 'closed') - (status(b) === 'closed') || byDeadline(a, b));
    const applied = state.teams.filter(t => state.applications.some(a => a.teamId === t.id));
    const pref = themePref();
    let h = `<div class="card profile-card" style="margin-top:8px"><span class="avatar">${esc((state.profile.name || '나').slice(0, 1))}</span><div class="grow" style="min-width:0"><b class="ellipsis">${esc(state.profile.name)}</b><span class="muted small">${esc(state.profile.interest || '관심 분야를 적어 주세요')}</span></div><button class="btn sm secondary" type="button" data-act="profile">수정</button></div>`;
    h += `<section class="section"><div class="section-head"><h2>관심 대회 <span class="muted" style="font-weight:600">${saved.length}</span></h2></div>${saved.length ? `<div class="c-list">${saved.map(compRow).join('')}</div>` : `<div class="card">${empty('bookmark', '저장한 대회가 없어요', '대회 목록에서 책갈피 버튼을 눌러 저장해 보세요.', '<a class="btn sm secondary" href="#competitions">대회 보러 가기</a>')}</div>`}</section>`;
    h += `<section class="section"><div class="section-head"><h2>지원한 팀 <span class="muted" style="font-weight:600">${applied.length}</span></h2></div>${applied.length ? `<div class="list">${applied.map(teamRow).join('')}</div>` : '<div class="card pad muted small">아직 지원한 팀이 없어요.</div>'}</section>`;
    h += `<section class="section"><div class="section-head"><h2>바로가기</h2></div><div class="list menu-list">${[['#projects', 'folder', '내 프로젝트', `${state.projects.length}개`], ['#archive', 'archive', '지난 대회', ''], ['#monitor', 'activity', '대회 수집 현황', '']].map(([href, i, l, e]) => `<a class="row" href="${href}">${ic(i, 20)}<span class="grow t">${l}</span><span class="end">${e}</span><span class="chev">${ic('chevronRight', 18)}</span></a>`).join('')}<button class="row" type="button" data-act="about">${ic('info', 20)}<span class="grow t">이용 안내</span><span class="chev">${ic('chevronRight', 18)}</span></button></div></section>`;
    h += `<section class="section"><div class="section-head"><h2>화면</h2></div><div class="card pad" style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap"><span class="strong">테마</span><div class="seg" role="group" aria-label="테마">${[['system', '시스템'], ['light', '라이트'], ['dark', '다크']].map(([k, l]) => `<button type="button" data-act="theme" data-id="${k}" aria-pressed="${pref === k}">${l}</button>`).join('')}</div></div></section>`;
    h += `<p class="footer-note">SCIVILL · 싸이빌 동아리 플랫폼</p>`;
    return h;
  }

  // ---------------------------------------------------------------- views: monitor
  function viewMonitor() {
    const auto = ops.automation || {}, job = ops.job || {}, sources = Array.isArray(ops.sources) ? ops.sources : [];
    const jobLabel = { success: '정상 완료', partial: '일부 출처 실패', failed: '실패', running: '진행 중' }[job.status] || '기록 없음';
    let h = pageHead('대회 수집 현황', '대회 정보가 어디서, 언제 들어왔는지 그대로 보여 드려요.', ext('https://github.com/hsjun519/SCIVILL/actions/workflows/cyvil-daily.yml', 'GitHub 실행 기록', 'btn outline'));
    const sumRow = (label, value, sub) => `<div class="row"><span class="grow t">${label}</span><span class="end">${esc(value)}${sub ? `<small>${esc(sub)}</small>` : ''}</span></div>`;
    h += `<div class="list summary-list">${sumRow('자동 수집', auto.state === 'active' ? '매일 오전 8시' : '확인 대기', ops.nextSchedule ? '' : 'GitHub 사정으로 늦어질 수 있어요')}${sumRow('마지막 실행', jobLabel, fmtStamp(job.completedAt || job.startedAt))}${sumRow('등록된 대회', `${all().length}개`, `자동 수집 ${catalogue.serverCount} · 운영진 확인 ${catalogue.curatedCount} · 마감 포함`)}</div>`;
    h += `<section class="section"><div class="section-head"><div><h2>수집 출처</h2><div class="sub">허용된 공식 사이트에서 제목·기관·기간·링크 같은 사실 정보만 가져와요.</div></div></div>${sources.length ? `<div class="list">${sources.map(s => { const b = !s.enabled ? '<span class="badge">중지</span>' : s.state === 'success' ? '<span class="badge green">정상</span>' : s.state === 'failed' ? '<span class="badge red">실패</span>' : '<span class="badge">대기</span>'; return `<div class="row"><span class="grow"><span class="t" style="display:block">${esc(s.name)}</span><span class="s" style="display:block">${s.lastSuccessAt ? '마지막 성공 ' + esc(fmtStamp(s.lastSuccessAt)) : s.enabled ? '아직 성공 기록이 없어요' : '정기 수집을 쉬고 있어요'}${s.state === 'failed' && s.lastFailure ? ' · 최근 실패' : ''}</span></span>${b}</div>`; }).join('')}</div>` : `<div class="card pad muted small">${catalogue.ready ? '출처 정보를 받지 못했어요.' : '불러오는 중이에요.'}</div>`}</section>`;
    h += `<section class="section"><div class="section-head"><div><h2>운영진이 직접 확인한 대회</h2><div class="sub">자동 수집 출처에 없는 대회는 운영진이 공식 공고를 확인해 저장소의 platform/curated.json에 추가해요.</div></div></div><div class="card pad small" style="color:var(--text-2)">${catalogue.curatedCount}개 · 마지막 갱신 ${esc(fmtStamp(catalogue.curatedUpdatedAt))}</div></section>`;
    return h;
  }

  // ---------------------------------------------------------------- render
  function render(scrollTop = true) {
    renderChrome();
    const views = { home: viewHome, competitions: () => viewCompetitions(false), archive: () => viewCompetitions(true), competition: () => viewDetail(routeId), teams: viewTeams, projects: viewProjects, calendar: viewCalendar, my: viewMy, monitor: viewMonitor };
    $('#main').innerHTML = (views[route] || viewHome)();
    const c = route === 'competition' ? findComp(routeId) : null;
    document.title = `${c ? c.title : TITLES[route]} · SCIVILL`;
    if (scrollTop) window.scrollTo(0, 0);
  }
  function renderKeepingInput(id) {
    const el = document.getElementById(id); const pos = el?.selectionStart;
    render(false);
    const next = document.getElementById(id);
    if (next) { next.focus(); try { next.setSelectionRange(pos, pos); } catch { /* ignore */ } }
  }

  // ---------------------------------------------------------------- sheet / toast
  const sheetEl = () => $('#sheet');
  function openSheet(title, sub, body) {
    $('#sheet-body').innerHTML = `<div class="sheet-head"><div><h2 id="sheet-title">${title}</h2>${sub ? `<p>${sub}</p>` : ''}</div><button class="icon-btn" type="button" data-act="close" aria-label="닫기">${ic('x', 22)}</button></div>${body}`;
    if (!sheetEl().open) sheetEl().showModal();
    const first = $('#sheet-body input:not([type=hidden]), #sheet-body textarea, #sheet-body select');
    if (first && matchMedia('(pointer: fine)').matches) first.focus();
  }
  const closeSheet = () => { if (sheetEl().open) sheetEl().close(); };
  function toast(msg) { const t = $('#toast'); clearTimeout(toast.timer); t.textContent = msg; t.classList.add('show'); toast.timer = setTimeout(() => t.classList.remove('show'), 2600); }
  const field = (name, label, value = '', type = 'text', extra = '') => `<div><label for="f-${name}">${label}</label><input class="field" id="f-${name}" name="${name}" type="${type}" value="${esc(value)}" ${extra}></div>`;
  const area = (name, label, value = '', extra = '') => `<div><label for="f-${name}">${label}</label><textarea class="field" id="f-${name}" name="${name}" ${extra}>${esc(value)}</textarea></div>`;
  const select = (name, label, options, value) => `<div><label for="f-${name}">${label}</label><select class="field" id="f-${name}" name="${name}">${options.map(([v, l]) => `<option value="${esc(v)}" ${value === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></div>`;
  const foot = (label = '저장', extra = '') => `<div class="sheet-foot">${extra}<button class="btn secondary" type="button" data-act="close">취소</button><button class="btn" type="submit">${label}</button></div>`;
  const catOptions = CATS.map(c => [c.key, c.label]);

  function teamForm(compId = '', editId = '') {
    const t = state.teams.find(x => x.id === editId && x.owner);
    const comps = active().sort(byDeadline);
    const opts = [['', '대회 없이 모집'], ...comps.map(c => [c.id, c.title])];
    if (t?.competition && !comps.some(c => c.id === t.competition)) { const old = findComp(t.competition); if (old) opts.push([old.id, `${old.title} (마감)`]); }
    const pre = compId ? findComp(compId) : null;
    openSheet(t ? '모집글 수정' : '팀원 모집글 쓰기', '이 기기에만 저장돼요.', `<form class="form" id="team-form" data-id="${esc(t?.id || '')}">${field('name', '팀 이름', t?.name || '', 'text', 'required maxlength="40" placeholder="예: 교실 에너지 절약 팀"')}${select('competition', '함께 나갈 대회', opts, t?.competition ?? (pre?.id || ''))}<div class="form-row">${select('category', '분야', catOptions, t?.category || (pre ? subjectCat(pre).key : '기타·환경'))}${field('capacity', '모집 인원(나 포함)', t?.capacity || 4, 'number', 'required min="2" max="15"')}</div>${area('description', '소개', t?.description || '', 'required maxlength="300" placeholder="무엇을 만들거나 탐구하는지, 어떤 사람을 찾는지 적어 주세요."')}${field('roles', '찾는 역할', t?.roles || '', 'text', 'required maxlength="60" placeholder="예: 파이썬, 발표 자료, 3D 모델링"')}${foot(t ? '저장' : '올리기')}</form>`);
  }
  function teamDetail(id) {
    const t = state.teams.find(x => x.id === id); if (!t) return;
    const comp = t.competition ? findComp(t.competition) : null;
    const app = state.applications.find(a => a.teamId === id);
    const compClosed = comp && status(comp) === 'closed';
    let body = `<div class="badges" style="margin-bottom:12px"><span class="badge line">${esc(catOf(t.category).label)}</span>${isExample(t) ? '<span class="badge line">예시</span>' : ''}${t.owner ? '<span class="badge brand">내 모집글</span>' : ''}</div><p style="color:var(--text-2);line-height:1.65">${esc(t.description)}</p><dl class="kv" style="margin-top:16px"><dt>찾는 역할</dt><dd>${esc(t.roles)}</dd><dt>인원</dt><dd>${t.members}/${t.capacity}명</dd>${comp ? `<dt>대회</dt><dd><a href="${compHref(comp)}" data-act="close-nav" style="text-decoration:underline">${esc(comp.title)}</a>${compClosed ? ' (접수 마감)' : ''}</dd>` : ''}</dl>`;
    if (app) body += `<div class="note-box"><b>내 지원 내용</b><br>${esc(app.message)}<br><span class="small muted">${esc(fmtDay(app.date, true))}</span></div>`;
    if (isExample(t)) body += '<div class="note-box">처음 둘러볼 수 있게 넣어 둔 예시 모집글이에요.</div>';
    let actions;
    if (t.owner) actions = `<div class="sheet-foot"><button class="btn danger" type="button" data-act="delete-team" data-id="${esc(t.id)}">삭제</button><button class="btn" type="button" data-act="edit-team" data-id="${esc(t.id)}">수정</button></div>`;
    else if (app) actions = `<div class="sheet-foot"><button class="btn secondary" type="button" data-act="cancel-application" data-id="${esc(t.id)}">지원 취소</button><button class="btn" type="button" data-act="apply" data-id="${esc(t.id)}">지원 내용 수정</button></div>`;
    else actions = `<div class="sheet-foot"><button class="btn" type="button" data-act="apply" data-id="${esc(t.id)}" ${compClosed ? 'disabled' : ''}>${compClosed ? '대회 접수가 끝났어요' : '지원하기'}</button></div><p class="small muted" style="margin-top:10px">지원 기록은 이 기기에만 저장되고, 팀장에게 전송되지는 않아요.</p>`;
    openSheet(esc(t.name), '', body + actions);
  }
  function applyForm(id) {
    const t = state.teams.find(x => x.id === id); if (!t) return;
    const a = state.applications.find(x => x.teamId === id);
    openSheet('지원하기', esc(t.name), `<form class="form" id="apply-form" data-id="${esc(id)}">${area('message', '자기소개와 맡고 싶은 역할', a?.message || '', 'required maxlength="400" placeholder="할 수 있는 것, 관심 있는 주제를 적어 주세요."')}${foot('저장')}</form>`);
  }
  function projectForm() { openSheet('새 프로젝트', '', `<form class="form" id="project-form">${field('name', '프로젝트 이름', '', 'text', 'required maxlength="50" placeholder="예: 미세먼지 측정 탐구"')}${area('description', '설명', '', 'maxlength="200" placeholder="무엇을 알아보거나 만드는지 짧게 적어 주세요."')}${foot('만들기')}</form>`); }
  function taskForm(statusKey = 'todo', editId = '') {
    const p = state.projects.find(x => x.id === selectedProject); if (!p) return;
    const t = p.tasks.find(x => x.id === editId);
    openSheet(t ? '할 일 수정' : '할 일 추가', esc(p.name), `<form class="form" id="task-form" data-id="${esc(t?.id || '')}">${field('title', '할 일', t?.title || '', 'text', 'required maxlength="60"')}${area('description', '메모', t?.description || '', 'maxlength="200"')}<div class="form-row">${select('status', '상태', COLS.map(([k, l]) => [k, l]), t?.status || statusKey)}${field('tag', '분류', t?.tag || '', 'text', 'maxlength="12" placeholder="예: 실험"')}</div>${field('assignee', '담당', t?.assignee || '나', 'text', 'maxlength="15"')}${foot('저장', t ? `<button class="btn danger" type="button" data-act="delete-task" data-id="${esc(t.id)}">삭제</button>` : '')}</form>`);
  }
  function eventForm(id = '', date = '') {
    const e = state.events.find(x => x.id === id);
    openSheet(e ? '일정 수정' : '일정 추가', '', `<form class="form" id="event-form" data-id="${esc(e?.id || '')}">${field('title', '일정 이름', e?.title || '', 'text', 'required maxlength="60" placeholder="예: 동아리 정기 모임"')}<div class="form-row">${field('date', '날짜', e?.date || date || selDay, 'date', 'required')}${field('time', '시간', e?.time || '', 'time')}</div>${field('description', '장소·메모', e?.description || '', 'text', 'maxlength="80"')}${foot('저장', e ? `<button class="btn danger" type="button" data-act="delete-event" data-id="${esc(e.id)}">삭제</button>` : '')}</form>`);
  }
  function profileForm() { openSheet('프로필', '이 기기에만 저장돼요.', `<form class="form" id="profile-form">${field('name', '이름', state.profile.name, 'text', 'required maxlength="15"')}${field('interest', '관심 분야', state.profile.interest, 'text', 'maxlength="60" placeholder="예: 로봇, 데이터 분석"')}${foot('저장')}</form>`); }
  function confirmSheet(title, desc, act, id) { openSheet(title, '', `<p style="color:var(--text-2)">${desc}</p><div class="sheet-foot"><button class="btn secondary" type="button" data-act="close">취소</button><button class="btn danger" type="button" data-act="${act}" data-id="${esc(id)}">삭제</button></div>`); }

  function searchSheet() {
    openSheet('검색', '', `<div class="search-box">${ic('search', 18)}<input class="field" id="global-q" type="search" placeholder="대회, 팀, 프로젝트, 일정" aria-label="전체 검색" autocomplete="off"></div><div class="search-results" id="global-results"><p class="small muted">검색어를 입력하세요.</p></div>`);
    $('#global-q').focus();
  }
  function searchResults(q) {
    const box = $('#global-results'); if (!box) return;
    const s = q.trim().toLowerCase();
    if (!s) { box.innerHTML = '<p class="small muted">검색어를 입력하세요.</p>'; return; }
    const groups = [
      ['대회', all().filter(c => `${c.title} ${c.organizer}`.toLowerCase().includes(s)).slice(0, 6).map(c => `<a class="row" href="${compHref(c)}" data-act="close-nav">${ic('trophy', 18)}<span class="grow ellipsis t">${esc(c.title)}</span>${statusBadge(c)}</a>`)],
      ['팀', state.teams.filter(t => `${t.name} ${t.roles}`.toLowerCase().includes(s)).slice(0, 4).map(t => `<button class="row" type="button" data-act="team" data-id="${esc(t.id)}">${ic('users', 18)}<span class="grow ellipsis t">${esc(t.name)}</span></button>`)],
      ['프로젝트', state.projects.filter(p => p.name.toLowerCase().includes(s)).slice(0, 4).map(p => `<button class="row" type="button" data-act="open-project-nav" data-id="${esc(p.id)}">${ic('folder', 18)}<span class="grow ellipsis t">${esc(p.name)}</span></button>`)],
      ['일정', state.events.filter(e => e.title.toLowerCase().includes(s)).slice(0, 4).map(e => `<button class="row" type="button" data-act="edit-event" data-id="${esc(e.id)}">${ic('calendar', 18)}<span class="grow ellipsis t">${esc(e.title)}</span><span class="end">${esc(fmtDay(e.date))}</span></button>`)]
    ].filter(([, rows]) => rows.length);
    box.innerHTML = groups.length ? groups.map(([g, rows]) => `<div><h3>${g}</h3>${rows.join('')}</div>`).join('') : '<p class="small muted">찾는 결과가 없어요.</p>';
  }
  function notificationsSheet() {
    const t = todayKey();
    const soonSaved = state.saved.map(findComp).filter(c => c && status(c) === 'open' && daysUntil(c.applicationEndAt) <= 14).sort(byDeadline);
    const evs = allEvents().filter(e => e.kind === 'event' && e.date >= t && daysUntil(e.date) <= 14);
    const starts = all().filter(c => status(c) === 'upcoming' && daysUntil(c.applicationStartAt) <= 14).sort(byStart);
    let body = '';
    if (soonSaved.length) body += `<div class="search-results"><div><h3>관심 대회 마감</h3>${soonSaved.map(c => `<a class="row" href="${compHref(c)}" data-act="close-nav">${statusBadge(c)}<span class="grow ellipsis t">${esc(c.title)}</span></a>`).join('')}</div></div>`;
    if (starts.length) body += `<div class="search-results"><div><h3>곧 접수 시작</h3>${starts.map(c => `<a class="row" href="${compHref(c)}" data-act="close-nav">${statusBadge(c)}<span class="grow ellipsis t">${esc(c.title)}</span></a>`).join('')}</div></div>`;
    if (evs.length) body += `<div class="search-results"><div><h3>동아리 일정</h3>${evs.map(e => `<button class="row" type="button" data-act="edit-event" data-id="${esc(e.id)}"><span class="badge">${esc(daysUntil(e.date) === 0 ? '오늘' : `${daysUntil(e.date)}일 후`)}</span><span class="grow ellipsis t">${esc(e.title)}</span></button>`).join('')}</div></div>`;
    openSheet('알림', '앞으로 2주 안의 일정이에요.', body || empty('bell', '2주 안에 챙길 일정이 없어요', '관심 대회를 저장하면 마감이 다가올 때 여기에 보여요.'));
  }
  function aboutSheet() {
    openSheet('이용 안내', '', `<div class="d-section" style="padding:0;border:0"><h2>대회 정보</h2><p>두 곳에서 모아요. 매일 오전 8시 자동 수집 프로그램이 허용된 공식 사이트에서 후보를 찾고, 참가 자격과 일정 근거가 있는 대회만 올려요. 자동 수집 출처에 없는 대회는 운영진이 공식 공고를 직접 확인해 추가해요.</p><p>신청 전에는 꼭 공식 공고를 다시 확인해 주세요.</p></div><div class="d-section" style="padding:16px 0 0;margin-top:16px"><h2>팀·프로젝트·일정</h2><p>지금은 이 기기의 브라우저에만 저장돼요. 다른 부원과 공유되거나 팀장에게 지원서가 전송되지는 않아요.</p></div><div class="sheet-foot"><a class="btn secondary" href="#monitor" data-act="close-nav">수집 현황 보기</a><button class="btn" type="button" data-act="close">확인</button></div>`);
  }

  // ---------------------------------------------------------------- theme
  function applyTheme(pref) {
    try { if (pref === 'system') localStorage.removeItem('scivill.theme'); else localStorage.setItem('scivill.theme', pref); } catch { /* ignore */ }
    const t = pref === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : pref;
    document.documentElement.dataset.theme = t;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = t === 'dark' ? '#0F1114' : '#F2F4F6';
    render(false);
  }
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => { if (themePref() === 'system') applyTheme('system'); });

  // ---------------------------------------------------------------- actions
  const A = {
    close: closeSheet,
    skip: (id, el, e) => { e.preventDefault(); $('#main').focus(); },
    'close-nav': () => closeSheet(),
    back: () => { if (history.length > 1) history.back(); else location.hash = route === 'competition' ? 'competitions' : 'home'; },
    reload: () => { catalogue.loading = true; render(false); loadCatalogue(); },
    search: searchSheet,
    notifications: notificationsSheet,
    about: aboutSheet,
    profile: profileForm,
    'toggle-theme': () => applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'),
    theme: id => applyTheme(id),
    bookmark: id => {
      const on = state.saved.includes(id);
      state.saved = on ? state.saved.filter(x => x !== id) : [...state.saved, id];
      persist(); render(false);
      toast(on ? '관심 대회에서 뺐어요.' : '관심 대회에 저장했어요.');
    },
    'open-comp': id => { closeSheet(); location.hash = `competition/${encodeURIComponent(id)}`; },
    'go-cat': id => { F.cat = id; F.st = 'all'; F.q = ''; if (route === 'competitions') render(false); else location.hash = 'competitions'; },
    cat: id => { F.cat = id; render(false); },
    st: id => { F.st = id; render(false); },
    'reset-filters': () => { Object.assign(F, { cat: '전체', st: 'all', sort: 'deadline', q: '', minister: false, mode: 'all' }); render(false); },
    'team-cat': id => { TF.cat = id; render(false); },
    'team-view': id => { TF.view = id; render(false); },
    'new-team': id => teamForm(id || ''),
    'edit-team': id => teamForm('', id),
    team: teamDetail,
    apply: id => {
      const t = state.teams.find(x => x.id === id), c = t?.competition ? findComp(t.competition) : null;
      if (c && status(c) === 'closed') { toast('대회 접수가 끝나서 새로 지원할 수 없어요.'); return; }
      applyForm(id);
    },
    'cancel-application': id => { state.applications = state.applications.filter(a => a.teamId !== id); persist(); render(false); teamDetail(id); toast('지원 기록을 지웠어요.'); },
    'delete-team': id => confirmSheet('모집글을 삭제할까요?', '삭제하면 되돌릴 수 없어요.', 'confirm-delete-team', id),
    'confirm-delete-team': id => { state.teams = state.teams.filter(t => t.id !== id || !t.owner); state.applications = state.applications.filter(a => a.teamId !== id); persist(); closeSheet(); render(false); toast('모집글을 삭제했어요.'); },
    'new-project': projectForm,
    'open-project': id => { selectedProject = id; if (route === 'projects') { history.replaceState(null, '', `#projects/${encodeURIComponent(id)}`); render(false); } else location.hash = `projects/${encodeURIComponent(id)}`; },
    'open-project-nav': id => { closeSheet(); selectedProject = id; location.hash = `projects/${encodeURIComponent(id)}`; },
    'delete-project': id => confirmSheet('프로젝트를 삭제할까요?', '할 일도 함께 지워지고 되돌릴 수 없어요.', 'confirm-delete-project', id),
    'confirm-delete-project': id => { state.projects = state.projects.filter(p => p.id !== id); selectedProject = state.projects[0]?.id || ''; persist(); closeSheet(); if (route === 'projects') history.replaceState(null, '', '#projects'); render(false); toast('프로젝트를 삭제했어요.'); },
    'new-task': id => taskForm(id || 'todo'),
    'edit-task': id => taskForm('todo', id),
    'delete-task': id => confirmSheet('할 일을 삭제할까요?', '되돌릴 수 없어요.', 'confirm-delete-task', id),
    'confirm-delete-task': id => { const p = state.projects.find(x => x.id === selectedProject); if (p) p.tasks = p.tasks.filter(t => t.id !== id); persist(); closeSheet(); render(false); toast('할 일을 삭제했어요.'); },
    'new-event': id => eventForm('', id || ''),
    'edit-event': id => { if (state.events.some(e => e.id === id)) eventForm(id); },
    'delete-event': id => confirmSheet('일정을 삭제할까요?', '되돌릴 수 없어요.', 'confirm-delete-event', id),
    'confirm-delete-event': id => { state.events = state.events.filter(e => e.id !== id); persist(); closeSheet(); render(false); toast('일정을 삭제했어요.'); },
    month: id => { const d = +id; if (d === 0) { calMonth = todayKey().slice(0, 7); selDay = todayKey(); } else { const [y, m] = calMonth.split('-').map(Number); const n = new Date(Date.UTC(y, m - 1 + d, 1)); calMonth = n.toISOString().slice(0, 7); } render(false); },
    day: id => { selDay = id; if (route !== 'calendar') location.hash = 'calendar'; else render(false); }
  };
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const fn = A[el.dataset.act];
    if (!fn) return;
    if (el.tagName !== 'A') e.preventDefault();
    fn(el.dataset.id, el, e);
  });
  sheetEl().addEventListener('click', e => { if (e.target === sheetEl()) closeSheet(); });

  function onInput(e) {
    if (e.isComposing) return;
    if (e.target.id === 'comp-q') { F.q = e.target.value; renderKeepingInput('comp-q'); }
    if (e.target.id === 'global-q') searchResults(e.target.value);
  }
  document.addEventListener('input', onInput);
  document.addEventListener('compositionend', onInput);
  document.addEventListener('change', e => {
    const id = e.target.id;
    if (id === 'comp-sort') F.sort = e.target.value;
    else if (id === 'comp-mode') F.mode = e.target.value;
    else if (id === 'comp-minister') F.minister = e.target.checked;
    else return;
    render(false);
  });
  document.addEventListener('submit', e => {
    const f = e.target;
    if (!f.id || !f.id.endsWith('-form')) return;
    e.preventDefault();
    const v = Object.fromEntries(new FormData(f));
    for (const [k, s] of Object.entries(v)) if (typeof s === 'string') v[k] = s.trim();
    const missing = [...f.elements].find(el => el.required && !String(el.value).trim());
    if (missing) { missing.focus(); toast('필수 항목을 채워 주세요.'); return; }
    if (f.id === 'profile-form') { state.profile = { name: v.name, interest: v.interest }; toast('프로필을 저장했어요.'); }
    if (f.id === 'team-form') {
      const old = state.teams.find(t => t.id === f.dataset.id);
      const cap = Math.max(2, Math.min(15, parseInt(v.capacity, 10) || 4));
      const c = v.competition ? findComp(v.competition) : null;
      if (!old && c && status(c) === 'closed') { toast('접수가 끝난 대회로는 모집할 수 없어요.'); return; }
      const t = { ...(old || { id: uid('t'), members: 1, owner: true }), name: v.name, competition: v.competition, category: v.category, description: v.description, roles: v.roles, capacity: cap };
      t.members = Math.min(t.members, cap);
      state.teams = old ? state.teams.map(x => x.id === t.id ? t : x) : [t, ...state.teams];
      toast(old ? '모집글을 고쳤어요.' : '모집글을 올렸어요.');
    }
    if (f.id === 'apply-form') { state.applications = state.applications.filter(a => a.teamId !== f.dataset.id); state.applications.push({ teamId: f.dataset.id, message: v.message, date: todayKey() }); toast('지원 내용을 저장했어요.'); }
    if (f.id === 'project-form') { const p = { id: uid('p'), name: v.name, description: v.description, tasks: [] }; state.projects.push(p); selectedProject = p.id; persist(); closeSheet(); location.hash = `projects/${encodeURIComponent(p.id)}`; toast('프로젝트를 만들었어요.'); return; }
    if (f.id === 'task-form') {
      const p = state.projects.find(x => x.id === selectedProject); if (!p) return;
      const t = { id: f.dataset.id || uid('k'), title: v.title, description: v.description, status: ['todo', 'doing', 'done'].includes(v.status) ? v.status : 'todo', tag: v.tag, assignee: v.assignee };
      p.tasks = p.tasks.some(x => x.id === t.id) ? p.tasks.map(x => x.id === t.id ? t : x) : [...p.tasks, t];
      toast('할 일을 저장했어요.');
    }
    if (f.id === 'event-form') {
      const ev = { id: f.dataset.id || uid('e'), title: v.title, date: v.date, time: v.time, description: v.description };
      state.events = state.events.some(x => x.id === ev.id) ? state.events.map(x => x.id === ev.id ? ev : x) : [...state.events, ev];
      selDay = ev.date; calMonth = ev.date.slice(0, 7);
      toast('일정을 저장했어요.');
    }
    persist(); closeSheet(); render(false);
  });
  document.addEventListener('keydown', e => {
    if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName) && !sheetEl().open) { e.preventDefault(); searchSheet(); }
  });
  window.addEventListener('scroll', () => { $('#topbar').classList.toggle('scrolled', window.scrollY > 4); }, { passive: true });
  window.addEventListener('hashchange', () => { closeSheet(); parseHash(); render(true); $('#main').focus({ preventScroll: true }); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && Date.now() - lastFetch > 5 * 60 * 1000) loadCatalogue(); });
  // 마감·시작 시각이 지나면 상태 표시를 바꾸기 위해 1분마다 확인합니다.
  let lastSig = '';
  setInterval(() => {
    const sig = all().map(status).join() + todayKey();
    if (sig !== lastSig) { lastSig = sig; if (!sheetEl().open && !['comp-q'].includes(document.activeElement?.id)) render(false); }
  }, 60000);

  parseHash();
  render(true);
  loadCatalogue();
})();
