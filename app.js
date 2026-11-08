'use strict';
/* =========================================================
   منصة شعلة القيادة — منطق التطبيق
   ========================================================= */
const C = window.APP_CONFIG;
const KINDS = [
  { id: 'knowledge', name: 'نقل المعرفة', day: 'الثلاثاء', mins: 15,
    hint: 'انقل ما تعلّمته في لقاء الاثنين إلى شخص من أسرتك أو زملائك. اكتب ماذا نقلت، ولمن، وكيف كانت استجابته.' },
  { id: 'task', name: 'المهمة التطبيقية', day: 'الأربعاء', mins: 30,
    hint: 'نفّذ المهمة التطبيقية المطلوبة هذا الأسبوع، ثم صف ما قمت به وما النتيجة وما الذي تعلّمته.' },
  { id: 'shadow', name: 'معايشة قائد', day: 'الخميس', mins: 15,
    hint: 'لاحظ قائدًا في أسرتك أو مدرستك أو مجتمعك. اكتب موقفًا قياديًا رأيته وماذا استفدت منه.' }
];
const ROLE = { student: 'مستفيد', specialist: 'أخصائي', admin: 'مدير النظام', observer: 'الشريك الاستشاري' };
const SUB = { pending: 'بانتظار المراجعة', approved: 'مقبولة', rejected: 'مطلوب إعادتها' };
const ATT = { present: 'حاضر', absent: 'غائب', excused: 'مستأذن' };
const FLAG = { ok: 'منتظم', warn: 'إنذار', exclude: 'مستحق للاستبعاد' };
const P = C.POINTS, R = C.RULES;
const WEEK_MAX = P.attendance + KINDS.reduce((a, k) => a + P[k.id], 0);
const NAV = {
  observer: [['home', 'لوحة المتابعة'], ['students', 'الطلاب'], ['specialists', 'متابعة الأخصائيين'], ['leaders', 'الأوائل'], ['media', '📷 الوسائط'], ['posts', '📣 النشر الإعلامي'], ['impact', '📊 قياس الأثر'], ['reports', 'التقارير'], ['system', '📘 نظام البرنامج'], ['profile', 'حسابي']],
  student: [['home', 'إنجازي'], ['leaders', 'الأوائل'], ['media', '📷 الوسائط'], ['system', '📘 نظام البرنامج'], ['profile', 'حسابي']],
  specialist: [['home', 'لوحة المتابعة'], ['attendance', 'التحضير'], ['review', 'مراجعة الممارسات'], ['students', 'الطلاب'], ['leaders', 'الأوائل'], ['media', '📷 الوسائط'], ['posts', '📣 النشر الإعلامي'], ['impact', '📊 قياس الأثر'], ['reports', 'التقارير'], ['system', '📘 نظام البرنامج'], ['profile', 'حسابي']],
  admin: [['home', 'لوحة المتابعة'], ['attendance', 'التحضير'], ['review', 'مراجعة الممارسات'], ['students', 'الطلاب'], ['specialists', 'الأخصائيون'], ['leaders', 'الأوائل'], ['media', '📷 الوسائط'], ['posts', '📣 النشر الإعلامي'], ['impact', '📊 قياس الأثر'], ['reports', 'التقارير'], ['users', 'المستخدمون'], ['weeks', 'الأسابيع'], ['system', '📘 نظام البرنامج'], ['profile', 'حسابي']]
};

const app = document.getElementById('app');
const S = { session: null, me: null, weeks: [], staff: [], onlyMine: true };
let PG = {}; // حالة الصفحة الحالية

/* ---------- أدوات ---------- */
const h = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const n = x => (Math.round((+x || 0) * 10) / 10).toLocaleString('ar-SA-u-nu-latn');
const pct = (a, b) => b ? Math.round(a / b * 100) : 0;
const toLatin = s => String(s).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
const digits = s => toLatin(s).replace(/\D/g, '');
const loginEmail = v => { v = toLatin(String(v).trim().toLowerCase()); return v.includes('@') ? v : (digits(v) ? digits(v) + '@' + C.USERNAME_DOMAIN : ''); };
const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const wDate = w => new Date(w.meeting_date + 'T00:00:00');
const addDays = (d, k) => { const x = new Date(d); x.setDate(x.getDate() + k); return x; };
const started = w => wDate(w) <= today();
const practicesDue = w => addDays(wDate(w), 7) <= today(); // بعد انتهاء مدة الرفع (الأحد)
const weekState = w => { const d = wDate(w), t = today(); return d > t ? 'upcoming' : addDays(d, 6) >= t ? 'current' : 'done'; };
const fmtDate = s => { try { return new Date(s + (s.length === 10 ? 'T00:00:00' : '')).toLocaleDateString('ar-SA-u-ca-gregory-nu-latn', { day: 'numeric', month: 'long', year: 'numeric' }); } catch { return s; } };
const $ = id => document.getElementById(id);
const fmtTime = ts => { try { return new Date(ts).toLocaleTimeString('ar-SA-u-nu-latn', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Riyadh' }); } catch { return ''; } };
const EARLY = '<span class="chip early" title="حضور مبكر">⭐ مبكر</span>';
const val = id => { const el = $(id); return el ? el.value.trim() : ''; };

let tt;
function toast(msg, bad) {
  const t = $('toast'); t.innerHTML = `<div class="${bad ? 'bad' : ''}">${h(msg)}</div>`;
  clearTimeout(tt); tt = setTimeout(() => t.innerHTML = '', 3600);
}
function errMsg(e) {
  const m = (e && (e.message || e.error_description)) || '';
  if (/Invalid login credentials/i.test(m)) return 'رقم الهوية أو كلمة المرور غير صحيحة.';
  if (/submission window closed/i.test(m)) return 'انتهت مدة رفع ممارسات هذا الأسبوع (حتى يوم الأحد).';
  if (/national id exists/i.test(m)) return 'رقم الهوية مسجّل مسبقًا في المنصة.';
  if (/invalid national id/i.test(m)) return 'رقم الهوية يجب أن يكون 10 أرقام.';
  if (/name required/i.test(m)) return 'اكتب الاسم.';
  if (/cannot delete self/i.test(m)) return 'لا يمكنك حذف حسابك.';
  if (/not authorized/i.test(m)) return 'لا تملك صلاحية تنفيذ هذا الإجراء.';
  if (/Password should be at least|weak password/i.test(m)) return 'كلمة المرور قصيرة. استخدم 6 خانات على الأقل.';
  if (/same_password|should be different/i.test(m)) return 'اختر كلمة مرور مختلفة عن الحالية.';
  if (/row-level security|permission|not authorized/i.test(m)) return 'لا تملك صلاحية تنفيذ هذا الإجراء.';
  if (/exceeded the maximum allowed size|Payload too large/i.test(m)) return 'الملف أكبر من 10 ميجابايت.';
  if (/Failed to fetch|NetworkError/i.test(m)) return 'تعذّر الاتصال. تحقق من الإنترنت ثم أعد المحاولة.';
  return 'حدث خطأ: ' + (m || 'غير معروف');
}
async function q(p) { const { data, error } = await p; if (error) throw error; return data; }
async function busy(btn, fn, ok) {
  if (btn) { if (btn.disabled) return; btn.disabled = true; }
  try { await fn(); if (ok) toast(ok); }
  catch (e) { console.error(e); toast(errMsg(e), true); }
  finally { if (btn && btn.isConnected) btn.disabled = false; }
}
async function openFile(bucket, path) {
  const w = window.open('', '_blank');
  try {
    const d = await q(sb.storage.from(bucket).createSignedUrl(path, 3600));
    if (w) w.location = d.signedUrl; else location.href = d.signedUrl;
  } catch (e) { if (w) w.close(); toast(errMsg(e), true); }
}
function safeExt(name) { const e = (String(name).split('.').pop() || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 6); return e || 'bin'; }
function downloadCSV(name, rows) {
  const csv = '\ufeff' + rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = name; document.body.appendChild(a); a.click(); a.remove();
}

/* ---------- الاتصال بقاعدة البيانات ---------- */
let sb = null;
if (C && /^https:\/\//.test(C.SUPABASE_URL) && window.supabase) {
  sb = window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY);
}

/* ---------- البيانات ---------- */
const loadWeeks = async (force) => { if (force || !S.weeks.length) S.weeks = await q(sb.from('weeks').select('*').order('id')); return S.weeks; };
const loadStaff = async () => { S.staff = await q(sb.from('profiles').select('id,full_name,role').in('role', ['specialist', 'admin']).eq('status', 'active').order('full_name')); return S.staff; };
const loadStudents = () => q(sb.from('profiles').select('id,full_name,username,phone,school,grade,status,specialist_id').eq('role', 'student').neq('status', 'pending').order('full_name'));
const loadSubsMeta = (sid) => { let x = sb.from('submissions').select('id,student_id,week_id,kind,status,score,created_at,reviewed_by,reviewed_at,self_rating'); if (sid) x = x.eq('student_id', sid); return q(x.range(0, 9999)); };
const loadAtt = (sid) => { let x = sb.from('attendance').select('week_id,student_id,status,marked_at,early,points,checkout_at,leave_penalty'); if (sid) x = x.eq('student_id', sid); return q(x.range(0, 9999)); };
const isStaff = () => S.me && (S.me.role === 'specialist' || S.me.role === 'admin');
const staffName = id => (S.staff.find(s => s.id === id) || {}).full_name || '';
function scoped(students) {
  if (S.me.role === 'specialist' && S.onlyMine && students.some(s => s.specialist_id === S.me.id)) return students.filter(s => s.specialist_id === S.me.id);
  return students;
}
function indexData(subs, att) {
  const sub = new Map(), at = new Map(), atp = new Map();
  subs.forEach(s => sub.set(s.student_id + '|' + s.week_id + '|' + s.kind, s));
  att.forEach(a => { at.set(a.student_id + '|' + a.week_id, a.status); if (a.status === 'present') atp.set(a.student_id + '|' + a.week_id, Math.max((a.points || P.attendance) - (a.leave_penalty || 0), 0)); });
  return { sub, at, atp };
}
function progress(sid, weeks, ix) {
  let total = 0, absences = 0, presents = 0, missing = 0, approved = 0, submitted = 0;
  const perWeek = weeks.map(w => {
    const a = ix.at.get(sid + '|' + w.id) || null;
    const ws = {}; let score = 0;
    KINDS.forEach(k => { ws[k.id] = ix.sub.get(sid + '|' + w.id + '|' + k.id) || null; });
    if (a === 'present') { score += ix.atp && ix.atp.has(sid + '|' + w.id) ? ix.atp.get(sid + '|' + w.id) : P.attendance; presents++; }
    if (a === 'absent') absences++;
    KINDS.forEach(k => {
      const s = ws[k.id];
      if (s && s.status !== 'rejected') submitted++;
      if (s && s.status === 'approved') { approved++; score += s.score != null ? +s.score : P[k.id]; }
    });
    if (practicesDue(w)) missing += KINDS.filter(k => !ws[k.id] || ws[k.id].status === 'rejected').length;
    total += score;
    return { w, a, ws, score };
  });
  const flag = (absences >= R.absenceExclusion || missing >= R.practiceExclusion) ? 'exclude'
    : (absences >= R.absenceWarning || missing >= R.practiceWarning) ? 'warn' : 'ok';
  const startedWeeks = weeks.filter(started).length;
  return { perWeek, total, absences, presents, missing, approved, submitted, flag, maxSoFar: startedWeeks * WEEK_MAX, startedWeeks };
}
function currentWeek(weeks) {
  return weeks.find(w => weekState(w) === 'current') || [...weeks].reverse().find(started) || weeks[0];
}

/* ---------- الهيكل العام ---------- */
function shell(active) {
  const MORE = ['specialists', 'media', 'posts', 'users', 'weeks', 'system', 'profile'];
  const all = NAV[S.me.role], useMore = all.length > 7;
  const main = useMore ? all.filter(([id]) => !MORE.includes(id)) : all, more = useMore ? all.filter(([id]) => MORE.includes(id)) : [];
  const a = ([id, name]) => `<a href="#/${id}" ${id === active ? 'aria-current="page"' : ''}>${name}</a>`;
  const activeMore = more.find(([id]) => id === active);
  const links = `<div class="nav-main">${main.map(a).join('')}</div>${more.length ? `<details class="nav-more"><summary ${activeMore ? 'aria-current="page"' : ''}>${activeMore ? activeMore[1] : 'المزيد'} ▾</summary><div class="nav-menu">${more.map(a).join('')}</div></details>` : ''}`;
  app.innerHTML = `
  <header class="top"><div class="top-in">
    <a href="#/home" aria-label="الرئيسية"><img class="brand" src="assets/program-logo.png" alt="${h(C.PROGRAM_NAME)}"></a>
    <img class="assoc" src="assets/association-logo-light.png" alt="${h(C.ORG_NAME)}">
    <div class="who"><div class="who-name"><b>${h(S.me.full_name)}</b><small>${ROLE[S.me.role]}</small></div>
      <button class="btn-out" data-act="logout">خروج</button></div>
  </div></header>
  ${NAV[S.me.role].length > 1 ? `<nav class="nav"><div class="nav-in">${links}</div></nav>` : ''}
  <main class="wrap" id="main"><p class="loading">جارٍ التحميل…</p></main>
  <footer class="foot"><img src="assets/association-logo.png" alt="${h(C.ORG_NAME)}"><img src="assets/supporter-logo.png" alt="مؤسسة العوهلي" class="sup"><img src="assets/center-logo.png" alt="مركز دراسات القيادة" class="sup" onerror="this.remove()"><span>${h(C.ORG_NAME)}<br>${h(C.SUPPORTER)}</span></footer>`;
  return $('main');
}
function fail(main, e) { console.error(e); main.innerHTML = `<div class="card empty">${h(errMsg(e))}<div class="actions" style="justify-content:center"><button class="btn ghost sm" data-act="reload">إعادة المحاولة</button></div></div>`; }

/* ---------- الدخول والتسجيل ---------- */
function authLayout(inner) {
  app.innerHTML = `<div class="auth">
    <section class="auth-brand">
      ${(C.LOGIN_PHOTOS || []).length ? `<div class="slides" aria-hidden="true">${C.LOGIN_PHOTOS.map((src, i) => `<img src="${h(src)}" alt="" class="${i ? '' : 'on'}" ${i ? 'loading="lazy"' : ''}>`).join('')}</div>` : ''}
      <img class="brand" src="assets/program-logo.png" alt="${h(C.PROGRAM_NAME)}">
      <div><h2>صناعة قادة المستقبل.. تبدأ من هنا</h2><p>منصة متابعة التحضير الأسبوعي والممارسات القيادية</p></div>
    </section>
    <section class="auth-form"><div class="auth-box">${inner}
      <div class="partners">
        <figure><img src="assets/association-logo.png" alt="${h(C.ORG_NAME)}"><figcaption>الجهة المنفذة</figcaption></figure>
        <figure><img src="assets/supporter-logo.png" alt="مؤسسة عبدالعزيز بن محمد العوهلي الأهلية"><figcaption>الشريك الداعم</figcaption></figure>
        <figure><img src="assets/center-logo.png" alt="مركز دراسات القيادة" onerror="this.parentNode.remove()"><figcaption>الشريك الاستشاري</figcaption></figure>
      </div></div></section>
  </div>`;
  startSlides();
}
let slideTimer;
function startSlides() {
  clearInterval(slideTimer);
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  slideTimer = setInterval(() => {
    const imgs = document.querySelectorAll('.slides img');
    if (!imgs.length) return clearInterval(slideTimer);
    const i = [...imgs].findIndex(x => x.classList.contains('on'));
    imgs[i].classList.remove('on'); imgs[(i + 1) % imgs.length].classList.add('on');
  }, 6000);
}

/* ---------- بانر الصفحات بالصور ---------- */
const dayIdx = () => Math.floor(Date.now() / 864e5);
function heroAttr(i) {
  const g = C.GALLERY || [];
  if (!g.length) return 'class="head"';
  return `class="head hero" style="--ph:url('${h(g[((i % g.length) + g.length) % g.length])}')"`;
}

/* ---------- معرض الصور ---------- */
function galleryCard() {
  const g = C.GALLERY || [];
  if (!g.length) return '';
  return `<div class="card"><h2>من لقاءات البرنامج</h2><p class="sub">اضغط على أي صورة لعرضها بالحجم الكامل.</p>
    <div class="gallery">${g.map((src, i) => `<button class="g-item" data-act="photo" data-i="${i}" aria-label="عرض الصورة ${i + 1}"><img src="${h(src)}" alt="" loading="lazy"></button>`).join('')}</div></div>`;
}
let lbIndex = 0;
let LB = null;
function openPhoto(i, list) {
  if (list) LB = list;
  const g = LB || C.GALLERY || []; if (!g.length) return;
  lbIndex = (i + g.length) % g.length;
  let lb = $('lightbox');
  if (!lb) {
    lb = document.createElement('div'); lb.id = 'lightbox'; lb.setAttribute('role', 'dialog'); lb.setAttribute('aria-modal', 'true');
    lb.innerHTML = `<button class="lb-x" data-act="lb-close" aria-label="إغلاق">✕</button><button class="lb-nav lb-prev" data-act="lb-prev" aria-label="السابقة">›</button><img alt=""><button class="lb-nav lb-next" data-act="lb-next" aria-label="التالية">‹</button><div class="lb-count"></div>`;
    lb.addEventListener('click', e => { if (e.target === lb) closePhoto(); });
    document.body.appendChild(lb);
    document.addEventListener('keydown', e => { if (!$('lightbox')) return; if (e.key === 'Escape') closePhoto(); if (e.key === 'ArrowLeft') openPhoto(lbIndex + 1); if (e.key === 'ArrowRight') openPhoto(lbIndex - 1); });
  }
  lb.querySelector('img').src = g[lbIndex];
  lb.querySelector('.lb-count').textContent = `${n(lbIndex + 1)} / ${n(g.length)}`;
}
function closePhoto() { const lb = $('lightbox'); if (lb) lb.remove(); LB = null; }
function renderSetup() {
  authLayout(`<h1>المنصة غير مربوطة بعد</h1><p>افتح ملف <b dir="ltr">config.js</b> وضع فيه رابط مشروع Supabase ومفتاحه، ثم أعد رفع الموقع.</p>`);
}
function renderLogin() {
  authLayout(`<h1>تسجيل الدخول</h1><p>أدخل رقم هويتك وكلمة المرور للوصول إلى لوحتك.</p>
  <form class="grid" id="f-login" novalidate>
    <label class="field"><span>رقم الهوية*</span><input type="text" id="l-user" inputmode="numeric" autocomplete="username" dir="ltr" maxlength="10" placeholder="1xxxxxxxxx" required></label>
    <label class="field"><span>كلمة المرور*</span><input type="password" id="l-pass" autocomplete="current-password" required></label>
    <div class="err" id="l-err"></div>
    <button class="btn block" type="submit">تسجيل الدخول</button>
  </form>
  <p class="switch">يُنشئ مدير البرنامج حسابات المستفيدين. إذا نسيت كلمة المرور فتواصل مع الأخصائي.</p>`);
  $('f-login').addEventListener('submit', async e => {
    e.preventDefault();
    const btn = e.submitter || e.target.querySelector('button'); const id = digits(val('l-user')), password = $('l-pass').value;
    if (!/^\d{10}$/.test(id)) { $('l-err').textContent = 'رقم الهوية يجب أن يكون 10 أرقام.'; return; }
    if (!password) { $('l-err').textContent = 'أدخل كلمة المرور.'; return; }
    btn.disabled = true; $('l-err').textContent = '';
    const { data, error } = await sb.auth.signInWithPassword({ email: loginEmail(id), password });
    btn.disabled = false;
    if (error) { $('l-err').textContent = errMsg(error); return; }
    S.session = data.session; S.me = null; location.hash = '#/home'; route();
  });
}
function renderPending() {
  authLayout(`<h1>حسابك بانتظار التفعيل</h1>
  <p>أهلًا ${h(S.me.full_name)}. وصل طلبك إلى مدير النظام، وستتمكن من الدخول إلى لوحتك فور تفعيل حسابك.</p>
  <div class="actions"><button class="btn" data-act="reload">تحديث</button><button class="btn ghost" data-act="logout">خروج</button></div>`);
}

/* ---------- حسابي ---------- */
function pwBanner() {
  if (!S.me || !S.me.must_change_password) return '';
  return `<div class="banner warn"><b>كلمة مرورك ما زالت الافتراضية</b>غيّرها لحماية حسابك. <a href="#/profile">تغيير كلمة المرور</a></div>`;
}
async function renderProfile() {
  const main = shell('profile');
  if (!S.staff.length) await loadStaff().catch(() => {});
  const m = S.me, st = m.role === 'student';
  const rows = [['الاسم', m.full_name], ['رقم الهوية', m.username], ['الجوال', m.phone], st && ['المدرسة', m.school], st && ['الصف', m.grade], st && ['الأخصائي', staffName(m.specialist_id)], ['نوع الحساب', ROLE[m.role]]].filter(Boolean);
  main.innerHTML = `<div ${heroAttr(1)}><div class="grow"><h1>حسابي</h1><p>بياناتك في المنصة وكلمة المرور</p></div></div>
  ${m.must_change_password ? `<div class="banner warn"><b>كلمة مرورك ما زالت الافتراضية</b>اختر كلمة مرور خاصة بك من النموذج أدناه.</div>` : ''}
  <div class="grid g2">
    <div class="card"><h2>البيانات الشخصية</h2><p class="sub">لتصحيح أي بيان تواصل مع مدير البرنامج.</p>
      ${rows.map(([k, v]) => `<div class="row-line"><div class="grow hint">${k}</div><b>${h(v || '—')}</b></div>`).join('')}</div>
    <div class="card"><h2>تغيير كلمة المرور</h2><p class="sub">6 خانات على الأقل، ولا تشاركها مع أحد.</p>
      <form class="grid" id="f-pw" novalidate>
        <label class="field"><span>كلمة المرور الحالية</span><input type="password" id="pw-old" autocomplete="current-password"></label>
        <label class="field"><span>كلمة المرور الجديدة</span><input type="password" id="pw-new" autocomplete="new-password"></label>
        <label class="field"><span>تأكيد كلمة المرور الجديدة</span><input type="password" id="pw-new2" autocomplete="new-password"></label>
        <div class="err" id="pw-err"></div>
        <button class="btn" type="submit">حفظ كلمة المرور</button>
      </form></div>
  </div>`;
  $('f-pw').addEventListener('submit', async e => {
    e.preventDefault();
    const btn = e.target.querySelector('button'), err = $('pw-err'), old = $('pw-old').value, nw = $('pw-new').value;
    if (!old) return err.textContent = 'اكتب كلمة المرور الحالية.';
    if (nw.length < 6) return err.textContent = 'كلمة المرور الجديدة يجب ألا تقل عن 6 خانات.';
    if (nw === old || nw === '123456') return err.textContent = 'اختر كلمة مرور مختلفة عن الحالية والافتراضية.';
    if (nw !== $('pw-new2').value) return err.textContent = 'كلمتا المرور الجديدتان غير متطابقتين.';
    err.textContent = ''; btn.disabled = true;
    try {
      const chk = await sb.auth.signInWithPassword({ email: loginEmail(m.username), password: old });
      if (chk.error) { err.textContent = 'كلمة المرور الحالية غير صحيحة.'; return; }
      await q(sb.auth.updateUser({ password: nw }));
      await sb.rpc('mark_password_changed');
      S.me.must_change_password = false;
      toast('تغيّرت كلمة المرور. استخدمها في دخولك القادم.');
      renderProfile();
    } catch (x) { err.textContent = errMsg(x); }
    finally { if (btn.isConnected) btn.disabled = false; }
  });
}

/* ---------- لوحة المستفيد ---------- */
function weekCard(pw, href) {
  const st = weekState(pw.w);
  const dots = KINDS.map(k => { const s = pw.ws[k.id]; return `<span class="dot ${s ? s.status : ''}" title="${h(k.name)}: ${s ? SUB[s.status] : 'لم تُرفع'}">${k.name}</span>`; }).join('');
  const attChip = pw.a ? `<span class="chip ${pw.a}">${ATT[pw.a]}</span>` : `<span class="chip none">${st === 'upcoming' ? 'لم يبدأ' : 'لم يُسجّل الحضور'}</span>`;
  return `<a class="wk ${st}" href="${href}">
    <div class="wk-top"><span class="wk-n">${pw.w.id}</span><div><h3>${h(pw.w.title)}</h3><small>${fmtDate(pw.w.meeting_date)}</small></div></div>
    <div class="wk-comp">${h(pw.w.competency)}${pw.w.note ? ' — ' + h(pw.w.note) : ''}</div>
    <div>${attChip}</div>
    <div class="dots">${dots}</div>
    <div class="wk-score"><span class="meter"><i style="width:${pct(pw.score, WEEK_MAX)}%"></i></span><b>${n(pw.score)}</b> من ${WEEK_MAX}</div>
  </a>`;
}
function flagBanner(pr) {
  if (pr.flag === 'ok') return '';
  const parts = [];
  if (pr.absences) parts.push(`غياب ${n(pr.absences)} ${pr.absences === 1 ? 'مرة' : 'مرات'}`);
  if (pr.missing) parts.push(`${n(pr.missing)} ممارسة غير منفّذة`);
  return `<div class="banner ${pr.flag}"><b>${pr.flag === 'exclude' ? 'وصلت إلى حد الاستبعاد من البرنامج' : 'لديك إنذار بالاستبعاد'}</b>
    ${parts.join('، ')}. يُنذر الطالب عند الغياب مرتين أو عدم تنفيذ ${R.practiceWarning} ممارسات، ويُستبعد عند الغياب ${R.absenceExclusion} مرات أو عدم تنفيذ ${R.practiceExclusion} ممارسة.</div>`;
}
/* ---------- التحضير الذاتي بالموقع ---------- */
const loadSettings = async () => { try { const r = await q(sb.from('settings').select('*').eq('id', 1)); return r[0] || null; } catch { return null; } };
const todayStr = () => { const d = today(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
function checkInCard(w, status, st) {
  if (!w || status === 'present') return '';
  const place = (st && st.place_name) || 'مقر البرنامج';
  return `<div class="card checkin"><div class="checkin-in">
    <div class="pin" aria-hidden="true">📍</div>
    <div class="grow"><h2>لقاء اليوم: الأسبوع ${w.id}</h2><p class="sub" style="margin:0">سجّل حضورك عند وصولك إلى ${h(place)}. ستطلب المنصة إذن الوصول إلى موقعك.</p></div>
    <button class="btn gold" data-act="checkin">سجّل حضوري</button></div></div>`;
}
function geoError(e) {
  if (e && e.code === 1) return 'لم تسمح للمنصة بمعرفة موقعك. فعّل خدمة الموقع للمتصفح من إعدادات الجوال، ثم أعد المحاولة.';
  if (e && e.code === 3) return 'تأخر تحديد الموقع. اقترب من نافذة أو مكان مفتوح وأعد المحاولة.';
  return 'تعذّر تحديد موقعك. تأكد أن خدمة الموقع مفعّلة ثم أعد المحاولة.';
}
async function selfCheckIn(btn) {
  if (!navigator.geolocation) return toast('جهازك لا يدعم تحديد الموقع.', true);
  btn.disabled = true; const label = btn.textContent; btn.textContent = 'جارٍ تحديد موقعك…';
  try {
    const pos = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }));
    const { latitude, longitude, accuracy } = pos.coords;
    const { error } = await sb.rpc('self_check_in', { p_lat: latitude, p_lng: longitude, p_accuracy: accuracy });
    if (error) {
      const m = error.message || '', far = m.match(/too far:(\d+)/);
      if (far) toast(`أنت على بُعد ${n(+far[1])} متر تقريبًا من مقر اللقاء. سجّل حضورك بعد وصولك.`, true);
      else if (/no meeting today/.test(m)) toast('لا يوجد لقاء اليوم.', true);
      else if (/outside checkin time/.test(m)) toast('التحضير غير متاح في هذا الوقت.', true);
      else if (/location not set/.test(m)) toast('لم يُحدَّد موقع اللقاء بعد. تواصل مع مدير البرنامج.', true);
      else toast(errMsg(error), true);
      return;
    }
    toast('سُجّل حضورك. أهلًا بك في لقاء اليوم!');
    if (PG.reload) await PG.reload(); else route();
  } catch (e) { toast(e && e.code ? geoError(e) : errMsg(e), true); }
  finally { if (btn.isConnected) { btn.disabled = false; btn.textContent = label; } }
}

/* ---------- مدة الرفع ---------- */
const windowEnd = w => addDays(wDate(w), 6);
const windowOpen = w => started(w) && windowEnd(w) >= today();

async function studentDashboard(main, student, isSelf) {
  const [weeks, subs, att, st, fbs] = await Promise.all([loadWeeks(), loadSubsMeta(student.id), loadAtt(student.id), isSelf ? loadSettings() : null,
    isSelf ? q(sb.from('feedback').select('type,ref').eq('student_id', student.id)).catch(() => []) : []]);
  if (!S.staff.length) await loadStaff().catch(() => {});
  const pr = progress(student.id, weeks, indexData(subs, att));
  const cw = currentWeek(weeks);
  const href = w => isSelf ? `#/week/${w.id}` : `#/student/${student.id}/${w.id}`;
  const meetingToday = weeks.find(w => w.meeting_date === todayStr());
  const todayAtt = meetingToday && (att.find(a => a.week_id === meetingToday.id) || {}).status;
  const open = cw && windowOpen(cw);
  main.innerHTML = `
  <div ${heroAttr(dayIdx())}><div class="grow"><h1>${isSelf ? 'أهلًا ' + h(student.full_name.split(' ')[0]) : h(student.full_name)}</h1>
    <p>${[student.school, student.grade, student.specialist_id ? 'الأخصائي: ' + staffName(student.specialist_id) : ''].filter(Boolean).map(h).join(' — ')}</p></div>
    ${isSelf && open ? `<a class="btn gold" href="#/week/${cw.id}">ارفع ممارسات الأسبوع ${cw.id}</a>` : ''}
    ${!isSelf ? `<a class="btn ghost sm" href="#/students">كل الطلاب</a>` : ''}</div>
  ${isSelf ? pwBanner() : ''}
  ${isSelf && student.status === 'active' ? checkInCard(meetingToday, todayAtt, st) : ''}
  ${isSelf && student.status === 'active' ? surveyCards(weeks, st, fbs) : ''}
  ${student.status === 'excluded' ? `<div class="banner exclude"><b>${isSelf ? 'حسابك' : 'هذا الطالب'} مستبعد من البرنامج</b>لا يمكن رفع ممارسات جديدة.</div>` : flagBanner(pr)}
  ${isSelf && open && st && st.limit_submission_window ? `<p class="hint" style="margin-top:-6px">رفع ممارسات الأسبوع ${cw.id} متاح حتى يوم الأحد ${fmtDate(todayFmt(windowEnd(cw)))}.</p>` : ''}
  <div class="kpis">
    <div class="kpi hero"><b>${n(pr.total)}</b><span>مجموع الدرجات من ${n(pr.maxSoFar)} حتى الآن</span></div>
    <div class="kpi"><b>${n(pr.presents)}/${n(pr.startedWeeks)}</b><span>لقاءات حضرتها${att.some(x => x.early && x.status === 'present') ? ` · ⭐ ${n(att.filter(x => x.early && x.status === 'present').length)} مبكر` : ''}</span></div>
    <div class="kpi"><b>${n(pr.approved)}</b><span>ممارسة مقبولة</span></div>
    <div class="kpi"><b>${n(pr.missing)}</b><span>ممارسة غير منفّذة</span></div>
  </div>
  <div class="card"><h2>الإنجاز الأسبوعي</h2><p class="sub">كل أسبوع: حضور لقاء الاثنين (${P.attendance} درجة) وثلاث ممارسات قيادية: نقل المعرفة (${P.knowledge})، والمهمة التطبيقية (${P.task})، ومعايشة قائد (${P.shadow}).</p>
    <div class="weeks">${pr.perWeek.map(pw => weekCard(pw, href(pw.w))).join('')}</div></div>`;
  if (isSelf) PG = { reload: () => studentDashboard(main, student, isSelf) };
}
function todayFmt(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }

const FILE_ACCEPT = '.pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document';
async function weekPage(main, student, wid, isSelf) {
  const weeks = await loadWeeks(); const w = weeks.find(x => x.id === +wid);
  if (!w) { main.innerHTML = `<div class="card empty">هذا الأسبوع غير موجود.</div>`; return; }
  const [subs, att, st] = await Promise.all([
    q(sb.from('submissions').select('*').eq('student_id', student.id).eq('week_id', w.id)),
    q(sb.from('attendance').select('status,method,marked_at,early,points,checkout_at,leave_penalty').eq('student_id', student.id).eq('week_id', w.id)),
    isSelf ? loadSettings() : null,
    q(sb.from('feedback').select('answers').eq('student_id', student.id).eq('type', 'day').eq('ref', String(w.id))).catch(() => [])
  ]).then(r => { PG.dayFb = r[3] && r[3][0]; return r; });
  const a = att[0] && att[0].status, selfMarked = att[0] && att[0].method === 'self';
  const limited = !!(st && st.limit_submission_window) || (!isSelf && false);
  const active = isSelf && student.status === 'active', open = limited ? windowOpen(w) : true;
  const endTxt = fmtDate(todayFmt(windowEnd(w)));
  const idx = weeks.indexOf(w), prev = weeks[idx - 1], next = weeks[idx + 1];
  const base = isSelf ? '#/week/' : `#/student/${student.id}/`;
  const panels = KINDS.map(k => {
    const s = subs.find(x => x.kind === k.id);
    const canSubmit = active && (s ? s.status !== 'approved' && (open || s.status === 'rejected') : open);
    const show = s ? `<div class="sub-box">${s.content ? `<p>${h(s.content)}</p>` : ''}
        ${s.link || s.file_path ? `<div class="actions" ${s.content ? '' : 'style="margin-top:0"'}>${s.link ? `<a href="${h(s.link)}" target="_blank" rel="noopener">فتح الرابط</a>` : ''}${s.file_path ? `<button class="linkish" data-act="file" data-b="submissions" data-p="${h(s.file_path)}">📎 ${h(s.file_name || 'فتح الملف المرفق')}</button>` : ''}</div>` : ''}
        ${s.self_rating ? `<div class="hint" style="margin-top:6px">${isSelf ? 'تقييمك لاستفادتك' : 'تقييم الطالب لاستفادته'}: ${stars(s.self_rating)}</div>` : ''}
        ${s.feedback || s.status === 'approved' ? `<div class="fb">${s.status === 'approved' ? `الدرجة: <b>${n(s.score ?? P[k.id])}</b> من ${P[k.id]}` : ''}${s.feedback ? `<div>ملاحظة الأخصائي: ${h(s.feedback)}</div>` : ''}</div>` : ''}</div>` : '';
    let form = '';
    if (canSubmit) {
      const isFile = s && !s.content && s.file_path;
      form = `<div class="grid">
        <div class="mode" role="radiogroup" aria-label="طريقة الرفع">
          <label><input type="radio" name="m-${k.id}" value="text" data-act-change="mode" data-k="${k.id}" ${isFile ? '' : 'checked'}> كتابة نص</label>
          <label><input type="radio" name="m-${k.id}" value="file" data-act-change="mode" data-k="${k.id}" ${isFile ? 'checked' : ''}> إرفاق ملف Word أو PDF</label>
        </div>
        <label class="field" id="pt-${k.id}" ${isFile ? 'hidden' : ''}><span>صف ما قمت به</span><textarea id="c-${k.id}" maxlength="3000" placeholder="${h(k.hint)}">${s && s.content ? h(s.content) : ''}</textarea></label>
        <label class="field" id="pf-${k.id}" ${isFile ? '' : 'hidden'}><span>اختر الملف (Word أو PDF، حتى 10 ميجابايت)</span><input type="file" id="f-${k.id}" accept="${FILE_ACCEPT}"><span class="hint">${h(k.hint)}</span></label>
        <div class="field"><span>${h(C.PRACTICE_QUESTION.replace('{الممارسة}', k.name))} <small class="hint">(1 منخفض، 5 مرتفع)</small></span>${scale('r-' + k.id, s && s.self_rating)}</div>
        <div class="actions" style="margin-top:0"><button class="btn" data-act="submit" data-k="${k.id}" data-w="${w.id}">${s ? 'إعادة الرفع' : 'رفع الممارسة'}</button></div></div>`;
      if (s) form = `<details class="edit"><summary class="btn ghost sm">${s.status === 'rejected' ? 'أعد رفع الممارسة' : 'تعديل الممارسة'}</summary>${form}</details>`;
    }
    let note = '';
    if (!s && !canSubmit) note = isSelf ? (student.status !== 'active' ? '' : !started(w) ? `يُفتح الرفع يوم اللقاء ${fmtDate(w.meeting_date)}.` : `انتهت مدة الرفع يوم الأحد ${endTxt}.`) : 'لم يرفع الطالب هذه الممارسة.';
    let review = '';
    if (!isSelf && isStaff() && s) review = reviewControls(s, k);
    return `<div class="prac"><div class="prac-h"><h3>${k.name}</h3><span class="hint">${k.day} — ${k.mins} دقيقة — ${P[k.id]} درجة</span>
      <span class="chip ${s ? s.status : 'none'}">${s ? SUB[s.status] : 'لم تُرفع'}</span></div>
      ${note ? `<p class="hint">${note}</p>` : ''}${show}${form}${review}</div>`;
  }).join('');
  const isToday = w.meeting_date === todayStr();
  main.innerHTML = `
  <div ${heroAttr(w.id * 2 + 3)}><div class="grow"><p>${h(w.competency)}${!isSelf ? ' — ' + h(student.full_name) : ''}</p><h1>الأسبوع ${w.id}: ${h(w.title)}</h1>
    <p>لقاء الاثنين ${fmtDate(w.meeting_date)}${w.hijri_date ? ' — ' + h(w.hijri_date) : ''}${w.note ? ' — ' + h(w.note) : ''}</p></div>
    <span class="chip ${a || 'none'}">${a ? 'حضور اللقاء: ' + ATT[a] + (selfMarked ? ' (بالموقع)' : '') + (a === 'present' && att[0].marked_at ? ' — ' + fmtTime(att[0].marked_at) : '') : 'لم يُسجّل الحضور'}</span>${a === 'present' && att[0].early ? EARLY : ''}${a === 'present' ? `<span class="chip">${n(Math.max((att[0].points || P.attendance) - (att[0].leave_penalty || 0), 0))} درجة${att[0].points && att[0].points < 30 ? ' · ' + PTS[att[0].points] : ''}</span>` : ''}${a === 'present' && att[0].checkout_at ? `<span class="chip ${att[0].leave_penalty ? 'bad' : 'none'}">انصراف ${fmtTime(att[0].checkout_at)}${att[0].leave_penalty ? ' · −' + n(att[0].leave_penalty) : ''}</span>` : ''}</div>
  ${active && isToday ? checkInCard(w, a, st) : ''}
  ${isSelf && a === 'present' ? dayRatingCard(w) : ''}
  <div class="card"><h2>الممارسات القيادية</h2><p class="sub">${limited && open ? `الرفع متاح من يوم اللقاء حتى نهاية يوم الأحد ${endTxt}. ` : ''}الممارسات تُنفّذ حتى لو غاب الطالب عن اللقاء. ارفع كل ممارسة نصًا مكتوبًا أو ملف Word أو PDF.</p>${panels}</div>
  <div class="actions">${prev ? `<a class="btn ghost sm" href="${base}${prev.id}">الأسبوع السابق</a>` : ''}<a class="btn ghost sm" href="${isSelf ? '#/home' : '#/student/' + student.id}">كل الأسابيع</a>${next ? `<a class="btn ghost sm" href="${base}${next.id}">الأسبوع التالي</a>` : ''}</div>`;
  PG = { reload: () => weekPage(main, student, wid, isSelf) };
}
async function submitPractice(btn) {
  const kind = btn.dataset.k, wid = +btn.dataset.w;
  const mode = (document.querySelector(`input[name="m-${kind}"]:checked`) || {}).value || 'text';
  const rating = +((document.querySelector(`input[name="r-${kind}"]:checked`) || {}).value || 0);
  if (!rating) return toast('اختر تقييم استفادتك من الممارسة (من 1 إلى 5).', true);
  const content = val('c-' + kind), file = $('f-' + kind) && $('f-' + kind).files[0];
  if (mode === 'text' && content.length < 10) return toast('اكتب وصفًا واضحًا لما قمت به (10 أحرف على الأقل).', true);
  if (mode === 'file') {
    if (!file) return toast('اختر ملف Word أو PDF أولًا.', true);
    if (!['pdf', 'doc', 'docx'].includes(safeExt(file.name))) return toast('الملف يجب أن يكون Word أو PDF.', true);
    if (file.size > 10 * 1024 * 1024) return toast('الملف أكبر من 10 ميجابايت.', true);
  }
  await busy(btn, async () => {
    const row = { student_id: S.me.id, week_id: wid, kind, link: null, self_rating: rating };
    if (mode === 'file') {
      const path = `${S.me.id}/w${wid}-${kind}-${Date.now()}.${safeExt(file.name)}`;
      await q(sb.storage.from('submissions').upload(path, file, { contentType: file.type || undefined }));
      Object.assign(row, { content: '', file_path: path, file_name: file.name.slice(0, 120) });
    } else Object.assign(row, { content, file_path: null, file_name: null });
    await q(sb.from('submissions').upsert(row, { onConflict: 'student_id,week_id,kind' }));
    await PG.reload();
  }, 'رُفعت الممارسة وأُرسلت للأخصائي.');
}

/* ---------- المراجعة ---------- */
function reviewControls(s, k) {
  return `<div class="grid g2" style="margin-top:8px">
    <label class="field"><span>الدرجة من ${P[k.id]}</span><input type="number" id="sc-${s.id}" min="0" max="${P[k.id]}" step="1" value="${s.score ?? P[k.id]}" inputmode="numeric"></label>
    <label class="field"><span>ملاحظة للطالب</span><input type="text" id="fb-${s.id}" maxlength="400" value="${h(s.feedback || '')}"></label></div>
    <div class="actions"><button class="btn ok sm" data-act="rv" data-s="approved" data-id="${s.id}" data-k="${k.id}">قبول</button>
    <button class="btn no sm" data-act="rv" data-s="rejected" data-id="${s.id}" data-k="${k.id}">طلب إعادة</button></div>`;
}
async function reviewAction(btn) {
  const id = btn.dataset.id, st = btn.dataset.s, max = P[btn.dataset.k];
  let score = st === 'approved' ? +val('sc-' + id) : 0;
  if (st === 'approved' && (isNaN(score) || score < 0 || score > max)) return toast(`الدرجة يجب أن تكون بين 0 و${max}.`, true);
  const feedback = val('fb-' + id);
  if (st === 'rejected' && !feedback) return toast('اكتب ملاحظة توضّح للطالب ما المطلوب تعديله.', true);
  await busy(btn, async () => {
    await q(sb.from('submissions').update({ status: st, score, feedback: feedback || null, reviewed_by: S.me.id, reviewed_at: new Date().toISOString() }).eq('id', id));
    if (PG.reload) await PG.reload();
  }, st === 'approved' ? 'قُبلت الممارسة.' : 'أُعيدت الممارسة للطالب.');
}
async function renderReview() {
  const main = shell('review');
  try {
    const [weeks, students] = await Promise.all([loadWeeks(), loadStudents()]);
    PG.f = PG.f || { week: 'all', kind: 'all', status: 'pending' };
    const f = PG.f;
    const mine = scoped(students), ids = new Set(mine.map(s => s.id)), byId = Object.fromEntries(students.map(s => [s.id, s]));
    let x = sb.from('submissions').select('*').order('created_at', { ascending: true }).range(0, 299);
    if (f.status !== 'all') x = x.eq('status', f.status);
    if (f.week !== 'all') x = x.eq('week_id', +f.week);
    if (f.kind !== 'all') x = x.eq('kind', f.kind);
    const rows = (await q(x)).filter(s => ids.has(s.student_id));
    const opt = (v, cur, label) => `<option value="${v}" ${String(v) === String(cur) ? 'selected' : ''}>${label}</option>`;
    main.innerHTML = `
    <div class="head"><div class="grow"><h1>مراجعة الممارسات</h1><p>${n(rows.length)} ممارسة${f.status === 'pending' ? ' بانتظار المراجعة' : ''}</p></div>
      <label>الأسبوع <select data-f="week">${opt('all', f.week, 'الكل')}${weeks.map(w => opt(w.id, f.week, 'الأسبوع ' + w.id)).join('')}</select></label>
      <label>النوع <select data-f="kind">${opt('all', f.kind, 'الكل')}${KINDS.map(k => opt(k.id, f.kind, k.name)).join('')}</select></label>
      <label>الحالة <select data-f="status">${opt('pending', f.status, SUB.pending)}${opt('approved', f.status, SUB.approved)}${opt('rejected', f.status, SUB.rejected)}${opt('all', f.status, 'الكل')}</select></label>
      ${S.me.role === 'specialist' ? scopeToggle() : ''}</div>
    ${rows.length ? rows.map(s => { const k = KINDS.find(z => z.id === s.kind); const st = byId[s.student_id] || {};
      return `<div class="card"><div class="prac-h"><h3>${h(st.full_name || '')}</h3><span class="chip">الأسبوع ${s.week_id}</span><span class="chip">${k.name}</span><span class="chip ${s.status}">${SUB[s.status]}</span></div>
        <div class="sub-box"><p>${h(s.content)}</p>${s.link || s.file_path ? `<div class="actions">${s.link ? `<a href="${h(s.link)}" target="_blank" rel="noopener">فتح الرابط</a>` : ''}${s.file_path ? `<button class="linkish" data-act="file" data-b="submissions" data-p="${h(s.file_path)}">${h(s.file_name || 'فتح المرفق')}</button>` : ''}</div>` : ''}</div>
        ${reviewControls(s, k)}</div>`; }).join('')
      : `<div class="card empty">${f.status === 'pending' ? 'لا توجد ممارسات بانتظار المراجعة. أحسنت!' : 'لا توجد ممارسات بهذه التصفية.'}</div>`}`;
    PG.reload = renderReview;
  } catch (e) { fail(main, e); }
}
function scopeToggle() {
  return `<label><input type="checkbox" data-act-change="scope" ${S.onlyMine ? 'checked' : ''}> طلابي فقط</label>`;
}

/* ---------- التحضير ---------- */
async function renderAttendance(arg) {
  const main = shell('attendance');
  try {
    const [weeks, students] = await Promise.all([loadWeeks(), loadStudents()]);
    const w = weeks.find(x => x.id === +arg) || currentWeek(weeks);
    const [att, sheets] = await Promise.all([
      q(sb.from('attendance').select('student_id,status,method,distance_m,marked_at,early,points,checkout_at,leave_penalty').eq('week_id', w.id)),
      q(sb.from('attendance_sheets').select('*').eq('week_id', w.id).order('created_at', { ascending: false }))
    ]);
    const list = scoped(students).filter(s => s.status === 'active');
    PG = { w, list, att: Object.fromEntries(att.map(a => [a.student_id, a.status])), meth: Object.fromEntries(att.map(a => [a.student_id, a])), sheets, sel: new Set(), reload: () => renderAttendance(w.id) };
    drawAttendance(main, weeks);
  } catch (e) { fail(main, e); }
}
const PTS = { 30: 'مبكر', 20: 'العصر', 10: 'المغرب' };
const nowHM = () => new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Riyadh' });
function drawAttendance(main, weeks) {
  const { w, list, att, sheets } = PG;
  const admin = S.me.role === 'admin';
  const c = { present: 0, absent: 0, excused: 0 }; list.forEach(s => { if (att[s.id]) c[att[s.id]]++; });
  const unmarked = list.length - c.present - c.absent - c.excused;
  const out = list.filter(s => att[s.id] === 'present' && PG.meth[s.id] && PG.meth[s.id].checkout_at).length;
  const ptsSel = s => { const m = PG.meth[s.id] || {}, v = m.points || 30;
    return `<select class="pts-sel" data-act-change="att-pts" data-sid="${s.id}" aria-label="درجة الحضور">${[30, 20, 10].map(x => `<option value="${x}" ${x === v ? 'selected' : ''}>${x} · ${PTS[x]}</option>`).join('')}</select>`; };
  main.innerHTML = `
  <div class="head"><div class="grow"><h1>التحضير الأسبوعي</h1><p>لقاء الاثنين ${fmtDate(w.meeting_date)} — ${h(w.title)}</p></div>
    <label>الأسبوع <select data-act-change="att-week">${weeks.map(x => `<option value="${x.id}" ${x.id === w.id ? 'selected' : ''}>الأسبوع ${x.id} — ${fmtDate(x.meeting_date)}</option>`).join('')}</select></label>
    ${S.me.role === 'specialist' ? scopeToggle() : ''}</div>
  <div class="kpis">
    <div class="kpi"><b>${n(c.present)}</b><span>حاضر</span></div>
    <div class="kpi"><b>${n(c.absent)}</b><span>غائب</span></div>
    <div class="kpi"><b>${n(c.excused)}</b><span>مستأذن</span></div>
    <div class="kpi"><b>${n(unmarked)}</b><span>لم يُحضَّر</span></div>
    <div class="kpi"><b>${n(out)}/${n(c.present)}</b><span>انصرفوا</span></div>
  </div>
  <div class="card"><div class="prac-h"><h2 style="flex:1">كشف الحضور</h2>${unmarked ? `<button class="btn gold sm" data-act="att-all">تسجيل غير المحضَّرين حاضرين</button>` : ''}</div>
    <p class="sub">درجة الحضور تُحسب تلقائيًا من وقت التحضير: <b>مبكر 30</b> · <b>العصر 20</b> · <b>المغرب 10</b>، ويمكن تعديلها من عمود «الدرجة». والانصراف قبل فترة المغرب يخصم 10، وقبل فترة العصر 20.</p>
    ${admin && c.present ? `<div class="checkout-bar"><label class="check"><input type="checkbox" data-act-change="sel-all" ${PG.sel.size && PG.sel.size === list.filter(s => att[s.id] === 'present').length ? 'checked' : ''}> تحديد كل الحاضرين</label>
      <span class="hint">${n(PG.sel.size)} محدد</span>
      <label class="field-inline">وقت الانصراف <input type="time" id="co-time" value="${PG.coTime || nowHM()}"></label>
      <button class="btn sm" data-act="checkout" ${PG.sel.size ? '' : 'disabled'}>تسجيل انصراف المحددين</button></div>` : ''}
    ${list.length ? `<div class="scroll"><table><thead><tr>${admin ? '<th style="width:40px"></th>' : ''}<th>الطالب</th><th>الحضور</th><th>الدرجة</th><th>الانصراف</th><th>الحالة</th></tr></thead><tbody>
    ${list.map(s => { const m = PG.meth[s.id] || {}, pres = att[s.id] === 'present';
      return `<tr>${admin ? `<td>${pres ? `<input type="checkbox" class="row-chk" data-act-change="sel" data-sid="${s.id}" ${PG.sel.has(s.id) ? 'checked' : ''} aria-label="تحديد ${h(s.full_name)}">` : ''}</td>` : ''}
      <td><b>${h(s.full_name)}</b><div class="hint">${h(s.school || '')}${m.method === 'self' && pres ? ' · 📍 حضّر نفسه' : ''}</div></td>
      <td>${pres && m.marked_at ? `<span class="time">${fmtTime(m.marked_at)}</span>${m.early ? ' ' + EARLY : ''}` : '<span class="hint">—</span>'}</td>
      <td>${pres ? ptsSel(s) : '<span class="hint">—</span>'}</td>
      <td>${pres && m.checkout_at ? `<span class="time">${fmtTime(m.checkout_at)}</span>${m.leave_penalty ? ` <span class="chip bad" title="انصراف قبل نهاية اللقاء">−${n(m.leave_penalty)}</span>` : ''}${admin ? ` <button class="linkish" data-act="co-clear" data-sid="${s.id}" title="إلغاء الانصراف">✕</button>` : ''}` : '<span class="hint">—</span>'}</td>
      <td><div class="seg3">${['present', 'absent', 'excused'].map(st => `<button class="${st}" aria-pressed="${att[s.id] === st}" data-act="att" data-sid="${s.id}" data-st="${st}">${ATT[st]}</button>`).join('')}</div></td></tr>`; }).join('')}
    </tbody></table></div>` : '<div class="empty">لا يوجد طلاب مفعّلون بعد.</div>'}
  </div>
  <div class="card"><h2>رفع كشف التحضير الورقي</h2><p class="sub">صورة أو ملف PDF لكشف الحضور الموقّع للقاء هذا الأسبوع.</p>
    <div class="actions" style="margin-top:0"><input type="file" id="sheet-file" accept="image/*,application/pdf"><button class="btn sm" data-act="sheet-up">رفع الكشف</button></div>
    ${sheets.length ? sheets.map(sh => `<div class="row-line"><div class="grow">${h(sh.file_name || 'كشف')}<div class="hint">${fmtDate(sh.created_at.slice(0, 10))}${sh.uploaded_by ? ' — ' + h(staffName(sh.uploaded_by)) : ''}</div></div><button class="btn ghost sm" data-act="file" data-b="sheets" data-p="${h(sh.file_path)}">فتح</button></div>`).join('') : '<p class="hint">لم يُرفع كشف لهذا الأسبوع.</p>'}
  </div>`;
}
const ATT_SEL = 'student_id,status,method,distance_m,marked_at,early,points,checkout_at,leave_penalty';
async function markAttendance(btn) {
  const sid = btn.dataset.sid, st = btn.dataset.st;
  if (PG.att[sid] === st) return;
  await busy(btn, async () => {
    const r = await q(sb.from('attendance').upsert({ week_id: PG.w.id, student_id: sid, status: st, method: 'staff', distance_m: null, points: null, marked_by: S.me.id, marked_at: new Date().toISOString() }).select(ATT_SEL));
    PG.att[sid] = st; PG.meth[sid] = (r && r[0]) || { method: 'staff' }; PG.sel.delete(sid); drawAttendance($('main'), S.weeks);
  });
}
async function markAllPresent(btn) {
  const rows = PG.list.filter(s => !PG.att[s.id]).map(s => ({ week_id: PG.w.id, student_id: s.id, status: 'present', method: 'staff', points: null, marked_by: S.me.id, marked_at: new Date().toISOString() }));
  if (!rows.length) return;
  await busy(btn, async () => { const r = await q(sb.from('attendance').upsert(rows).select(ATT_SEL)); (r || []).forEach(x => { PG.att[x.student_id] = 'present'; PG.meth[x.student_id] = x; }); drawAttendance($('main'), S.weeks); }, 'سُجّل الحضور.');
}
async function checkoutSelected(btn) {
  const ids = [...PG.sel]; if (!ids.length) return;
  const tm = val('co-time') || nowHM();
  PG.coTime = tm;
  const at = new Date(`${PG.w.meeting_date}T${tm}:00+03:00`).toISOString();
  await busy(btn, async () => {
    await q(sb.rpc('admin_checkout', { p_week: PG.w.id, p_students: ids, p_at: at }));
    PG.sel.clear(); await PG.reload();
  }, `سُجّل انصراف ${n(ids.length)} طالب.`);
}
async function uploadSheet(btn) {
  const file = $('sheet-file').files[0];
  if (!file) return toast('اختر صورة الكشف أو ملف PDF أولًا.', true);
  if (file.size > 10 * 1024 * 1024) return toast('الملف أكبر من 10 ميجابايت.', true);
  await busy(btn, async () => {
    const path = `w${PG.w.id}/${Date.now()}.${safeExt(file.name)}`;
    await q(sb.storage.from('sheets').upload(path, file, { contentType: file.type || undefined }));
    await q(sb.from('attendance_sheets').insert({ week_id: PG.w.id, file_path: path, file_name: file.name.slice(0, 120), uploaded_by: S.me.id }));
    await PG.reload();
  }, 'رُفع كشف التحضير.');
}

/* ---------- لوحة المتابعة والطلاب ---------- */
async function staffData() {
  const [weeks, students, subs, att] = await Promise.all([loadWeeks(), loadStudents(), loadSubsMeta(), loadAtt()]);
  if (!S.staff.length) await loadStaff();
  const ix = indexData(subs, att);
  const list = scoped(students);
  const rows = list.map(s => ({ s, pr: progress(s.id, weeks, ix) }));
  return { weeks, students, subs, att, ix, list, rows };
}
async function renderStaffHome() {
  const main = shell('home');
  try {
    const d = await staffData(); const cw = currentWeek(d.weeks);
    const ids = new Set(d.list.map(s => s.id));
    const pending = d.subs.filter(s => s.status === 'pending' && ids.has(s.student_id)).length;
    const active = d.list.filter(s => s.status === 'active');
    const marked = active.filter(s => d.ix.at.has(s.id + '|' + cw.id)).length;
    const flagged = d.rows.filter(r => r.pr.flag !== 'ok' && r.s.status === 'active').sort((a, b) => (b.pr.flag === 'exclude') - (a.pr.flag === 'exclude'));
    const cwSubs = d.subs.filter(s => s.week_id === cw.id && ids.has(s.student_id) && s.status !== 'rejected').length;
    main.innerHTML = `
    ${pwBanner()}
    <div ${heroAttr(dayIdx() + 4)}><div class="grow"><h1>لوحة المتابعة</h1><p>الأسبوع ${cw.id}: ${h(cw.title)} — ${fmtDate(cw.meeting_date)}</p></div>${S.me.role === 'specialist' ? scopeToggle() : ''}</div>
    <div class="kpis">
      <div class="kpi hero"><b>${n(active.length)}</b><span>طالب مفعّل</span></div>
      <div class="kpi"><b>${n(marked)}/${n(active.length)}</b><span>محضَّر في الأسبوع ${cw.id}</span></div>
      <div class="kpi"><b>${n(cwSubs)}/${n(active.length * 3)}</b><span>ممارسات الأسبوع ${cw.id}</span></div>
      <div class="kpi"><b>${n(pending)}</b><span>بانتظار المراجعة</span></div>
    </div>
    <div class="grid g2">
      <div class="card"><h2>مهام سريعة</h2><div class="actions">
        ${S.me.role === 'observer' ? `<a class="btn" href="#/specialists">متابعة الأخصائيين</a>
        <a class="btn gold" href="#/students">الطلاب</a>
        <a class="btn ghost" href="#/reports">التقارير</a>` : `<a class="btn" href="#/attendance/${cw.id}">تحضير لقاء الأسبوع ${cw.id}</a>
        <a class="btn gold" href="#/review">مراجعة ${n(pending)} ممارسة</a>
        <a class="btn ghost" href="#/reports">التقارير</a>`}</div></div>
      <div class="card"><h2>طلاب يحتاجون متابعة</h2>
        ${flagged.length ? flagged.slice(0, 8).map(r => `<div class="row-line"><div class="grow"><a href="#/student/${r.s.id}"><b>${h(r.s.full_name)}</b></a><div class="hint">غياب ${n(r.pr.absences)} — ممارسات غير منفّذة ${n(r.pr.missing)}</div></div><span class="chip ${r.pr.flag}">${FLAG[r.pr.flag]}</span></div>`).join('') : '<div class="empty">جميع الطلاب منتظمون.</div>'}
      </div>
    </div>`;
  } catch (e) { fail(main, e); }
}
async function renderStudents() {
  const main = shell('students');
  try {
    const d = await staffData();
    PG = { rows: d.rows.sort((a, b) => b.pr.total - a.pr.total), term: PG.term || '' };
    const draw = () => {
      const t = PG.term.trim(); const rows = PG.rows.filter(r => !t || r.s.full_name.includes(t) || (r.s.phone || '').includes(digits(t) || '#'));
      $('st-body').innerHTML = rows.length ? rows.map(r => `<tr class="click" data-go="#/student/${r.s.id}"><td><b>${h(r.s.full_name)}</b><div class="hint">${h(r.s.school || '')}</div></td>
        <td>${h(staffName(r.s.specialist_id) || '—')}</td><td>${n(r.pr.presents)}/${n(r.pr.startedWeeks)}</td><td>${n(r.pr.approved)}</td><td>${n(r.pr.missing)}</td>
        <td class="num">${n(r.pr.total)}</td><td>${r.s.status === 'excluded' ? '<span class="chip exclude">مستبعد</span>' : `<span class="chip ${r.pr.flag}">${FLAG[r.pr.flag]}</span>`}</td></tr>`).join('')
        : `<tr><td colspan="7" class="empty">لا يوجد طلاب.</td></tr>`;
    };
    main.innerHTML = `<div class="head"><div class="grow"><h1>الطلاب</h1><p>${n(d.rows.length)} طالب</p></div>
      <input type="search" id="st-q" placeholder="ابحث بالاسم أو الجوال" value="${h(PG.term)}" style="max-width:260px">${S.me.role === 'specialist' ? scopeToggle() : ''}</div>
      <div class="card"><div class="scroll"><table><thead><tr><th>الطالب</th><th>الأخصائي</th><th>الحضور</th><th>ممارسات مقبولة</th><th>غير منفّذة</th><th>المجموع</th><th>الحالة</th></tr></thead><tbody id="st-body"></tbody></table></div></div>`;
    draw();
    $('st-q').addEventListener('input', e => { PG.term = e.target.value; draw(); });
  } catch (e) { fail(main, e); }
}
async function renderStudentAsStaff(sid, wid) {
  const main = shell('students');
  try {
    const st = await q(sb.from('profiles').select('*').eq('id', sid).single());
    if (wid) await weekPage(main, st, wid, false); else await studentDashboard(main, st, false);
    if (!wid) PG = { reload: () => renderStudentAsStaff(sid) };
  } catch (e) { fail(main, e); }
}

/* ---------- التقارير ---------- */
async function renderReports() {
  const main = shell('reports');
  try {
    const d = await staffData();
    const startedW = d.weeks.filter(started);
    PG.from = PG.from || 1; PG.to = PG.to || (startedW.length ? startedW[startedW.length - 1].id : 1);
    const range = d.weeks.filter(w => w.id >= PG.from && w.id <= PG.to);
    const active = d.list.filter(s => s.status === 'active'); const ids = new Set(active.map(s => s.id));
    const subs = d.subs.filter(s => ids.has(s.student_id) && s.week_id >= PG.from && s.week_id <= PG.to);
    const perWeek = range.map(w => {
      const att = active.map(s => d.ix.at.get(s.id + '|' + w.id));
      const present = att.filter(a => a === 'present').length, marked = att.filter(Boolean).length;
      const ws = subs.filter(s => s.week_id === w.id);
      const approved = ws.filter(s => s.status === 'approved');
      const scoreSum = active.reduce((a, s) => a + (progress(s.id, [w], d.ix).total), 0);
      return { w, present, marked, submitted: ws.filter(s => s.status !== 'rejected').length, approved: approved.length, avg: active.length ? scoreSum / active.length : 0 };
    });
    const totPresent = perWeek.reduce((a, x) => a + x.present, 0), totMarked = perWeek.reduce((a, x) => a + x.marked, 0);
    const expected = active.length * 3 * range.filter(started).length;
    const submitted = subs.filter(s => s.status !== 'rejected').length, approved = subs.filter(s => s.status === 'approved').length;
    const ranked = active.map(s => ({ s, pr: progress(s.id, range, d.ix) })).sort((a, b) => b.pr.total - a.pr.total);
    const allFlags = active.map(s => ({ s, pr: progress(s.id, d.weeks, d.ix) })).filter(r => r.pr.flag !== 'ok');
    const byKind = KINDS.map(k => ({ k, sub: subs.filter(s => s.kind === k.id && s.status !== 'rejected').length, ok: subs.filter(s => s.kind === k.id && s.status === 'approved').length }));
    const opt = (cur) => d.weeks.map(w => `<option value="${w.id}" ${w.id === cur ? 'selected' : ''}>الأسبوع ${w.id}</option>`).join('');
    PG.csv = () => downloadCSV(`تقرير-${C.PROGRAM_NAME.replace(/\s+/g, '-')}-الأسابيع-${PG.from}-${PG.to}.csv`, [
      ['الترتيب', 'الطالب', 'المدرسة', 'الأخصائي', 'الحضور', 'الغياب', 'ممارسات مرفوعة', 'ممارسات مقبولة', 'غير منفّذة', 'المجموع', 'الحالة'],
      ...ranked.map((r, i) => [i + 1, r.s.full_name, r.s.school, staffName(r.s.specialist_id), r.pr.presents, r.pr.absences, r.pr.submitted, r.pr.approved, r.pr.missing, r.pr.total, FLAG[r.pr.flag]])
    ]);
    main.innerHTML = `
    <div class="print-only" style="align-items:center;gap:16px;margin-bottom:16px"><img src="assets/association-logo.png" alt="" style="height:50px"><div><b>تقرير برنامج ${h(C.PROGRAM_NAME)}</b><div class="hint">${h(C.ORG_NAME)} — ${fmtDate(new Date().toISOString().slice(0, 10))}</div></div></div>
    <div class="head"><div class="grow"><h1>التقارير الدورية</h1><p>من الأسبوع ${PG.from} إلى الأسبوع ${PG.to} — ${n(active.length)} طالب</p></div>
      <label class="no-print">من <select data-act-change="rep-from">${opt(PG.from)}</select></label>
      <label class="no-print">إلى <select data-act-change="rep-to">${opt(PG.to)}</select></label>
      ${S.me.role === 'specialist' ? `<span class="no-print">${scopeToggle()}</span>` : ''}
      <button class="btn ghost sm no-print" data-act="csv">تصدير Excel</button><button class="btn sm no-print" data-act="print">طباعة / PDF</button></div>
    <div class="kpis">
      <div class="kpi hero"><b>${pct(totPresent, totMarked)}٪</b><span>نسبة الحضور</span></div>
      <div class="kpi"><b>${n(submitted)}/${n(expected)}</b><span>ممارسات منفّذة من المطلوب</span></div>
      <div class="kpi"><b>${pct(approved, submitted)}٪</b><span>نسبة القبول</span></div>
      <div class="kpi"><b>${n(allFlags.length)}</b><span>طلاب عليهم إنذار</span></div>
    </div>
    <div class="grid g2">
      <div class="card"><h2>نسبة الحضور لكل أسبوع</h2><div class="bars">${perWeek.map(x => `<div class="bar-row"><span>الأسبوع ${x.w.id}</span><span class="meter"><i style="width:${pct(x.present, x.marked)}%"></i></span><b>${x.marked ? pct(x.present, x.marked) + '٪' : '—'}</b></div>`).join('')}</div></div>
      <div class="card"><h2>تنفيذ الممارسات لكل أسبوع</h2><div class="bars">${perWeek.map(x => `<div class="bar-row"><span>الأسبوع ${x.w.id}</span><span class="meter"><i class="gold" style="width:${pct(x.submitted, active.length * 3)}%"></i></span><b>${pct(x.submitted, active.length * 3)}٪</b></div>`).join('')}</div></div>
    </div>
    <div class="card"><h2>ملخص الأسابيع</h2><div class="scroll"><table><thead><tr><th>الأسبوع</th><th>الموضوع</th><th>الحضور</th><th>ممارسات منفّذة</th><th>مقبولة</th><th>متوسط الدرجة</th></tr></thead><tbody>
      ${perWeek.map(x => `<tr><td>${x.w.id}</td><td>${h(x.w.title)}<div class="hint">${fmtDate(x.w.meeting_date)}</div></td><td>${n(x.present)}/${n(x.marked)}</td><td>${n(x.submitted)}</td><td>${n(x.approved)}</td><td class="num">${n(x.avg)} من ${WEEK_MAX}</td></tr>`).join('')}
    </tbody></table></div></div>
    <div class="grid g2">
      <div class="card"><h2>الممارسات حسب النوع</h2>${byKind.map(b => `<div class="row-line"><div class="grow"><b>${b.k.name}</b><div class="hint">${b.k.day}</div></div><span class="chip">${n(b.sub)} منفّذة</span><span class="chip ok">${n(b.ok)} مقبولة</span></div>`).join('')}</div>
      <div class="card"><h2>الأعلى إنجازًا</h2>${ranked.slice(0, 10).map((r, i) => `<div class="row-line"><span class="chip">${n(i + 1)}</span><div class="grow"><b>${h(r.s.full_name)}</b><div class="hint">${h(r.s.school || '')}</div></div><b>${n(r.pr.total)}</b></div>`).join('') || '<div class="empty">لا توجد بيانات بعد.</div>'}</div>
    </div>
    <div class="card"><h2>طلاب عليهم إنذار أو مستحقون للاستبعاد</h2>
      ${allFlags.length ? `<div class="scroll"><table><thead><tr><th>الطالب</th><th>الغياب</th><th>ممارسات غير منفّذة</th><th>الحالة</th></tr></thead><tbody>${allFlags.map(r => `<tr><td>${h(r.s.full_name)}</td><td>${n(r.pr.absences)}</td><td>${n(r.pr.missing)}</td><td><span class="chip ${r.pr.flag}">${FLAG[r.pr.flag]}</span></td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">لا يوجد طلاب عليهم إنذار.</div>'}
    </div>`;
  } catch (e) { fail(main, e); }
}

/* ---------- إدارة المستخدمين والأسابيع ---------- */
function parseBulk(text) {
  return text.split(/\r?\n/).map(l => l.trim()).filter(Boolean).map((line, i) => {
    const f = line.split(/\t|,|،|;/).map(x => x.trim()).filter(Boolean);
    const id = f.map(digits).find(x => /^[12]\d{9}$/.test(x));
    const phone = f.map(digits).find(x => /^05\d{8}$/.test(x));
    const texts = f.filter(x => digits(x).length < 5);
    const school = texts.find(t => C.SCHOOLS.includes(t)) || texts.find(t => /ثانوية|مدرسة|متوسطة/.test(t));
    const grade = texts.find(t => t !== school && /الأول|الثاني|الثالث|أول|ثاني|ثالث/.test(t));
    const name = texts.find(t => t !== school && t !== grade);
    return { line: i + 1, raw: line, id, phone, school, grade, name };
  });
}
/* ---------- Excel ---------- */
const XL_HEAD = ['الاسم الرباعي', 'رقم الهوية', 'رقم الجوال', 'المدرسة', 'الصف'];
function xlTemplate() {
  const a = document.createElement('a');
  a.href = 'assets/students-template.xlsx'; a.download = 'نموذج-استيراد-الطلاب.xlsx';
  document.body.appendChild(a); a.click(); a.remove();
  toast('حُمّل النموذج. احذف صف المثال الرمادي ثم أضف بيانات الطلاب.');
}
async function readExcel(file) {
  if (!window.XLSX) throw new Error('xlsx not loaded');
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: '' });
  const cell = v => typeof v === 'number' ? String(Math.round(v)) : String(v ?? '').trim();
  const hi = rows.findIndex(r => r.some(c => /اسم/.test(cell(c))) && r.some(c => /هوي|سجل/.test(cell(c))));
  let map = { name: 0, id: 1, phone: 2, school: 3, grade: 4 };
  if (hi >= 0) { const hr = rows[hi].map(cell), f = re => hr.findIndex(c => re.test(c)); map = { name: f(/اسم/), id: f(/هوي|سجل/), phone: f(/جوال|هاتف|جول/), school: f(/مدرس/), grade: f(/صف|مرحل/) }; }
  const existing = new Set((PG.all || []).map(u => u.username));
  const seen = new Set();
  return rows.slice(hi + 1).map((r, i) => ({ r, line: i + hi + 2 })).filter(x => x.r.some(c => cell(c))).map(({ r, line }) => {
    const g = k => map[k] >= 0 ? cell(r[map[k]]) : '';
    const id = digits(g('id')); let phone = digits(g('phone'));
    if (/^5\d{8}$/.test(phone)) phone = '0' + phone;
    if (/^9665\d{8}$/.test(phone)) phone = '0' + phone.slice(3);
    const name = g('name').replace(/\s+/g, ' ');
    let err = null;
    if (!name || name.split(' ').length < 2) err = 'الاسم ناقص';
    else if (!/^[12]\d{9}$/.test(id)) err = 'رقم الهوية غير صحيح';
    else if (phone && !/^05\d{8}$/.test(phone)) err = 'رقم الجوال غير صحيح';
    else if (existing.has(id)) err = 'مسجّل مسبقًا في المنصة';
    else if (seen.has(id)) err = 'مكرر في الملف';
    seen.add(id);
    return { line, name, id, phone, school: g('school'), grade: g('grade'), err };
  });
}
function xlPreview(rows) {
  const ok = rows.filter(r => !r.err).length, bad = rows.length - ok;
  return `<div class="card" id="xl-prev"><div class="prac-h"><h2 style="flex:1">مراجعة الملف قبل الإنشاء</h2><span class="chip ok">${n(ok)} صالح</span>${bad ? `<span class="chip bad">${n(bad)} فيه خطأ</span>` : ''}</div>
    <p class="sub">${bad ? 'الصفوف التي فيها خطأ لن تُنشأ. صحّحها في الملف وارفعه مرة أخرى، أو أكمل بالصفوف الصالحة.' : 'كل الصفوف سليمة.'}</p>
    <div class="scroll"><table><thead><tr><th>السطر</th><th>الاسم</th><th>رقم الهوية</th><th>الجوال</th><th>المدرسة</th><th>الصف</th><th>الحالة</th></tr></thead><tbody>
    ${rows.map(r => `<tr${r.err ? ' class="xl-bad"' : ''}><td>${n(r.line)}</td><td><b>${h(r.name || '—')}</b></td><td dir="ltr" style="text-align:right">${h(r.id || '—')}</td><td dir="ltr" style="text-align:right">${h(r.phone || '')}</td><td>${h(r.school)}</td><td>${h(r.grade)}</td><td>${r.err ? `<span class="chip bad">${h(r.err)}</span>` : '<span class="chip ok">جاهز</span>'}</td></tr>`).join('')}
    </tbody></table></div>
    <div class="actions">${ok ? `<button class="btn gold" data-act="xl-import">إنشاء ${n(ok)} حساب</button>` : ''}<button class="btn ghost" data-act="xl-cancel">إلغاء</button></div></div>`;
}
async function renderUsers() {
  const main = shell('users');
  try {
    const all = await q(sb.from('profiles').select('*').order('full_name'));
    await loadStaff();
    const specs = S.staff.filter(s => s.role === 'specialist');
    PG = { all, reload: renderUsers, tab: PG.tab || 'student', term: PG.term || '', bulk: PG.bulk || null, preview: PG.preview || null, xlSpec: PG.xlSpec || null };
    const specOpts = (cur, empty = 'بدون أخصائي') => `<option value="">${empty}</option>${specs.map(s => `<option value="${s.id}" ${s.id === cur ? 'selected' : ''}>${h(s.full_name)}</option>`).join('')}`;
    const cnt = r => all.filter(u => u.role === r && u.status !== 'pending').length;
    main.innerHTML = `
    <div class="head"><div class="grow"><h1>المستخدمون</h1><p>${n(cnt('student'))} مستفيد، ${n(cnt('specialist'))} أخصائي، ${n(cnt('admin'))} مدير</p></div></div>
    <div class="grid g2">
      <div class="card"><h2>إضافة حساب</h2><p class="sub">اسم الدخول رقم الهوية، وكلمة المرور الافتراضية <b>123456</b>.</p>
        <div class="grid">
          <div class="grid g2">
            <label class="field"><span>نوع الحساب</span><select id="nu-role" data-act-change="nu-role"><option value="student">مستفيد</option><option value="specialist">أخصائي</option><option value="observer">الشريك الاستشاري</option><option value="admin">مدير النظام</option></select></label>
            <label class="field"><span>رقم الهوية*</span><input type="text" id="nu-id" inputmode="numeric" dir="ltr" maxlength="10"></label>
          </div>
          <label class="field"><span>الاسم الرباعي*</span><input type="text" id="nu-name" maxlength="80"></label>
          <label class="field"><span>رقم الجوال</span><input type="tel" id="nu-phone" inputmode="numeric" dir="ltr" maxlength="10" placeholder="05xxxxxxxx"></label>
          <div class="grid g2" id="nu-st">
            <label class="field"><span>المدرسة</span><select id="nu-school">${C.SCHOOLS.map(x => `<option>${h(x)}</option>`).join('')}</select></label>
            <label class="field"><span>الصف</span><select id="nu-grade">${C.GRADES.map(x => `<option>${h(x)}</option>`).join('')}</select></label>
            <label class="field" style="grid-column:1/-1"><span>الأخصائي</span><select id="nu-spec">${specOpts(null)}</select></label>
          </div>
          <div class="actions" style="margin-top:0"><button class="btn" data-act="u-create">إنشاء الحساب</button></div>
        </div></div>
      <div class="card"><h2>استيراد الطلاب من ملف Excel</h2><p class="sub">حمّل النموذج، واكتب فيه بيانات الطلاب، ثم ارفعه هنا. تُنشأ الحسابات كلها دفعة واحدة بكلمة المرور 123456.</p>
        <div class="grid">
          <div class="xl-step"><span class="xl-n">1</span><div class="grow"><b>حمّل النموذج واملأه</b><div class="hint">الأعمدة: الاسم الرباعي، رقم الهوية، رقم الجوال، المدرسة، الصف.</div></div><button class="btn ghost sm" data-act="xl-template">⬇ تحميل النموذج</button></div>
          <div class="xl-step"><span class="xl-n">2</span><div class="grow"><b>اختر الأخصائي لهذه المجموعة</b><select id="nu-bulk-spec" style="margin-top:6px">${specOpts(PG.xlSpec || null)}</select></div></div>
          <div class="xl-step"><span class="xl-n">3</span><div class="grow"><b>ارفع الملف بعد تعبئته</b><input type="file" id="xl-file" data-act-change="xl-file" accept=".xlsx,.xls,.csv" style="margin-top:6px"></div></div>
          ${PG.bulk ? `<div class="sub-box"><b>${n(PG.bulk.ok)} حساب أُنشئ${PG.bulk.fail.length ? `، و${n(PG.bulk.fail.length)} لم يُنشأ` : ''}</b>${PG.bulk.fail.map(f => `<div class="hint">سطر ${f.line}: ${h(f.reason)}</div>`).join('')}</div>` : ''}
        </div></div>
    </div>
    ${PG.preview ? xlPreview(PG.preview) : ''}
    <div class="card"><div class="prac-h"><h2 style="flex:1">الحسابات</h2>
        <select data-act-change="u-tab" style="width:auto"><option value="student" ${PG.tab === 'student' ? 'selected' : ''}>المستفيدون</option><option value="specialist" ${PG.tab === 'specialist' ? 'selected' : ''}>الأخصائيون</option><option value="observer" ${PG.tab === 'observer' ? 'selected' : ''}>الشريك الاستشاري</option><option value="admin" ${PG.tab === 'admin' ? 'selected' : ''}>مديرو النظام</option></select>
        <input type="search" id="u-q" placeholder="ابحث بالاسم أو الهوية" value="${h(PG.term)}" style="max-width:220px"></div>
      <div class="scroll"><table><thead><tr><th>الاسم</th><th>رقم الهوية</th><th>الجوال</th>${PG.tab === 'student' ? '<th>الأخصائي</th>' : ''}<th>الحالة</th><th>كلمة المرور</th><th></th></tr></thead><tbody id="u-body"></tbody></table></div></div>`;
    const draw = () => {
      const t = PG.term.trim(), td = digits(t);
      const rows = all.filter(u => u.role === PG.tab && u.status !== 'pending' && (!t || u.full_name.includes(t) || (td && (u.username || '').includes(td))));
      $('u-body').innerHTML = rows.length ? rows.map(u => `<tr><td><b>${h(u.full_name)}</b>${u.school ? `<div class="hint">${h(u.school)}${u.grade ? ' — ' + h(u.grade) : ''}</div>` : ''}</td>
        <td dir="ltr" style="text-align:right">${h(u.username || '')}</td><td dir="ltr" style="text-align:right">${h(u.phone || '')}</td>
        ${PG.tab === 'student' ? `<td><select data-act-change="u-field" data-f="specialist_id" data-id="${u.id}">${specOpts(u.specialist_id)}</select></td>` : ''}
        <td><select data-act-change="u-field" data-f="status" data-id="${u.id}" ${u.id === S.me.id ? 'disabled' : ''}><option value="active" ${u.status === 'active' ? 'selected' : ''}>مفعّل</option><option value="excluded" ${u.status === 'excluded' ? 'selected' : ''}>${u.role === 'student' ? 'مستبعد' : 'موقوف'}</option></select></td>
        <td>${u.must_change_password ? '<span class="chip warn">افتراضية</span>' : '<span class="chip ok">غيّرها</span>'}</td>
        <td style="white-space:nowrap">${u.id === S.me.id ? '' : `<button class="btn ghost sm" data-act="u-reset" data-id="${u.id}">إعادة تعيين</button> <button class="btn no sm" data-act="u-delete" data-id="${u.id}">حذف</button>`}</td></tr>`).join('')
        : `<tr><td colspan="7" class="empty">لا توجد حسابات.</td></tr>`;
    };
    draw();
    $('u-q').addEventListener('input', e => { PG.term = e.target.value; draw(); });
    PG.draw = draw;
  } catch (e) { fail(main, e); }
}
function armed(b, label) {
  if (b.dataset.armed) return true;
  const t = b.textContent; b.dataset.armed = 1; b.textContent = label || 'اضغط للتأكيد';
  setTimeout(() => { if (b.isConnected) { delete b.dataset.armed; b.textContent = t; } }, 3000);
  return false;
}
async function renderWeeksAdmin() {
  const main = shell('weeks');
  try {
    const weeks = await loadWeeks(true);
    const st = await loadSettings() || {};
    main.innerHTML = `<div class="head"><div class="grow"><h1>أسابيع البرنامج</h1><p>عدّل المواضيع والتواريخ إذا تغيّر الجدول.</p></div></div>
    ${settingsCard(st)}
    ${weeks.map(w => `<div class="card"><div class="grid g4">
      <label class="field"><span>الأسبوع ${w.id} — الموضوع</span><input type="text" id="wt-${w.id}" value="${h(w.title)}"></label>
      <label class="field"><span>الجدارة</span><input type="text" id="wc-${w.id}" value="${h(w.competency)}"></label>
      <label class="field"><span>تاريخ اللقاء (ميلادي)</span><input type="date" id="wd-${w.id}" value="${h(w.meeting_date)}"></label>
      <label class="field"><span>التاريخ الهجري</span><input type="text" id="wh-${w.id}" value="${h(w.hijri_date || '')}"></label></div>
      <div class="actions"><input type="text" id="wn-${w.id}" value="${h(w.note || '')}" placeholder="ملاحظة (مثل: زيارة ميدانية)" style="flex:1;min-width:200px"><button class="btn sm" data-act="w-save" data-id="${w.id}">حفظ</button></div></div>`).join('')}`;
  } catch (e) { fail(main, e); }
}

/* ---------- لوحة الأوائل ---------- */
async function renderLeaders() {
  const main = shell('leaders');
  try {
    const rows = await q(sb.rpc('leaderboard'));
    let rank = 0, prev = null;
    rows.forEach((r, i) => { r.total = +r.total || 0; if (r.total !== prev) { rank = i + 1; prev = r.total; } r.rank = rank; });
    const isStudent = S.me.role === 'student';
    const me = rows.find(r => r.student_id === S.me.id);
    const any = rows.some(r => r.total > 0);
    const avg = rows.length ? rows.reduce((a, r) => a + r.total, 0) / rows.length : 0;
    const sumP = rows.reduce((a, r) => a + r.practices, 0), sumA = rows.reduce((a, r) => a + r.attended, 0);
    const bySchool = {};
    rows.forEach(r => { const k = r.school || 'غير محدد'; (bySchool[k] = bySchool[k] || { n: 0, t: 0 }); bySchool[k].n++; bySchool[k].t += r.total; });
    const schools = Object.entries(bySchool).map(([k, v]) => ({ k, n: v.n, avg: v.t / v.n })).sort((a, b) => b.avg - a.avg);
    const maxS = Math.max(1, ...schools.map(x => x.avg));
    const medal = ['🥇', '🥈', '🥉'];
    const top = rows.slice(0, 3);
    const order = top.length === 3 ? [top[1], top[0], top[2]] : top;
    const list = isStudent ? rows.slice(3, 10) : rows.slice(3);
    const mine = r => r.student_id === S.me.id ? ' me' : '';
    main.innerHTML = `
    <div ${heroAttr(12)}><div class="grow"><h1>لوحة الأوائل</h1><p>ترتيب جميع المشاركين حسب مجموع الدرجات: الحضور والممارسات المقبولة</p></div></div>
    <div class="kpis">
      <div class="kpi hero"><b>${n(rows.length)}</b><span>مشارك في البرنامج</span></div>
      <div class="kpi"><b>${n(rows[0] ? rows[0].total : 0)}</b><span>أعلى مجموع</span></div>
      <div class="kpi"><b>${n(avg)}</b><span>متوسط المجموع</span></div>
      <div class="kpi"><b>${n(sumP)}</b><span>ممارسة مقبولة</span></div>
      <div class="kpi"><b>${n(sumA)}</b><span>حضور مسجّل</span></div>
    </div>
    ${isStudent && me ? `<div class="card myrank"><div class="rank-big">${n(me.rank)}</div><div class="grow"><h2>ترتيبك من ${n(rows.length)} مشاركًا</h2><p class="sub" style="margin:0">مجموعك ${n(me.total)} درجة — حضرت ${n(me.attended)} ${me.attended === 1 ? 'لقاءً' : 'لقاءات'}، ولك ${n(me.practices)} ممارسة مقبولة.${(() => { const up = rows.filter(r => r.total > me.total); return up.length ? ` يفصلك عن المركز ${n(up[up.length - 1].rank)} ${n(up[up.length - 1].total - me.total)} درجة.` : ' أنت في الصدارة، حافظ عليها!'; })()}</p></div></div>` : ''}
    ${!any ? `<div class="card empty">ستظهر لوحة الأوائل بعد أول لقاء واعتماد أول ممارسات.</div>` : `
    <div class="podium">${order.map(r => { const i = top.indexOf(r); return `<div class="pod p${i + 1}${mine(r)}"><div class="medal">${medal[i]}</div><b>${h(r.full_name)}</b><span class="hint">${h(r.school || '')}</span><div class="pod-score">${n(r.total)}<small> درجة</small></div><div class="pod-bar">${n(r.rank)}</div></div>`; }).join('')}</div>
    ${list.length ? `<div class="card"><h2>${isStudent ? 'المراكز من الرابع إلى العاشر' : 'بقية الترتيب'}</h2><div class="scroll"><table><thead><tr><th>المركز</th><th>المشارك</th><th>الحضور</th><th>⭐ مبكر</th><th>ممارسات مقبولة</th><th>المجموع</th></tr></thead><tbody>
      ${list.map(r => `<tr class="${mine(r).trim()}"><td><span class="rank-chip">${n(r.rank)}</span></td><td><b>${h(r.full_name)}</b><div class="hint">${h(r.school || '')}</div></td><td>${n(r.attended)}</td><td>${n(r.early || 0)}</td><td>${n(r.practices)}</td><td class="num">${n(r.total)}</td></tr>`).join('')}
    </tbody></table></div></div>` : ''}
    <div class="card"><h2>ترتيب المدارس</h2><p class="sub">متوسط مجموع طلاب كل مدرسة.</p><div class="bars">
      ${schools.map(x => `<div class="bar-row school"><span>${h(x.k)} <small class="hint">(${n(x.n)})</small></span><span class="meter"><i class="gold" style="width:${pct(x.avg, maxS)}%"></i></span><b>${n(x.avg)}</b></div>`).join('')}
    </div></div>`}`;
  } catch (e) { fail(main, e); }
}

/* ---------- إعدادات موقع التحضير ---------- */
function settingsCard(st) {
  const t = v => (v || '').slice(0, 5);
  return `<div class="card"><h2>⚙️ إعدادات التحضير والرفع</h2><h3 class="set-h" style="margin-top:10px">📍 موقع التحضير الذاتي</h3><p class="sub">يسجّل الطالب حضوره يوم اللقاء إذا كان داخل هذا النطاق. أدق طريقة لضبطه: افتح هذه الصفحة من جوالك وأنت داخل المقر، ثم اضغط «استخدم موقعي الحالي» ثم «حفظ».</p>
    <div class="grid g3">
      <label class="field"><span>اسم المقر</span><input type="text" id="set-name" value="${h(st.place_name || '')}"></label>
      <label class="field"><span>خط العرض</span><input type="text" id="set-lat" dir="ltr" inputmode="decimal" value="${st.checkin_lat ?? ''}"></label>
      <label class="field"><span>خط الطول</span><input type="text" id="set-lng" dir="ltr" inputmode="decimal" value="${st.checkin_lng ?? ''}"></label>
      <label class="field"><span>نطاق السماح (متر)</span><input type="number" id="set-r" min="30" max="2000" value="${st.checkin_radius_m ?? 200}"></label>
      <label class="field"><span>التحضير متاح من الساعة</span><input type="time" id="set-from" value="${t(st.checkin_from) || '00:00'}"></label>
      <label class="field"><span>إلى الساعة</span><input type="time" id="set-to" value="${t(st.checkin_to) || '23:59'}"></label>
    </div>
    <h3 class="set-h">⭐ فترات الحضور ودرجاتها</h3><p class="sub">تُحسب درجة الحضور تلقائيًا من وقت التحضير: <b>مبكر 30</b>، ثم <b>فترة العصر 20</b>، ثم <b>فترة المغرب 10</b>. حدّث نهاية فترة العصر مع تغيّر وقت أذان المغرب.</p>
    <div class="grid g3">
      <label class="field"><span>المبكر (30) من الساعة</span><input type="time" id="set-efrom" value="${t(st.early_from) || '15:30'}"></label>
      <label class="field"><span>المبكر (30) حتى الساعة</span><input type="time" id="set-euntil" value="${t(st.early_until) || '16:30'}"></label>
      <label class="field"><span>العصر (20) حتى الساعة، وبعدها المغرب (10)</span><input type="time" id="set-asr" value="${t(st.asr_until) || '17:20'}"></label>
    </div>
    <h3 class="set-h">📤 رفع الممارسات</h3>
    <label class="check"><input type="checkbox" id="set-limit" ${st.limit_submission_window ? 'checked' : ''}> تقييد الرفع من يوم اللقاء حتى الأحد التالي فقط <span class="hint">(عند إلغاء التحديد يبقى الرفع مفتوحًا للطالب في أي وقت)</span></label>
    <div class="actions"><button class="btn ghost sm" data-act="set-here">📍 استخدم موقعي الحالي</button>
      ${st.checkin_lat ? `<a class="btn ghost sm" target="_blank" rel="noopener" href="https://www.google.com/maps?q=${+st.checkin_lat},${+st.checkin_lng}">عرض على الخريطة</a>` : ''}
      <button class="btn sm" data-act="set-save">حفظ الإعدادات</button></div></div>`;
}
async function setHere(btn) {
  if (!navigator.geolocation) return toast('جهازك لا يدعم تحديد الموقع.', true);
  btn.disabled = true;
  try {
    const pos = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }));
    $('set-lat').value = pos.coords.latitude.toFixed(7); $('set-lng').value = pos.coords.longitude.toFixed(7);
    toast(`حُدّد موقعك بدقة ${n(Math.round(pos.coords.accuracy))} متر تقريبًا. اضغط «حفظ الإعدادات».`);
  } catch (e) { toast(geoError(e), true); }
  finally { btn.disabled = false; }
}
function saveSettings(btn) {
  const lat = parseFloat(toLatin(val('set-lat'))), lng = parseFloat(toLatin(val('set-lng'))), r = +val('set-r');
  if (!(lat > -90 && lat < 90) || !(lng > -180 && lng < 180)) return toast('الإحداثيات غير صحيحة.', true);
  if (!(r >= 30 && r <= 2000)) return toast('نطاق السماح بين 30 و2000 متر.', true);
  const from = val('set-from') || '00:00', to = val('set-to') || '23:59';
  if (from >= to) return toast('وقت البداية يجب أن يكون قبل وقت النهاية.', true);
  if (val('set-efrom') && val('set-euntil') && val('set-efrom') >= val('set-euntil')) return toast('بداية الحضور المبكر يجب أن تكون قبل نهايته.', true);
  if (val('set-euntil') && val('set-asr') && val('set-euntil') >= val('set-asr')) return toast('نهاية فترة العصر يجب أن تكون بعد نهاية الحضور المبكر.', true);
  busy(btn, async () => {
    await q(sb.from('settings').update({ place_name: val('set-name') || 'مقر البرنامج', checkin_lat: lat, checkin_lng: lng, checkin_radius_m: r, checkin_from: from, checkin_to: to, early_from: val('set-efrom') || null, early_until: val('set-euntil') || null, asr_until: val('set-asr') || null, limit_submission_window: $('set-limit').checked }).eq('id', 1));
    await renderWeeksAdmin();
  }, 'حُفظت إعدادات التحضير.');
}

/* ---------- متابعة الأخصائيين ---------- */
function fmtHours(x) {
  if (x == null) return '—';
  return x < 24 ? `${n(Math.max(1, Math.round(x)))} ساعة` : `${n(Math.round(x / 24 * 10) / 10)} يوم`;
}
async function renderSpecialists() {
  const main = shell('specialists');
  try {
    const d = await staffData();
    const sheets = await q(sb.from('attendance_sheets').select('week_id,uploaded_by').range(0, 9999)).catch(() => []);
    const specs = S.staff.filter(x => x.role === 'specialist');
    const startedW = d.weeks.filter(started);
    const now = Date.now();
    const rows = specs.map(sp => {
      const st = d.students.filter(x => x.specialist_id === sp.id && x.status === 'active');
      const ids = new Set(st.map(x => x.id));
      const subs = d.subs.filter(x => ids.has(x.student_id));
      const reviewed = subs.filter(x => x.status !== 'pending');
      const pending = subs.filter(x => x.status === 'pending');
      const late = pending.filter(x => now - new Date(x.created_at) > 3 * 864e5).length;
      const times = reviewed.filter(x => x.reviewed_at).map(x => (new Date(x.reviewed_at) - new Date(x.created_at)) / 36e5).filter(x => x >= 0);
      const avgH = times.length ? times.reduce((a, b) => a + b, 0) / times.length : null;
      const weeksMarked = startedW.filter(w => st.some(x => d.ix.at.has(x.id + '|' + w.id))).length;
      const sheetsN = new Set(sheets.filter(x => x.uploaded_by === sp.id).map(x => x.week_id)).size;
      const prs = st.map(x => ({ s: x, pr: progress(x.id, d.weeks, d.ix) })).sort((a, b) => b.pr.total - a.pr.total);
      const presents = prs.reduce((a, r) => a + r.pr.presents, 0);
      const avgTotal = prs.length ? prs.reduce((a, r) => a + r.pr.total, 0) / prs.length : 0;
      return { sp, st, prs, reviewed: reviewed.length, pending: pending.length, late, avgH, weeksMarked, sheetsN, avgTotal,
        attRate: pct(presents, st.length * startedW.length), flagged: prs.filter(r => r.pr.flag !== 'ok').length };
    });
    const unassigned = d.students.filter(x => x.status === 'active' && !x.specialist_id).length;
    const allTimes = rows.filter(r => r.avgH != null);
    const avgAll = allTimes.length ? allTimes.reduce((a, r) => a + r.avgH, 0) / allTimes.length : null;
    main.innerHTML = `
    <div class="head"><div class="grow"><h1>متابعة الأخصائيين</h1><p>التحضير، ومراجعة الممارسات، وأداء طلاب كل أخصائي</p></div></div>
    <div class="kpis">
      <div class="kpi hero"><b>${n(specs.length)}</b><span>أخصائي</span></div>
      <div class="kpi"><b>${n(rows.reduce((a, r) => a + r.pending, 0))}</b><span>ممارسة بانتظار المراجعة</span></div>
      <div class="kpi"><b>${n(rows.reduce((a, r) => a + r.late, 0))}</b><span>متأخرة أكثر من 3 أيام</span></div>
      <div class="kpi"><b>${fmtHours(avgAll)}</b><span>متوسط سرعة المراجعة</span></div>
    </div>
    ${unassigned ? `<div class="banner warn"><b>${n(unassigned)} طالب بدون أخصائي</b>يربطهم مدير النظام بأخصائي من صفحة المستخدمين.</div>` : ''}
    <div class="card"><h2>مقارنة الأخصائيين</h2><div class="scroll"><table><thead><tr>
      <th>الأخصائي</th><th>الطلاب</th><th>الأسابيع المحضّرة</th><th>كشوف مرفوعة</th><th>ممارسات روجعت</th><th>بانتظار المراجعة</th><th>سرعة المراجعة</th><th>نسبة الحضور</th><th>متوسط درجات طلابه</th><th>عليهم إنذار</th></tr></thead><tbody>
      ${rows.length ? rows.map(r => `<tr><td><b>${h(r.sp.full_name)}</b></td><td>${n(r.st.length)}</td>
        <td><span class="chip ${r.weeksMarked < startedW.length ? 'warn' : 'ok'}">${n(r.weeksMarked)}/${n(startedW.length)}</span></td>
        <td>${n(r.sheetsN)}</td><td>${n(r.reviewed)}</td>
        <td>${n(r.pending)}${r.late ? ` <span class="chip bad">${n(r.late)} متأخرة</span>` : ''}</td>
        <td>${fmtHours(r.avgH)}</td><td>${r.st.length && startedW.length ? r.attRate + '٪' : '—'}</td>
        <td class="num">${n(r.avgTotal)}</td><td>${r.flagged ? `<span class="chip warn">${n(r.flagged)}</span>` : '0'}</td></tr>`).join('')
        : '<tr><td colspan="10" class="empty">لا يوجد أخصائيون بعد.</td></tr>'}
    </tbody></table></div></div>
    ${rows.map(r => `<details class="card spec"><summary><b>${h(r.sp.full_name)}</b><span class="chip">${n(r.st.length)} طالب</span>${r.pending ? `<span class="chip warn">${n(r.pending)} بانتظار المراجعة</span>` : ''}</summary>
      ${r.prs.length ? `<div class="scroll" style="margin-top:12px"><table><thead><tr><th>الطالب</th><th>الحضور</th><th>ممارسات مقبولة</th><th>غير منفّذة</th><th>المجموع</th><th>الحالة</th></tr></thead><tbody>
      ${r.prs.map(x => `<tr class="click" data-go="#/student/${x.s.id}"><td><b>${h(x.s.full_name)}</b><div class="hint">${h(x.s.school || '')}</div></td><td>${n(x.pr.presents)}/${n(x.pr.startedWeeks)}</td><td>${n(x.pr.approved)}</td><td>${n(x.pr.missing)}</td><td class="num">${n(x.pr.total)}</td><td><span class="chip ${x.pr.flag}">${FLAG[x.pr.flag]}</span></td></tr>`).join('')}
      </tbody></table></div>` : '<div class="empty">لا يوجد طلاب مرتبطون بهذا الأخصائي.</div>'}</details>`).join('')}`;
  } catch (e) { fail(main, e); }
}

/* ---------- الوسائط ---------- */
async function compressImage(file, max = 1600, quality = 0.82) {
  if (!/^image\/(jpeg|png|webp)$/i.test(file.type) || !window.createImageBitmap) return file;
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', quality));
    return blob && blob.size < file.size ? new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' }) : file;
  } catch { return file; }
}
async function renderMedia() {
  const main = shell('media');
  try {
    const weeks = await loadWeeks();
    PG.mw = PG.mw || 'all';
    let x = sb.from('media_items').select('*').order('created_at', { ascending: false }).range(0, 499);
    if (PG.mw !== 'all') x = x.eq('week_id', +PG.mw);
    const items = await q(x);
    const paths = items.filter(i => i.file_path).map(i => i.file_path);
    const urls = {};
    if (paths.length) { const r = await q(sb.storage.from('media').createSignedUrls(paths, 3600)); (r || []).forEach(o => { if (o.signedUrl) urls[o.path] = o.signedUrl; }); }
    PG = { ...PG, items, urls, photoList: items.filter(i => i.kind === 'photo' && urls[i.file_path]).map(i => urls[i.file_path]), reload: renderMedia };
    const canAdd = isStaff();
    const wName = id => { const w = weeks.find(z => z.id === id); return w ? `الأسبوع ${w.id}` : 'عام'; };
    const nP = items.filter(i => i.kind === 'photo').length, nV = items.length - nP;
    main.innerHTML = `
    <div class="head"><div class="grow"><h1>📷 الوسائط</h1><p>صور ومقاطع لقاءات البرنامج وزياراته</p></div>
      <label>الأسبوع <select data-act-change="media-week"><option value="all">الكل</option>${weeks.map(w => `<option value="${w.id}" ${String(w.id) === PG.mw ? 'selected' : ''}>الأسبوع ${w.id}</option>`).join('')}</select></label></div>
    <div class="kpis"><div class="kpi hero"><b>${n(nP)}</b><span>صورة</span></div><div class="kpi"><b>${n(nV)}</b><span>مقطع</span></div></div>
    ${canAdd ? `<div class="card"><h2>إضافة وسائط</h2><p class="sub">الصور تُصغَّر تلقائيًا قبل الرفع لتوفير المساحة. المقاطع حتى 50 ميجابايت، والأفضل رفع المقاطع الطويلة على يوتيوب ووضع رابطها هنا.</p>
      <div class="grid g3">
        <label class="field"><span>الأسبوع</span><select id="m-week"><option value="">عام</option>${weeks.map(w => `<option value="${w.id}" ${String(w.id) === PG.mw ? 'selected' : ''}>الأسبوع ${w.id}: ${h(w.title)}</option>`).join('')}</select></label>
        <label class="field"><span>العنوان (اختياري)</span><input type="text" id="m-title" maxlength="120" placeholder="مثال: زيارة قيادة الذات"></label>
        <label class="field"><span>صور أو مقاطع</span><input type="file" id="m-files" multiple accept="image/*,video/*"></label>
      </div>
      <div class="actions"><input type="url" id="m-url" dir="ltr" placeholder="أو رابط مقطع (يوتيوب / درايف)" style="flex:1;min-width:220px"><button class="btn" data-act="media-up">رفع</button></div></div>` : ''}
    ${items.length ? `<div class="media-grid">${items.map((it, i) => `<figure class="m-item">
        <button class="m-thumb ${it.kind}" data-act="media-open" data-i="${i}" aria-label="عرض">${it.kind === 'photo' && urls[it.file_path] ? `<img src="${h(urls[it.file_path])}" alt="" loading="lazy">` : `<span class="m-ico">${it.kind === 'video' ? '▶' : '🔗'}</span>`}</button>
        <figcaption><b>${h(it.title || (it.kind === 'photo' ? 'صورة' : it.kind === 'video' ? 'مقطع' : 'رابط مقطع'))}</b><span class="hint">${wName(it.week_id)}</span>
        ${canAdd && (S.me.role === 'admin' || it.uploaded_by === S.me.id) ? `<button class="linkish m-del" data-act="media-del" data-id="${it.id}">حذف</button>` : ''}</figcaption></figure>`).join('')}</div>`
      : `<div class="card empty">لا توجد وسائط ${PG.mw === 'all' ? 'بعد' : 'لهذا الأسبوع'}.</div>`}`;
  } catch (e) { fail(main, e); }
}
async function mediaUpload(btn) {
  const files = [...($('m-files').files || [])], link = val('m-url'), week = val('m-week') ? +val('m-week') : null, title = val('m-title') || null;
  if (!files.length && !link) return toast('اختر صورًا أو مقاطع، أو ضع رابط مقطع.', true);
  if (link && !/^https?:\/\//i.test(link)) return toast('يجب أن يبدأ الرابط بـ https://', true);
  const big = files.find(f => /^video\//.test(f.type) && f.size > 50 * 1024 * 1024);
  if (big) return toast(`المقطع «${big.name}» أكبر من 50 ميجابايت. ارفعه على يوتيوب وضع رابطه.`, true);
  await busy(btn, async () => {
    let i = 0;
    for (const f0 of files) {
      i++; btn.textContent = `جارٍ الرفع ${n(i)} من ${n(files.length)}…`;
      const isVid = /^video\//.test(f0.type);
      const f = isVid ? f0 : await compressImage(f0);
      const path = `${week || 'general'}/${Date.now()}-${i}.${safeExt(f.name)}`;
      await q(sb.storage.from('media').upload(path, f, { contentType: f.type || undefined }));
      await q(sb.from('media_items').insert({ week_id: week, title, kind: isVid ? 'video' : 'photo', file_path: path, file_name: f0.name.slice(0, 120), uploaded_by: S.me.id }));
    }
    if (link) await q(sb.from('media_items').insert({ week_id: week, title, kind: 'link', url: link, uploaded_by: S.me.id }));
    await renderMedia();
  }, 'تم الرفع.');
}

/* ---------- النشر الإعلامي ---------- */
const PLAT = { x: { name: 'إكس', ico: '𝕏' }, youtube: { name: 'يوتيوب', ico: '▶' } };
function platformOf(url) {
  if (/^https?:\/\/(www\.|mobile\.)?(x|twitter)\.com\//i.test(url)) return 'x';
  if (/^https?:\/\/(www\.|m\.)?(youtube\.com|youtu\.be)\//i.test(url)) return 'youtube';
  return null;
}
async function renderPosts() {
  const main = shell('posts');
  try {
    const weeks = await loadWeeks();
    const all = await q(sb.from('media_posts').select('*').order('posted_on', { ascending: false }).range(0, 999));
    PG.pw = PG.pw || 'all';
    const list = PG.pw === 'all' ? all : all.filter(p => String(p.week_id) === PG.pw);
    const canAdd = isStaff(), cw = currentWeek(weeks);
    const cnt = (arr, pl) => arr.filter(p => p.platform === pl).length;
    main.innerHTML = `
    <div class="head"><div class="grow"><h1>📣 النشر الإعلامي الأسبوعي</h1><p>روابط ما نُشر عن البرنامج في منصتي إكس ويوتيوب</p></div>
      <label>الأسبوع <select data-act-change="post-week"><option value="all">الكل</option>${weeks.map(w => `<option value="${w.id}" ${String(w.id) === PG.pw ? 'selected' : ''}>الأسبوع ${w.id}</option>`).join('')}</select></label></div>
    <div class="kpis">
      <div class="kpi hero"><b>${n(all.length)}</b><span>منشور إجمالًا</span></div>
      <div class="kpi"><b>${n(cnt(all, 'x'))}</b><span>على إكس</span></div>
      <div class="kpi"><b>${n(cnt(all, 'youtube'))}</b><span>على يوتيوب</span></div>
      <div class="kpi"><b>${n(weeks.filter(started).filter(w => !all.some(p => p.week_id === w.id)).length)}</b><span>أسبوع بدأ بلا نشر</span></div>
    </div>
    ${canAdd ? `<div class="card"><h2>إضافة منشور</h2><p class="sub">الصق رابط المنشور من إكس أو يوتيوب، وتُحدَّد المنصة تلقائيًا من الرابط.</p>
      <div class="grid g3">
        <label class="field"><span>رابط المنشور*</span><input type="url" id="p-url" dir="ltr" placeholder="https://x.com/... أو https://youtu.be/..."></label>
        <label class="field"><span>الأسبوع</span><select id="p-week">${weeks.map(w => `<option value="${w.id}" ${w.id === cw.id ? 'selected' : ''}>الأسبوع ${w.id}: ${h(w.title)}</option>`).join('')}</select></label>
        <label class="field"><span>تاريخ النشر</span><input type="date" id="p-date" value="${todayStr()}"></label>
      </div>
      <div class="actions"><input type="text" id="p-title" maxlength="140" placeholder="وصف مختصر للمنشور (اختياري)" style="flex:1;min-width:220px"><button class="btn" data-act="post-add">إضافة</button></div></div>` : ''}
    <div class="card"><h2>المنشورات حسب الأسابيع</h2><div class="scroll"><table><thead><tr><th>الأسبوع</th><th>𝕏 إكس</th><th>▶ يوتيوب</th><th>الحالة</th></tr></thead><tbody>
      ${weeks.map(w => { const ps = all.filter(p => p.week_id === w.id); return `<tr><td><b>الأسبوع ${w.id}</b><div class="hint">${h(w.title)}</div></td><td>${n(cnt(ps, 'x'))}</td><td>${n(cnt(ps, 'youtube'))}</td><td>${!started(w) ? '<span class="chip none">لم يبدأ</span>' : ps.length ? '<span class="chip ok">تم النشر</span>' : '<span class="chip warn">لا يوجد نشر</span>'}</td></tr>`; }).join('')}
    </tbody></table></div></div>
    <div class="card"><h2>${PG.pw === 'all' ? 'كل المنشورات' : 'منشورات الأسبوع ' + PG.pw}</h2>
      ${list.length ? list.map(p => `<div class="row-line"><span class="plat ${p.platform}">${PLAT[p.platform].ico}</span><div class="grow"><a href="${h(p.url)}" target="_blank" rel="noopener"><b>${h(p.title || 'منشور على ' + PLAT[p.platform].name)}</b></a><div class="hint">${PLAT[p.platform].name} — الأسبوع ${p.week_id || '—'} — ${fmtDate(p.posted_on)}</div></div>
        ${canAdd && (S.me.role === 'admin' || p.created_by === S.me.id) ? `<button class="btn no sm" data-act="post-del" data-id="${p.id}">حذف</button>` : ''}</div>`).join('') : '<div class="empty">لا توجد منشورات بعد.</div>'}</div>`;
  } catch (e) { fail(main, e); }
}
function postAdd(btn) {
  const url = val('p-url'), pl = platformOf(url);
  if (!pl) return toast('الرابط يجب أن يكون من إكس (x.com) أو يوتيوب (youtube.com / youtu.be).', true);
  busy(btn, async () => {
    await q(sb.from('media_posts').insert({ url, platform: pl, week_id: +val('p-week'), posted_on: val('p-date') || todayStr(), title: val('p-title') || null, created_by: S.me.id }));
    await renderPosts();
  }, 'أُضيف المنشور.');
}

/* ---------- التقييمات ---------- */
function scale(name, val, labels) {
  return `<div class="scale" role="radiogroup">${[1, 2, 3, 4, 5].map(v => `<label${labels ? ` title="${h(labels[v - 1])}"` : ''}><input type="radio" name="${name}" value="${v}" ${+val === v ? 'checked' : ''}><span>${v}</span></label>`).join('')}</div>`;
}
const stars = v => `<span class="stars">${'★'.repeat(v)}<i>${'★'.repeat(5 - v)}</i></span>`;
function dayRatingCard(w) {
  const v = PG.dayFb && PG.dayFb.answers && +PG.dayFb.answers.q1;
  return `<div class="card rate-card" id="day-card"><h2>⭐ قيّم لقاء الأسبوع ${w.id}</h2><p class="sub">${h(C.DAY_QUESTION)} <span class="hint">(1 منخفض، 5 مرتفع)</span></p>
    <div class="scale big">${[1, 2, 3, 4, 5].map(x => `<button class="${v === x ? 'on' : ''}" data-act="rate-day" data-w="${w.id}" data-v="${x}">${x}</button>`).join('')}</div>
    ${v ? `<p class="hint" style="margin:8px 0 0">قيّمته ${v} من 5، ويمكنك تغيير تقييمك.</p>` : ''}</div>`;
}
function surveyCards(weeks, st, fbs) {
  const done = (t, r) => (fbs || []).some(f => f.type === t && f.ref === r);
  const cards = [];
  if (st && st.pre_open && !done('pre', 'main')) cards.push(['📝 القياس القبلي', 'قبل أن تبدأ رحلتك في البرنامج، أجب عن عبارات قصيرة تقيس جداراتك القيادية الآن.', '#/survey/pre/main', 'ابدأ القياس']);
  if (st && st.post_open && !done('post', 'main')) cards.push(['🏁 القياس البعدي', 'في ختام البرنامج، أجب عن نفس العبارات لنقيس أثر البرنامج عليك.', '#/survey/post/main', 'ابدأ القياس']);
  (C.COMPETENCIES || []).forEach(c => {
    const last = weeks.find(w => w.id === c.weeks[c.weeks.length - 1]);
    if (last && started(last) && !done('competency', c.key)) cards.push([`⭐ تقييم ${c.name}`, 'انتهت هذه الجدارة. شاركنا رأيك في المدرب والمحتوى وبيئة التدريب.', `#/survey/competency/${c.key}`, 'قيّم الجدارة']);
  });
  return cards.map(([t, p, href, btn]) => `<div class="card survey-card"><div class="grow"><h2>${t}</h2><p class="sub" style="margin:0">${p}</p></div><a class="btn gold" href="${href}">${btn}</a></div>`).join('');
}
function surveyDef(type, ref) {
  if (type === 'pre' || type === 'post') return {
    title: type === 'pre' ? '📝 القياس القبلي' : '🏁 القياس البعدي',
    intro: 'اقرأ كل عبارة، واختر مدى انطباقها عليك الآن بصدق. لا توجد إجابة صحيحة أو خاطئة، والهدف قياس أثر البرنامج.',
    labels: C.PREPOST_SCALE, comment: false,
    groups: C.PREPOST.map(g => ({ name: g.name, items: g.items.map((t, i) => ({ id: g.key + (i + 1), t })) }))
  };
  const c = (C.COMPETENCIES || []).find(x => x.key === ref);
  if (type === 'competency' && c) return {
    title: `⭐ تقييم ${c.name}`, intro: 'قيّم كل عبارة من 1 (منخفض) إلى 5 (مرتفع).', labels: null, comment: true,
    groups: C.COMPETENCY_EVAL.map((g, gi) => ({ name: g.group, items: g.items.map((t, i) => ({ id: 'g' + gi + '_' + i, t })) }))
  };
  return null;
}
async function renderSurvey(main, type, ref) {
  const d = surveyDef(type, ref);
  if (!d) { location.hash = '#/home'; return; }
  const [st, ex] = await Promise.all([loadSettings(), q(sb.from('feedback').select('id').eq('student_id', S.me.id).eq('type', type).eq('ref', ref))]);
  const back = `<div class="actions"><a class="btn" href="#/home">الرجوع إلى إنجازي</a></div>`;
  if (ex.length) { main.innerHTML = `<div class="card empty"><h2>شكرًا لك 🌟</h2><p>أرسلت هذا التقييم من قبل.</p>${back}</div>`; return; }
  if ((type === 'pre' || type === 'post') && !(st && st[type + '_open'])) { main.innerHTML = `<div class="card empty"><h2>${d.title}</h2><p>هذا القياس غير متاح حاليًا.</p>${back}</div>`; return; }
  PG = { survey: { type, ref, ids: d.groups.flatMap(g => g.items.map(i => i.id)) } };
  let k = 0;
  main.innerHTML = `
  <div class="head"><div class="grow"><h1>${d.title}</h1><p>${h(d.intro)}</p></div></div>
  ${d.labels ? `<div class="sv-legend">${d.labels.map((l, i) => `<span><b>${i + 1}</b> ${h(l)}</span>`).join('')}</div>` : ''}
  <div class="card">${d.groups.map(g => `<h3 class="sv-group">${h(g.name)}</h3>${g.items.map(it => `<div class="sv-item" id="sv-row-${it.id}"><p><span class="sv-n">${n(++k)}</span>${h(it.t)}</p>${scale('sv-' + it.id, null, d.labels)}</div>`).join('')}`).join('')}
    ${d.comment ? `<label class="field" style="margin-top:16px"><span>ما أبرز ما استفدته؟ وما مقترحاتك للتحسين؟ (اختياري)</span><textarea id="sv-comment" maxlength="1500"></textarea></label>` : ''}
    <div class="actions"><button class="btn gold" data-act="survey-send">إرسال</button><a class="btn ghost" href="#/home">لاحقًا</a></div></div>`;
}
function surveySend(btn) {
  const sv = PG.survey; if (!sv) return;
  const answers = {}, missing = [];
  sv.ids.forEach(id => { const r = document.querySelector(`input[name="sv-${id}"]:checked`); if (r) answers[id] = +r.value; else missing.push(id); });
  document.querySelectorAll('.sv-item.miss').forEach(e => e.classList.remove('miss'));
  if (missing.length) {
    missing.forEach(id => { const e = $('sv-row-' + id); if (e) e.classList.add('miss'); });
    $('sv-row-' + missing[0]).scrollIntoView({ behavior: 'smooth', block: 'center' });
    return toast(`بقيت ${n(missing.length)} ${missing.length === 1 ? 'عبارة' : 'عبارات'} دون إجابة.`, true);
  }
  busy(btn, async () => {
    await q(sb.from('feedback').insert({ student_id: S.me.id, type: sv.type, ref: sv.ref, answers, comment: val('sv-comment') || null }));
    location.hash = '#/home';
  }, 'شكرًا لك، وصل تقييمك 🌟');
}

/* ---------- قياس الأثر ---------- */
async function renderImpact() {
  const main = shell('impact');
  try {
    const [weeks, students, fb, subs, st] = await Promise.all([loadWeeks(), loadStudents(), q(sb.from('feedback').select('*').range(0, 9999)), loadSubsMeta(), loadSettings()]);
    const act = students.filter(x => x.status === 'active'), ids = new Set(act.map(x => x.id));
    const F = fb.filter(f => ids.has(f.student_id));
    const avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
    const vals = (rows, keys) => rows.flatMap(r => keys.map(k => +(r.answers || {})[k]).filter(Boolean));
    const pre = F.filter(f => f.type === 'pre'), post = F.filter(f => f.type === 'post');
    const allKeys = C.PREPOST.flatMap(g => g.items.map((_, i) => g.key + (i + 1)));
    const preAll = avg(vals(pre, allKeys)), postAll = avg(vals(post, allKeys));
    const change = preAll && postAll ? (postAll - preAll) / preAll * 100 : null;
    const comp = C.PREPOST.map(g => { const ks = g.items.map((_, i) => g.key + (i + 1)); const a = avg(vals(pre, ks)), b = avg(vals(post, ks)); return { g, a, b, d: a && b ? (b - a) / a * 100 : null, items: g.items.map((t, i) => ({ t, a: avg(vals(pre, [ks[i]])), b: avg(vals(post, [ks[i]])) })) }; });
    const day = weeks.map(w => { const r = F.filter(f => f.type === 'day' && f.ref === String(w.id)).map(f => +f.answers.q1).filter(Boolean); return { w, n: r.length, a: avg(r) }; });
    const pr = KINDS.map(k => { const r = subs.filter(x => ids.has(x.student_id) && x.kind === k.id && x.self_rating).map(x => +x.self_rating); return { k, n: r.length, a: avg(r) }; });
    const ce = (C.COMPETENCIES || []).map(c => { const rows = F.filter(f => f.type === 'competency' && f.ref === c.key); return { c, n: rows.length, groups: C.COMPETENCY_EVAL.map((g, gi) => ({ g, a: avg(vals(rows, g.items.map((_, i) => 'g' + gi + '_' + i))) })), comments: rows.filter(r => r.comment).map(r => r.comment) }; });
    const pctBar = (a, cls = '') => `<span class="meter"><i class="${cls}" style="width:${a ? a / 5 * 100 : 0}%"></i></span><b>${a ? n(a) : '—'}</b>`;
    const chg = d => d == null ? '' : `<span class="chip ${d >= 0 ? 'ok' : 'bad'}">${d >= 0 ? '▲' : '▼'} ${n(Math.abs(d))}٪</span>`;
    const admin = S.me.role === 'admin';
    const tog = (f, label) => `<button class="btn ${st && st[f] ? 'no' : 'gold'} sm" data-act="pp-toggle" data-f="${f}" data-v="${st && st[f] ? 0 : 1}">${st && st[f] ? 'إغلاق ' : 'فتح '}${label}</button>`;
    main.innerHTML = `
    <div class="head"><div class="grow"><h1>📊 قياس الأثر والرضا</h1><p>القياس القبلي والبعدي، وتقييمات الطلاب للقاءات والممارسات والجدارات</p></div>
      <button class="btn ghost sm no-print" data-act="print">طباعة / PDF</button></div>
    ${admin ? `<div class="card no-print"><h2>التحكم في القياس</h2><p class="sub">عند الفتح تظهر للطلاب بطاقة القياس في صفحتهم الرئيسية.</p>
      <div class="actions" style="margin-top:0">${tog('pre_open', 'القياس القبلي')}${tog('post_open', 'القياس البعدي')}
      <span class="hint">القبلي: ${st && st.pre_open ? 'مفتوح' : 'مغلق'} — البعدي: ${st && st.post_open ? 'مفتوح' : 'مغلق'}</span></div></div>` : ''}
    <div class="kpis">
      <div class="kpi"><b>${n(pre.length)}/${n(act.length)}</b><span>أجابوا القياس القبلي</span></div>
      <div class="kpi"><b>${n(post.length)}/${n(act.length)}</b><span>أجابوا القياس البعدي</span></div>
      <div class="kpi"><b>${preAll ? n(preAll) : '—'}</b><span>متوسط القبلي من 5</span></div>
      <div class="kpi"><b>${postAll ? n(postAll) : '—'}</b><span>متوسط البعدي من 5</span></div>
      <div class="kpi hero"><b>${change == null ? '—' : (change >= 0 ? '▲ ' : '▼ ') + n(Math.abs(change)) + '٪'}</b><span>${change != null && change < 0 ? 'نسبة التراجع' : 'نسبة التحسن'}</span></div>
    </div>
    <div class="card"><h2>أثر البرنامج: القبلي مقابل البعدي</h2><p class="sub">متوسط إجابات الطلاب لكل جدارة من 5. الرمادي قبل البرنامج، والكحلي بعده.</p>
      ${comp.map(x => `<div class="pp"><div class="pp-h"><b>${h(x.g.name)}</b>${chg(x.d)}</div>
        <div class="bar-row"><span>قبلي</span>${pctBar(x.a, 'gray')}</div><div class="bar-row"><span>بعدي</span>${pctBar(x.b)}</div></div>`).join('')}
      <details class="spec" style="margin-top:12px"><summary><b>تفاصيل كل عبارة</b></summary><div class="scroll" style="margin-top:10px"><table><thead><tr><th>العبارة</th><th>قبلي</th><th>بعدي</th><th>التغير</th></tr></thead><tbody>
        ${comp.flatMap(x => x.items.map(i => `<tr><td>${h(i.t)}<div class="hint">${h(x.g.name)}</div></td><td>${i.a ? n(i.a) : '—'}</td><td>${i.b ? n(i.b) : '—'}</td><td>${chg(i.a && i.b ? (i.b - i.a) / i.a * 100 : null)}</td></tr>`)).join('')}
      </tbody></table></div></details></div>
    <div class="grid g2">
      <div class="card"><h2>الفائدة من اللقاءات التدريبية</h2><p class="sub">${h(C.DAY_QUESTION)}</p><div class="bars">
        ${day.map(x => `<div class="bar-row"><span>الأسبوع ${x.w.id} <small class="hint">(${n(x.n)})</small></span>${pctBar(x.a, 'gold')}</div>`).join('')}</div></div>
      <div class="card"><h2>الاستفادة من الممارسات</h2><p class="sub">تقييم الطالب لاستفادته عند رفع كل ممارسة.</p><div class="bars">
        ${pr.map(x => `<div class="bar-row"><span>${x.k.name} <small class="hint">(${n(x.n)})</small></span>${pctBar(x.a, 'gold')}</div>`).join('')}</div></div>
    </div>
    <div class="card"><h2>تقييم الجدارات (المدرب والمحتوى وبيئة التدريب)</h2><div class="scroll"><table><thead><tr><th>الجدارة</th><th>المقيّمون</th>${C.COMPETENCY_EVAL.map(g => `<th>${h(g.group)}</th>`).join('')}</tr></thead><tbody>
      ${ce.map(x => `<tr><td><b>${h(x.c.name)}</b></td><td>${n(x.n)}</td>${x.groups.map(g => `<td class="num">${g.a ? n(g.a) : '—'}</td>`).join('')}</tr>`).join('')}
    </tbody></table></div>
    ${ce.some(x => x.comments.length) ? ce.filter(x => x.comments.length).map(x => `<details class="spec" style="margin-top:12px"><summary><b>آراء الطلاب في ${h(x.c.name)}</b><span class="chip">${n(x.comments.length)}</span></summary>${x.comments.map(cm => `<div class="sub-box"><p>${h(cm)}</p></div>`).join('')}</details>`).join('') : ''}</div>`;
  } catch (e) { fail(main, e); }
}

/* ---------- نظام البرنامج ---------- */
async function renderSystem() {
  const main = shell('system');
  try {
    const [weeks, st] = await Promise.all([loadWeeks(), loadSettings()]);
    const t = v => v ? fmtTime('2000-01-01T' + v.slice(0, 5) + ':00+03:00') : '';
    const first = weeks[0], last = weeks[weeks.length - 1];
    main.innerHTML = `
    <div ${heroAttr(7)}><div class="grow"><h1>📘 نظام البرنامج</h1><p>كل ما تحتاج معرفته عن ${h(C.PROGRAM_NAME)}: الجدول، والدرجات، والحضور، والتحفيز، والاستبعاد</p></div></div>
    <div class="sys-grid">
      <section class="card"><h2>🗓️ نظام البرنامج</h2>
        <ul class="sys-list">
          <li><b>المدة:</b> ${n(weeks.length)} أسابيع${first && last ? `، من ${fmtDate(first.meeting_date)} إلى ${fmtDate(last.meeting_date)}` : ''}.</li>
          <li><b>اللقاء الحضوري:</b> كل يوم اثنين، ويُشترط حضوره كاملًا.</li>
          <li><b>الجدارات:</b> ${(C.COMPETENCIES || []).map(c => h(c.name)).join('، ')}.</li>
          <li><b>متوافق مع الجدول الدراسي:</b> يتوقف في الإجازات وأسابيع الاختبارات، مع استمرار المتابعة عبر المنصة.</li>
        </ul>
        <div class="scroll"><table class="sys-table"><thead><tr><th>اليوم</th><th>المطلوب</th><th>المدة</th></tr></thead><tbody>
          <tr><td>الاثنين</td><td>اللقاء التدريبي الحضوري</td><td>3 ساعات</td></tr>
          ${KINDS.map(k => `<tr><td>${k.day}</td><td>${k.name}</td><td>${k.mins} دقيقة</td></tr>`).join('')}
        </tbody></table></div></section>
      <section class="card"><h2>💯 الدرجة الأسبوعية (${n(WEEK_MAX)} درجة)</h2>
        <div class="score-bars">
          <div style="flex:${P.attendance}"><b>${n(P.attendance)}</b><span>حضور اللقاء</span></div>
          ${KINDS.map(k => `<div style="flex:${P[k.id]}"><b>${n(P[k.id])}</b><span>${k.name}</span></div>`).join('')}
        </div>
        <ul class="sys-list" style="margin-top:14px">
          <li>الممارسات تُنفَّذ <b>حتى لو غاب الطالب</b> عن اللقاء.</li>
          <li>يرفع الطالب كل ممارسة نصًا أو ملف Word أو PDF، ويقيّم استفادته منها.</li>
          <li>${st && st.limit_submission_window ? 'الرفع متاح من يوم اللقاء حتى نهاية يوم الأحد التالي.' : 'رفع الممارسات مفتوح في أي وقت.'}</li>
          <li>يراجع الأخصائي كل ممارسة: يقبلها مع درجة، أو يطلب إعادتها مع ملاحظة.</li>
        </ul></section>
      <section class="card"><h2>📍 التحضير والحضور المبكر</h2>
        <ul class="sys-list">
          <li>يسجّل الطالب حضوره بنفسه من المنصة عند وصوله إلى ${h((st && st.place_name) || 'مقر البرنامج')}، ويُحفظ <b>وقت التحضير</b>.</li>
          <li><b>درجة الحضور حسب وقت التحضير:</b></li></ul>
        <div class="period-row">
          <div class="period p30"><b>30</b><span>⭐ مبكر</span><small>${st && st.early_until ? `حتى ${t(st.early_until)}` : ''}</small></div>
          <div class="period p20"><b>20</b><span>فترة العصر</span><small>${st && st.asr_until ? `حتى ${t(st.asr_until)}` : ''}</small></div>
          <div class="period p10"><b>10</b><span>فترة المغرب</span><small>بعد ذلك</small></div>
        </div>
        <ul class="sys-list" style="margin-top:14px">
          <li>يسجّل مدير النظام <b>وقت الانصراف</b>، و<b>من ينصرف قبل نهاية اللقاء يخسر درجة الفترات التي لم يحضرها</b>: قبل فترة المغرب −10، وقبل فترة العصر −20.</li>
          <li>يمكن للأخصائي تعديل حالة الحضور (حاضر، غائب، مستأذن).</li>
        </ul></section>
      <section class="card sys-warn"><h2>⚠️ الإنذار والاستبعاد</h2>
        <div class="rules">
          <div class="rule warn"><h3>إنذار بالاستبعاد</h3><p>الغياب <b>${R.absenceWarning === 2 ? 'مرتين' : n(R.absenceWarning) + ' مرات'}</b>، أو عدم تنفيذ <b>${n(R.practiceWarning)}</b> ممارسات.</p></div>
          <div class="rule exclude"><h3>الاستبعاد من البرنامج</h3><p>الغياب <b>${n(R.absenceExclusion)} مرات</b>، أو عدم تنفيذ <b>${n(R.practiceExclusion)}</b> ممارسة.</p></div>
        </div>
        <p class="hint" style="margin:12px 0 0">الممارسات غير المنفّذة تتراكم عبر الأسابيع، ولا يلزم أن تكون في أسبوع واحد. وتظهر للطالب في صفحته رسالة تنبيه فور وصوله إلى حد الإنذار.</p></section>
    </div>
    <section class="card"><h2>🏅 آلية التحفيز</h2>
      <div class="incent">${(C.INCENTIVES || []).map(x => `<div class="inc"><span class="inc-ico">${x.icon}</span><h3>${h(x.title)}</h3><p>${h(x.text)}</p></div>`).join('')}</div></section>`;
  } catch (e) { fail(main, e); }
}

/* ---------- الأحداث ---------- */
const ACTIONS = {
  logout: async () => { await sb.auth.signOut(); S.me = null; S.session = null; location.hash = '#/login'; route(); },
  reload: () => { S.me = null; route(); },
  submit: submitPractice,
  checkin: selfCheckIn,
  'rate-day': b => busy(b, async () => {
    const wid = b.dataset.w, v = +b.dataset.v;
    await q(sb.from('feedback').upsert({ student_id: S.me.id, type: 'day', ref: wid, answers: { q1: v } }, { onConflict: 'student_id,type,ref' }));
    PG.dayFb = { answers: { q1: v } }; const c = $('day-card'); if (c) c.outerHTML = dayRatingCard({ id: +wid });
  }, 'شكرًا لتقييمك 🌟'),
  'survey-send': surveySend,
  'pp-toggle': b => busy(b, async () => { const f = b.dataset.f; await q(sb.from('settings').update({ [f]: b.dataset.v === '1' }).eq('id', 1)); await renderImpact(); }, 'تم التحديث.'),
  'media-up': mediaUpload,
  'media-del': b => { if (!armed(b, 'تأكيد الحذف')) return; busy(b, async () => { const it = (PG.items || []).find(x => x.id === b.dataset.id); await q(sb.from('media_items').delete().eq('id', b.dataset.id)); if (it && it.file_path) await sb.storage.from('media').remove([it.file_path]); await renderMedia(); }, 'حُذف.'); },
  'media-open': b => { const it = PG.items[+b.dataset.i]; if (it.kind === 'photo') openPhoto(PG.photoList.indexOf(PG.urls[it.file_path]), PG.photoList); else window.open(it.kind === 'link' ? it.url : PG.urls[it.file_path], '_blank', 'noopener'); },
  'post-add': postAdd,
  'post-del': b => { if (!armed(b, 'تأكيد الحذف')) return; busy(b, async () => { await q(sb.from('media_posts').delete().eq('id', b.dataset.id)); await renderPosts(); }, 'حُذف.'); },
  'set-here': setHere,
  'set-save': saveSettings,
  rv: reviewAction,
  file: b => openFile(b.dataset.b, b.dataset.p),
  att: markAttendance,
  checkout: checkoutSelected,
  'co-clear': b => busy(b, async () => { await q(sb.rpc('admin_clear_checkout', { p_week: PG.w.id, p_student: b.dataset.sid })); await PG.reload(); }, 'أُلغي الانصراف.'),
  'att-all': markAllPresent,
  'sheet-up': uploadSheet,
  csv: () => PG.csv && PG.csv(),
  print: () => window.print(),
  photo: b => openPhoto(+b.dataset.i),
  'lb-close': closePhoto,
  'lb-prev': () => openPhoto(lbIndex - 1),
  'lb-next': () => openPhoto(lbIndex + 1),
  'u-create': b => {
    const role = val('nu-role'), id = digits(val('nu-id')), name = val('nu-name'), phone = digits(val('nu-phone'));
    if (!/^\d{10}$/.test(id)) return toast('رقم الهوية يجب أن يكون 10 أرقام.', true);
    if (name.split(/\s+/).length < 2) return toast('اكتب الاسم الكامل.', true);
    if (phone && !/^05\d{8}$/.test(phone)) return toast('رقم الجوال يجب أن يبدأ بـ 05 ويتكون من 10 أرقام.', true);
    const st = role === 'student';
    busy(b, async () => {
      await q(sb.rpc('admin_create_user', { p_national_id: id, p_full_name: name, p_role: role, p_phone: phone || null,
        p_school: st ? val('nu-school') : null, p_grade: st ? val('nu-grade') : null, p_specialist: st ? (val('nu-spec') || null) : null }));
      PG.bulk = null; await renderUsers();
    }, `أُنشئ الحساب. اسم الدخول ${id} وكلمة المرور 123456`);
  },
  'xl-template': () => xlTemplate(),
  'xl-cancel': () => { PG.preview = null; renderUsers(); },
  'xl-import': b => {
    const rows = (PG.preview || []).filter(r => !r.err), spec = val('nu-bulk-spec') || null;
    if (!rows.length) return toast('لا توجد صفوف صالحة للاستيراد.', true);
    busy(b, async () => {
      const res = { ok: 0, fail: (PG.preview || []).filter(r => r.err).map(r => ({ line: r.line, reason: r.err + (r.name ? ' — ' + r.name : '') })) };
      for (const r of rows) {
        b.textContent = `جارٍ الإنشاء ${n(res.ok + 1)} من ${n(rows.length)}…`;
        const { error } = await sb.rpc('admin_create_user', { p_national_id: r.id, p_full_name: r.name, p_role: 'student', p_phone: r.phone || null, p_school: r.school || null, p_grade: r.grade || null, p_specialist: spec });
        if (error) res.fail.push({ line: r.line, reason: errMsg(error) + ' — ' + r.name }); else res.ok++;
      }
      res.fail.sort((x, y) => x.line - y.line);
      PG.bulk = res; PG.preview = null; await renderUsers();
      const st = document.querySelector('.xl-step'); if (st) st.closest('.card').scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, null);
  },
  'u-reset': b => {
    if (!armed(b, 'تأكيد: 123456')) return;
    busy(b, async () => { await q(sb.rpc('admin_reset_password', { p_user: b.dataset.id })); await renderUsers(); }, 'أُعيدت كلمة المرور إلى 123456.');
  },
  'u-delete': b => {
    if (!armed(b, 'تأكيد الحذف النهائي')) return;
    busy(b, async () => { await q(sb.rpc('admin_delete_user', { p_user: b.dataset.id })); await renderUsers(); }, 'حُذف الحساب.');
  },
  'w-save': b => {
    const id = +b.dataset.id, row = { title: val('wt-' + id), competency: val('wc-' + id), meeting_date: val('wd-' + id), hijri_date: val('wh-' + id) || null, note: val('wn-' + id) || null };
    if (!row.title || !row.meeting_date) return toast('الموضوع والتاريخ مطلوبان.', true);
    busy(b, async () => { await q(sb.from('weeks').update(row).eq('id', id)); await loadWeeks(true); }, 'حُفظ الأسبوع.');
  }
};
document.addEventListener('click', e => {
  const nm = document.querySelector('.nav-more[open]'); if (nm && !e.target.closest('.nav-more')) nm.removeAttribute('open');
  const go = e.target.closest('[data-go]'); if (go && !e.target.closest('a,button')) { location.hash = go.dataset.go; return; }
  const b = e.target.closest('[data-act]'); if (!b || !ACTIONS[b.dataset.act]) return;
  e.preventDefault(); ACTIONS[b.dataset.act](b);
});
document.addEventListener('change', e => {
  const el = e.target;
  if (el.dataset.f && el.closest('.head') && PG.f && ['week', 'kind', 'status'].includes(el.dataset.f) && !el.dataset.actChange) { PG.f[el.dataset.f] = el.value; renderReview(); return; }
  const a = el.dataset.actChange; if (!a) return;
  if (a === 'scope') { S.onlyMine = el.checked; route(); }
  else if (a === 'att-week') location.hash = '#/attendance/' + el.value;
  else if (a === 'mode') { const f = el.value === 'file'; $('pt-' + el.dataset.k).hidden = f; $('pf-' + el.dataset.k).hidden = !f; }
  else if (a === 'xl-file') { const f = el.files[0]; if (f) { PG.xlSpec = val('nu-bulk-spec') || null; readExcel(f).then(rows => { PG.preview = rows; PG.bulk = null; renderUsers().then(() => { const c = $('xl-prev'); if (c) c.scrollIntoView({ behavior: 'smooth' }); }); }).catch(e => { console.error(e); toast('تعذّرت قراءة الملف. تأكد أنه ملف Excel صحيح.', true); }); } }
  else if (a === 'sel') { el.checked ? PG.sel.add(el.dataset.sid) : PG.sel.delete(el.dataset.sid); PG.coTime = val('co-time'); drawAttendance($('main'), S.weeks); }
  else if (a === 'sel-all') { PG.coTime = val('co-time'); PG.sel = new Set(el.checked ? PG.list.filter(x => PG.att[x.id] === 'present').map(x => x.id) : []); drawAttendance($('main'), S.weeks); }
  else if (a === 'att-pts') { const v = +el.value, sid = el.dataset.sid; busy(el, async () => { await q(sb.from('attendance').update({ points: v, early: v === 30 }).eq('week_id', PG.w.id).eq('student_id', sid)); Object.assign(PG.meth[sid], { points: v, early: v === 30 }); drawAttendance($('main'), S.weeks); }, 'عُدّلت درجة الحضور.'); }
  else if (a === 'media-week') { PG.mw = el.value; renderMedia(); }
  else if (a === 'post-week') { PG.pw = el.value; renderPosts(); }
  else if (a === 'nu-role') { $('nu-st').style.display = el.value === 'student' ? '' : 'none'; }
  else if (a === 'u-tab') { PG.tab = el.value; PG.draw && PG.draw(); renderUsers(); }
  else if (a === 'rep-from') { PG.from = +el.value; if (PG.to < PG.from) PG.to = PG.from; renderReports(); }
  else if (a === 'rep-to') { PG.to = +el.value; if (PG.from > PG.to) PG.from = PG.to; renderReports(); }
  else if (a === 'u-field') {
    const v = el.value || null;
    busy(el, async () => { await q(sb.from('profiles').update({ [el.dataset.f]: v }).eq('id', el.dataset.id)); const u = PG.all && PG.all.find(x => x.id === el.dataset.id); if (u) u[el.dataset.f] = v; }, 'حُفظ التغيير.');
  }
});

/* ---------- التوجيه ---------- */
let lastRoute = '';
async function route() {
  if (!sb) return renderSetup();
  const parts = location.hash.replace(/^#\/?/, '').split('/');
  const name = parts[0] || 'home';
  if (!S.session) return renderLogin();
  if (!S.me) {
    try { S.me = await q(sb.from('profiles').select('*').eq('id', S.session.user.id).single()); }
    catch (e) { console.error(e); authLayout(`<h1>تعذّر تحميل حسابك</h1><p>${h(errMsg(e))}</p><div class="actions"><button class="btn" data-act="reload">إعادة المحاولة</button><button class="btn ghost" data-act="logout">خروج</button></div>`); return; }
  }
  if (S.me.status === 'pending') return renderPending();
  if (S.me.role !== 'student' && S.me.status !== 'active') { authLayout(`<h1>الحساب موقوف</h1><p>تواصل مع مدير النظام.</p><div class="actions"><button class="btn ghost" data-act="logout">خروج</button></div>`); return; }
  if (name !== lastRoute.split('/')[0] && !(name === 'review' && lastRoute.startsWith('review'))) PG = {};
  lastRoute = parts.join('/');
  const role = S.me.role;
  if (name === 'profile') return renderProfile();
  if (name === 'leaders') return renderLeaders();
  if (name === 'media') return renderMedia();
  if (name === 'system') return renderSystem();
  if (name === 'survey' && role === 'student') { const m = shell('home'); return renderSurvey(m, parts[1], parts[2]).catch(e => fail(m, e)); }
  if (name === 'impact' && role !== 'student') return renderImpact();
  if (name === 'posts' && role !== 'student') return renderPosts();
  if (role === 'student') {
    if (name === 'week' && parts[1]) { const m = shell('home'); return weekPage(m, S.me, parts[1], true).catch(e => fail(m, e)); }
    const m = shell('home'); return studentDashboard(m, S.me, true).catch(e => fail(m, e));
  }
  if (role === 'observer' && ['attendance', 'review', 'users', 'weeks'].includes(name)) return renderStaffHome();
  switch (name) {
    case 'specialists': return renderSpecialists();
    case 'attendance': return renderAttendance(parts[1]);
    case 'review': return renderReview();
    case 'students': return renderStudents();
    case 'student': return parts[1] ? renderStudentAsStaff(parts[1], parts[2]) : renderStudents();
    case 'reports': return renderReports();
    case 'leaders': return renderLeaders();
    case 'users': return role === 'admin' ? renderUsers() : renderStaffHome();
    case 'weeks': return role === 'admin' ? renderWeeksAdmin() : renderStaffHome();
    default: return renderStaffHome();
  }
}
window.addEventListener('hashchange', route);

(async () => {
  if (!sb) return renderSetup();
  const { data } = await sb.auth.getSession();
  S.session = data.session;
  sb.auth.onAuthStateChange((ev, session) => {
    if (ev === 'SIGNED_OUT') { S.session = null; S.me = null; route(); }
    else if (ev === 'TOKEN_REFRESHED' || ev === 'SIGNED_IN') S.session = session;
  });
  route();
})();
