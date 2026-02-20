// TalentSift v2 — Complete Frontend JS
// Features: Auth, Dashboard, Upload, Bulk, Candidates, Kanban, Interviews, Jobs, Analytics

const API = '';
let allResumes = [], allJobs = [], allInterviews = [];
let currentFilter = '', currentJobFilter = '';
let currentResume = null, editingJobId = null, calDate = new Date();

// ── Theme ──────────────────────────────────────────────────────────────────
const html = document.documentElement;
const saved = localStorage.getItem('theme') || 'dark';
html.setAttribute('data-theme', saved);
document.getElementById('themeToggle').innerHTML = saved === 'dark' ? '☀️ Theme' : '🌙 Theme';
document.getElementById('themeToggle').addEventListener('click', () => {
  const t = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-theme', t);
  localStorage.setItem('theme', t);
  document.getElementById('themeToggle').innerHTML = t === 'dark' ? '☀️ Theme' : '🌙 Theme';
});

// ── Sidebar ────────────────────────────────────────────────────────────────
const sidebar = document.getElementById('sidebar');
document.getElementById('sidebarToggle').addEventListener('click', () => {
  sidebar.classList.toggle('collapsed');
  localStorage.setItem('sc', sidebar.classList.contains('collapsed'));
});
if (localStorage.getItem('sc') === 'true') sidebar.classList.add('collapsed');
document.getElementById('mobileMenuBtn').addEventListener('click', () => sidebar.classList.toggle('mobile-open'));
document.addEventListener('click', e => {
  if (window.innerWidth <= 768 && !sidebar.contains(e.target) && !document.getElementById('mobileMenuBtn').contains(e.target))
    sidebar.classList.remove('mobile-open');
});

// ── Logout ─────────────────────────────────────────────────────────────────
document.getElementById('logoutBtn').addEventListener('click', async () => {
  await fetch('/api/auth/logout', { method: 'POST' });
  window.location.href = '/login';
});

// ── Toast ──────────────────────────────────────────────────────────────────
function toast(msg, type = 'info') {
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span>${icons[type]}</span> ${msg}`;
  document.getElementById('toastCont').appendChild(el);
  setTimeout(() => { el.style.opacity='0'; el.style.transform='translateX(20px)'; el.style.transition='.3s'; setTimeout(() => el.remove(), 300); }, 3500);
}

// ── API ────────────────────────────────────────────────────────────────────
async function api(url, opts = {}) {
  const r = await fetch(url, { headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', ...opts });
  if (r.status === 401) { window.location.href = '/login'; return {}; }
  return r.json();
}

// ── Navigation ─────────────────────────────────────────────────────────────
const pageMeta = {
  dashboard:     { title: 'Dashboard',       sub: 'Overview of your hiring pipeline' },
  upload:        { title: 'Upload Resume',    sub: 'Screen a candidate with AI analysis' },
  bulk:          { title: 'Bulk Upload',      sub: 'Upload and screen multiple resumes at once' },
  candidates:    { title: 'Candidates',       sub: 'Browse and manage screened resumes' },
  kanban:        { title: 'Kanban Board',     sub: 'Visual pipeline management' },
  interviews:    { title: 'Interviews',       sub: 'Schedule and manage candidate interviews' },
  jobs:          { title: 'Job Positions',    sub: 'Manage your open roles and requirements' },
  analytics:     { title: 'Analytics',        sub: 'Insights and trends from your hiring data' },
  notifications: { title: 'Notifications',    sub: 'Recent system activity and alerts' },
};

function navigateTo(page) {
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelector(`[data-page="${page}"]`)?.classList.add('active');
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(`page-${page}`)?.classList.add('active');
  const m = pageMeta[page] || {};
  document.getElementById('pageTitle').textContent = m.title || page;
  document.getElementById('pageSubtitle').textContent = m.sub || '';
  const loaders = { dashboard: loadDashboard, candidates: () => { loadCandidates(); populateCandJobFilter(); },
    kanban: loadKanban, interviews: () => { loadInterviews(); renderCalendar(); },
    jobs: loadJobs, analytics: loadAnalytics, notifications: loadNotifications,
    upload: populateUploadJobSel, bulk: populateBulkJobSel };
  if (loaders[page]) loaders[page]();
}
document.querySelectorAll('.nav-item').forEach(b => b.addEventListener('click', () => navigateTo(b.dataset.page)));

// ── User Info ──────────────────────────────────────────────────────────────
async function loadUser() {
  const d = await api('/api/auth/me');
  if (d.user) {
    document.getElementById('userName').textContent = d.user.name;
    document.getElementById('userRole').textContent = d.user.role.replace('_', ' ');
    document.getElementById('userAv').textContent = d.user.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  }
}

// ── Dashboard ──────────────────────────────────────────────────────────────
async function loadDashboard() {
  const [stats, resResp, intResp] = await Promise.all([api('/api/stats'), api('/api/resumes'), api('/api/interviews')]);
  allResumes = resResp.resumes || [];
  allInterviews = intResp.interviews || [];

  document.getElementById('stTotal').textContent = stats.total || 0;
  document.getElementById('stSL').textContent    = stats.shortlisted || 0;
  document.getElementById('stRV').textContent    = stats.review || 0;
  document.getElementById('stRJ').textContent    = stats.rejected || 0;
  document.getElementById('stAvg').textContent   = stats.avg_score || 0;
  document.getElementById('stInt').textContent   = stats.total_interviews || 0;
  document.getElementById('stJobs').textContent  = stats.active_jobs || 0;
  document.getElementById('navCount').textContent = stats.total || 0;
  document.getElementById('interviewCount').textContent = stats.total_interviews || 0;

  const total = stats.total || 1;
  const pipeData = [
    { id:'sl', label:'Shortlisted', val: stats.shortlisted||0, cls:'pf-sl' },
    { id:'rv', label:'Review',      val: stats.review||0,      cls:'pf-rv' },
    { id:'mb', label:'Maybe',       val: stats.maybe||0,       cls:'pf-mb' },
    { id:'rj', label:'Rejected',    val: stats.rejected||0,    cls:'pf-rj' },
  ];
  document.getElementById('pipelineOverview').innerHTML = pipeData.map(p => {
    const pct = Math.round((p.val / total) * 100);
    return `<div class="pipe-row">
      <div class="pipe-lbl">${p.label}</div>
      <div class="pipe-track"><div class="pipe-fill ${p.cls}" style="width:0%" data-w="${pct}%"></div></div>
      <div class="pipe-pct">${pct}%</div>
    </div>`;
  }).join('');
  setTimeout(() => document.querySelectorAll('.pipe-fill[data-w]').forEach(el => el.style.width = el.dataset.w), 100);

  // Recent
  const recent = allResumes.slice(0, 5);
  document.getElementById('recentList').innerHTML = recent.length === 0
    ? '<div class="empty-sm">No screenings yet</div>'
    : recent.map(r => {
        const nm = r.parsed?.name || 'Unknown';
        const sc = r.scoring?.total_score || 0;
        return `<div class="recent-item">
          <div class="r-av">${nm.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()}</div>
          <div><div class="r-name">${nm}</div><div class="r-job">${r.job_title||'—'}</div></div>
          <div class="r-score" style="color:${scoreColor(sc)}">${sc}</div>
        </div>`;
      }).join('');

  // Upcoming interviews (next 7 days)
  const now = new Date();
  const upcoming = allInterviews
    .filter(i => new Date(i.interview_date) >= now)
    .sort((a,b) => new Date(a.interview_date) - new Date(b.interview_date))
    .slice(0, 4);
  document.getElementById('upcomingInterviews').innerHTML = upcoming.length === 0
    ? '<div class="empty-sm">No upcoming interviews</div>'
    : upcoming.map(i => `<div class="up-int-item">
        <div class="up-int-name">${i.candidate_name}</div>
        <div class="up-int-meta">${i.job_title} · ${i.interview_type}</div>
        <div class="up-int-date">📅 ${i.interview_date} ${i.interview_time}</div>
      </div>`).join('');
}

// ── Upload ─────────────────────────────────────────────────────────────────
async function populateUploadJobSel() {
  const d = await api('/api/jobs?status=active');
  allJobs = d.jobs || [];
  const sel = document.getElementById('uploadJobSel');
  sel.innerHTML = allJobs.map(j => `<option value="${j._id}">${j.title} — ${j.department}</option>`).join('');
}

const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
let selectedFile = null;

dropZone.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dov'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dov'));
dropZone.addEventListener('drop', e => { e.preventDefault(); dropZone.classList.remove('dov'); if(e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); });
fileInput.addEventListener('change', () => { if(fileInput.files[0]) handleFile(fileInput.files[0]); });

function handleFile(file) {
  selectedFile = file;
  document.getElementById('prevName').textContent = file.name;
  document.getElementById('prevSize').textContent = fmtSize(file.size);
  document.getElementById('filePrev').style.display = 'flex';
  dropZone.style.display = 'none';
  document.getElementById('analyzeBtn').disabled = false;
}
function fmtSize(b) { return b<1024?b+' B':b<1048576?(b/1024).toFixed(1)+' KB':(b/1048576).toFixed(1)+' MB'; }

document.getElementById('rmFile').addEventListener('click', () => {
  selectedFile = null; fileInput.value = '';
  document.getElementById('filePrev').style.display = 'none';
  dropZone.style.display = 'flex';
  document.getElementById('analyzeBtn').disabled = true;
});

document.getElementById('analyzeBtn').addEventListener('click', async () => {
  if (!selectedFile) return;
  const overlay = document.getElementById('upOverlay');
  overlay.style.display = 'flex';
  ['ps1','ps2','ps3','ps4'].forEach((s,i) => {
    document.getElementById(s).className = 'prog-step';
    setTimeout(() => {
      ['ps1','ps2','ps3','ps4'].slice(0,i).forEach(p => { document.getElementById(p).className = 'prog-step done'; });
      document.getElementById(s).className = 'prog-step active';
    }, i*700);
  });
  const fd = new FormData();
  fd.append('resume', selectedFile);
  fd.append('job_id', document.getElementById('uploadJobSel').value);
  try {
    const r = await fetch('/api/upload', { method:'POST', body: fd });
    const d = await r.json();
    setTimeout(() => {
      overlay.style.display = 'none';
      if (d.success) { currentResume = d.resume; renderResults(d.resume); toast('Resume analyzed!', 'success'); loadDashboard(); }
      else toast(d.error || 'Upload failed', 'error');
    }, 3000);
  } catch(e) { overlay.style.display = 'none'; toast('Network error', 'error'); }
});

function renderResults(r) {
  document.getElementById('rph').style.display = 'none';
  const sc = r.scoring || {}, p = r.parsed || {}, bd = sc.breakdown || {};
  const matched = [...(bd.required_skills?.matched||[]),...(bd.preferred_skills?.matched||[])];
  const missing = [...(bd.required_skills?.missing||[]),...(bd.preferred_skills?.missing||[])];
  const ratingCls = {'Excellent':'sc-excellent','Good':'sc-good','Average':'sc-average','Below Average':'sc-below'}[sc.rating]||'sc-average';
  const circumference = 314;
  const offset = circumference - (sc.total_score/100)*circumference;

  const bdHtml = Object.entries(bd).map(([key, v]) => {
    const label = {'required_skills':'Required Skills','preferred_skills':'Preferred Skills','experience':'Experience','education':'Education'}[key]||key;
    const pct = Math.round((v.score/v.max)*100);
    return `<div class="bd-item">
      <div class="bd-hdr"><span style="color:var(--sub)">${label}</span><span style="font-weight:600">${v.score}/${v.max}</span></div>
      <div class="bd-track"><div class="bd-fill" style="width:0%" data-w="${pct}%"></div></div>
    </div>`;
  }).join('');

  document.getElementById('rContent').innerHTML = `
    <div class="score-sec">
      <div class="ring-wrap">
        <svg viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="50" fill="none" stroke="var(--ibg)" stroke-width="8" class="ring-bg"/>
          <circle cx="60" cy="60" r="50" fill="none" stroke="url(#sg)" stroke-width="8" stroke-linecap="round"
            class="ring-prog" style="stroke-dasharray:314;stroke-dashoffset:314" transform="rotate(-90 60 60)" id="ringProg"/>
          <defs><linearGradient id="sg" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#06d6a0"/><stop offset="100%" stop-color="#4cc9f0"/>
          </linearGradient></defs>
        </svg>
        <div class="ring-center">
          <div class="ring-num" style="color:${scoreColor(sc.total_score||0)}">${sc.total_score||0}</div>
          <div class="ring-sub">/ 100</div>
        </div>
      </div>
      <div>
        <div class="sc-badge ${ratingCls}">${sc.rating||'N/A'}</div><br>
        <div style="font-size:.8rem;color:var(--sub);margin-bottom:6px">${statusLabel(sc.status)}</div>
        <div class="sc-name">${p.name||'—'}</div>
        <div class="sc-email">${p.email||'—'}</div>
        <div style="font-size:.75rem;color:var(--sub);margin-top:4px">${p.experience_years||0} yrs exp · ${p.education||'N/A'}</div>
      </div>
    </div>
    <h4 style="font-size:.78rem;font-weight:700;color:var(--mut);text-transform:uppercase;letter-spacing:.05em;margin-bottom:10px">Score Breakdown</h4>
    ${bdHtml}
    <div class="sk-grid" style="margin-top:16px">
      <div><div class="sk-lbl matched">✓ Matched</div><div class="sk-tags">${matched.map(s=>`<span class="sk-tag sk-m">${s}</span>`).join('')||'<span style="color:var(--mut);font-size:.78rem">None</span>'}</div></div>
      <div><div class="sk-lbl missing">✗ Missing</div><div class="sk-tags">${missing.map(s=>`<span class="sk-tag sk-x">${s}</span>`).join('')||'<span style="color:var(--mut);font-size:.78rem">All covered!</span>'}</div></div>
    </div>
    <div class="res-actions" style="margin-top:16px">
      <button class="ra ra-sl" onclick="quickStatus('${r._id}','shortlisted')">✓ Shortlist & Email</button>
      <button class="ra ra-rj" onclick="quickStatus('${r._id}','rejected')">✗ Reject</button>
      <button class="ra ra-new" onclick="resetUpload()">↺ New Upload</button>
    </div>`;
  document.getElementById('rContent').style.display = 'block';
  setTimeout(() => {
    document.getElementById('ringProg').style.strokeDashoffset = offset;
    document.querySelectorAll('.bd-fill[data-w]').forEach(el => el.style.width = el.dataset.w);
  }, 100);
}

async function quickStatus(rid, status) {
  await api(`/api/resumes/${rid}/status`, { method:'PUT', body: JSON.stringify({ status }) });
  const msg = status === 'shortlisted' ? 'Shortlisted! Email notification sent.' : 'Marked as rejected.';
  toast(msg, status === 'shortlisted' ? 'success' : 'error');
}

function resetUpload() {
  document.getElementById('rmFile').click();
  document.getElementById('rph').style.display = 'flex';
  document.getElementById('rContent').style.display = 'none';
  currentResume = null;
}

// ── Bulk Upload ────────────────────────────────────────────────────────────
async function populateBulkJobSel() {
  const d = await api('/api/jobs?status=active');
  allJobs = d.jobs || [];
  document.getElementById('bulkJobSel').innerHTML = allJobs.map(j => `<option value="${j._id}">${j.title}</option>`).join('');
}
const bulkDrop = document.getElementById('bulkDrop');
const bulkInput = document.getElementById('bulkInput');
let bulkFiles = [];

bulkDrop.addEventListener('click', () => bulkInput.click());
bulkDrop.addEventListener('dragover', e => { e.preventDefault(); bulkDrop.style.borderColor='var(--c-ac)'; });
bulkDrop.addEventListener('dragleave', () => bulkDrop.style.borderColor='');
bulkDrop.addEventListener('drop', e => { e.preventDefault(); bulkDrop.style.borderColor=''; handleBulkFiles([...e.dataTransfer.files]); });
bulkInput.addEventListener('change', () => handleBulkFiles([...bulkInput.files]));

function handleBulkFiles(files) {
  bulkFiles = files;
  const list = document.getElementById('bulkFileList');
  list.innerHTML = files.map((f, i) => `
    <div class="bulk-file-item">
      <span>📄</span>
      <div style="flex:1"><div style="font-size:.85rem;font-weight:600">${f.name}</div><div style="font-size:.74rem;color:var(--sub)">${fmtSize(f.size)}</div></div>
      <span style="font-size:.78rem;color:var(--mut)">#${i+1}</span>
    </div>`).join('');
  document.getElementById('bulkAnalyzeBtn').disabled = files.length === 0;
}

document.getElementById('bulkAnalyzeBtn').addEventListener('click', async () => {
  if (!bulkFiles.length) return;
  const btn = document.getElementById('bulkAnalyzeBtn');
  btn.disabled = true; btn.textContent = `⏳ Processing ${bulkFiles.length} resumes...`;
  const fd = new FormData();
  bulkFiles.forEach(f => fd.append('resumes', f));
  fd.append('job_id', document.getElementById('bulkJobSel').value);
  try {
    const r = await fetch('/api/upload/bulk', { method:'POST', body: fd });
    const d = await r.json();
    if (d.success) {
      toast(`✅ ${d.total} resumes processed!`, 'success');
      document.getElementById('bulkResults').innerHTML = `
        <h3 class="ct">Results — ${d.total} Resumes</h3>
        ${d.results.map(r => `
          <div class="bulk-res-item ${r.error ? 'error' : 'success'}">
            <div style="display:flex;align-items:center;justify-content:space-between">
              <div>
                <div style="font-weight:600;font-size:.86rem">${r.error ? '❌ '+r.filename : '✅ '+r.name}</div>
                <div style="font-size:.75rem;color:var(--sub)">${r.error || r.filename}</div>
              </div>
              ${!r.error ? `<div style="font-family:var(--fd);font-weight:700;font-size:1.1rem;color:${scoreColor(r.score)}">${r.score}</div>` : ''}
            </div>
            ${!r.error ? `<span class="st-badge st-${r.status}" style="margin-top:6px;display:inline-block">${cap(r.status)}</span>` : ''}
          </div>`).join('')}`;
      loadDashboard();
    }
  } catch(e) { toast('Bulk upload failed', 'error'); }
  btn.disabled = false; btn.textContent = '⚡ Analyze All Resumes';
  bulkFiles = []; bulkInput.value = ''; document.getElementById('bulkFileList').innerHTML = '';
});

// ── Candidates ─────────────────────────────────────────────────────────────
async function loadCandidates() {
  const d = await api(`/api/resumes?status=${currentFilter}&job_id=${currentJobFilter}&search=${document.getElementById('globalSearch').value}`);
  allResumes = d.resumes || [];
  document.getElementById('navCount').textContent = d.total || 0;
  const grid = document.getElementById('candGrid');
  if (!allResumes.length) {
    grid.innerHTML = `<div class="empty-state"><div class="ei">👤</div><h3>No candidates found</h3><p>Try adjusting filters</p><button class="btn-primary" onclick="navigateTo('upload')">Upload Resume</button></div>`;
    return;
  }
  grid.innerHTML = allResumes.map(r => {
    const nm = r.parsed?.name || 'Unknown';
    const sc = r.scoring?.total_score || 0;
    const st = r.scoring?.status || 'pending';
    const skills = (r.parsed?.skills || []).slice(0, 4);
    return `<div class="cand-card ${st}" onclick="openCandModal('${r._id}')">
      <div class="cc-hdr">
        <div class="cc-av">${initials(nm)}</div>
        <div><div class="cc-name">${nm}</div><div class="cc-job">${r.job_title||'—'}</div></div>
        <div class="cc-score" style="color:${scoreColor(sc)}">${sc}<span>/ 100</span></div>
      </div>
      <div class="cc-tags">${skills.map(s=>`<span class="cc-tag">${s}</span>`).join('')}${(r.parsed?.skills||[]).length>4?`<span class="cc-tag">+${(r.parsed?.skills||[]).length-4}</span>`:''}</div>
      <div class="cc-footer">
        <span class="st-badge st-${st}">${cap(st)}</span>
        <span class="cc-date">${(r.uploaded_at||'').slice(0,10)}</span>
        <div class="cc-acts" onclick="event.stopPropagation()">
          <button class="cc-act sched" title="Schedule Interview" onclick="openScheduleModalFor('${r._id}')">📅</button>
          <button class="cc-act del" title="Delete" onclick="deleteResume('${r._id}')">✕</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

document.querySelectorAll('.fb').forEach(b => {
  b.addEventListener('click', () => {
    document.querySelectorAll('.fb').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    currentFilter = b.dataset.filter;
    loadCandidates();
  });
});

async function populateCandJobFilter() {
  const d = await api('/api/jobs');
  const sel = document.getElementById('candJobFilter');
  sel.innerHTML = '<option value="">All Positions</option>' + (d.jobs||[]).map(j => `<option value="${j._id}">${j.title}</option>`).join('');
  sel.onchange = () => { currentJobFilter = sel.value; loadCandidates(); };
}

async function deleteResume(id) {
  if (!confirm('Delete this candidate?')) return;
  await api(`/api/resumes/${id}`, { method:'DELETE' });
  toast('Candidate deleted', 'info');
  loadCandidates();
  loadDashboard();
}

// ── Candidate Modal ────────────────────────────────────────────────────────
async function openCandModal(id) {
  const d = await api(`/api/resumes/${id}`);
  const r = d.resume;
  if (!r) return;
  const sc = r.scoring||{}, p = r.parsed||{}, bd = sc.breakdown||{};
  const matched = [...(bd.required_skills?.matched||[]),...(bd.preferred_skills?.matched||[])];
  const missing = [...(bd.required_skills?.missing||[]),...(bd.preferred_skills?.missing||[])];
  const notes = (r.notes||[]);
  document.getElementById('candModalContent').innerHTML = `
    <div style="display:flex;align-items:flex-start;gap:16px;margin-bottom:20px">
      <div class="cc-av" style="width:52px;height:52px;font-size:1.1rem">${initials(p.name||'U')}</div>
      <div style="flex:1">
        <h2 style="font-family:var(--fd);font-size:1.15rem;font-weight:700;margin-bottom:4px">${p.name||'Unknown'}</h2>
        <div style="font-size:.83rem;color:var(--sub)">${p.email} · ${p.phone}</div>
        <div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">
          <span class="st-badge st-${sc.status||'maybe'}">${cap(sc.status||'pending')}</span>
          <span style="padding:3px 9px;border-radius:20px;font-size:.72rem;background:var(--ibg);border:1px solid var(--brd);color:var(--sub)">${r.job_title||'—'}</span>
        </div>
      </div>
      <div style="text-align:center">
        <div style="font-family:var(--fd);font-size:2.4rem;font-weight:800;color:${scoreColor(sc.total_score||0)}">${sc.total_score||0}</div>
        <div style="font-size:.72rem;color:var(--mut)">/ 100 · ${sc.rating||'N/A'}</div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px">
      ${[['Experience', p.experience_years+' years'],['Education',p.education||'N/A'],['Certifications',(p.certifications||[]).length+' found']].map(([l,v])=>
        `<div style="padding:10px;border-radius:10px;background:var(--ibg);border:1px solid var(--brd)">
          <div style="font-size:.7rem;color:var(--mut);margin-bottom:3px">${l.toUpperCase()}</div>
          <div style="font-weight:600;font-size:.86rem">${v}</div>
        </div>`).join('')}
    </div>
    <div style="margin-bottom:14px">
      <div class="sk-lbl matched">✓ Matched Skills (${matched.length})</div>
      <div class="sk-tags">${matched.map(s=>`<span class="sk-tag sk-m">${s}</span>`).join('')||'<span style="color:var(--mut);font-size:.8rem">None matched</span>'}</div>
    </div>
    <div style="margin-bottom:16px">
      <div class="sk-lbl missing">✗ Missing Skills (${missing.length})</div>
      <div class="sk-tags">${missing.map(s=>`<span class="sk-tag sk-x">${s}</span>`).join('')||'<span style="color:var(--mut);font-size:.8rem">All covered!</span>'}</div>
    </div>
    <!-- Status Change -->
    <div style="margin-bottom:16px">
      <div style="font-size:.78rem;font-weight:600;color:var(--sub);margin-bottom:8px">CHANGE STATUS</div>
      <div style="display:flex;gap:7px;flex-wrap:wrap">
        ${['shortlisted','review','maybe','rejected'].map(s => `<button onclick="updateStatus('${r._id}','${s}')" class="ra ra-${s==='shortlisted'?'sl':s==='rejected'?'rj':'new'}" style="flex:none;padding:6px 12px">${cap(s)}</button>`).join('')}
      </div>
    </div>
    <!-- Notes -->
    <div style="margin-bottom:16px">
      <div style="font-size:.78rem;font-weight:600;color:var(--sub);margin-bottom:8px">RECRUITER NOTES</div>
      ${notes.map(n=>`<div style="padding:8px 10px;background:var(--ibg);border:1px solid var(--brd);border-radius:8px;margin-bottom:6px;font-size:.82rem"><span style="color:var(--sub)">${n.by} · ${(n.at||'').slice(0,10)}</span><br>${n.text}</div>`).join('')}
      <div style="display:flex;gap:8px;margin-top:8px">
        <input class="fi" id="noteInput" placeholder="Add a note..." style="flex:1">
        <button class="btn-primary compact" onclick="addNote('${r._id}')">Add</button>
      </div>
    </div>
    <div style="display:flex;gap:8px">
      <button class="btn-primary compact" onclick="openScheduleModalFor('${r._id}');closeCandModal()">📅 Schedule Interview</button>
      <button class="btn-sec" onclick="closeCandModal()">Close</button>
    </div>`;
  document.getElementById('candModal').style.display = 'flex';
}

async function updateStatus(rid, status) {
  await api(`/api/resumes/${rid}/status`, { method:'PUT', body: JSON.stringify({ status }) });
  toast(`Status updated to ${status}. ${status==='shortlisted'?'Email sent!':''}`, 'success');
  closeCandModal();
  loadCandidates();
}

async function addNote(rid) {
  const text = document.getElementById('noteInput').value.trim();
  if (!text) return;
  await api(`/api/resumes/${rid}/note`, { method:'POST', body: JSON.stringify({ text }) });
  openCandModal(rid);
}

function closeCandModal() { document.getElementById('candModal').style.display = 'none'; }
document.getElementById('candModal').addEventListener('click', e => { if(e.target===document.getElementById('candModal')) closeCandModal(); });

// ── Kanban ─────────────────────────────────────────────────────────────────
const kanbanStages = [
  { id:'applied',   label:'📥 Applied',    cls:'' },
  { id:'screening', label:'🔍 Screening',  cls:'pf-rv' },
  { id:'interview', label:'💬 Interview',  cls:'pf-mb' },
  { id:'offer',     label:'📋 Offer',      cls:'pf-sl' },
  { id:'hired',     label:'✅ Hired',      cls:'pf-sl' },
  { id:'rejected',  label:'❌ Rejected',   cls:'pf-rj' },
];

async function loadKanban() {
  const d = await api('/api/resumes');
  allResumes = d.resumes || [];
  const board = document.getElementById('kanbanBoard');
  board.innerHTML = kanbanStages.map(stage => {
    const cards = allResumes.filter(r => (r.kanban_stage||'applied') === stage.id);
    return `<div class="kb-col" id="kc-${stage.id}" data-stage="${stage.id}" ondragover="kbDragOver(event)" ondrop="kbDrop(event,this)">
      <div class="kb-col-hdr">
        <div class="kb-col-title">${stage.label}</div>
        <span class="kb-count">${cards.length}</span>
      </div>
      <div class="kb-cards">
        ${cards.map(r => `
          <div class="kb-card" draggable="true" id="kb-${r._id}" ondragstart="kbDragStart(event,'${r._id}')">
            <div class="kb-score" style="color:${scoreColor(r.scoring?.total_score||0)}">${r.scoring?.total_score||0}</div>
            <div class="kb-name">${r.parsed?.name||'Unknown'}</div>
            <div class="kb-job">${r.job_title||'—'}</div>
            <div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:3px">
              ${(r.parsed?.skills||[]).slice(0,3).map(s=>`<span class="cc-tag" style="font-size:.65rem;padding:1px 6px">${s}</span>`).join('')}
            </div>
          </div>`).join('')}
      </div>
    </div>`;
  }).join('');
}

let draggedId = null;
function kbDragStart(e, id) { draggedId = id; e.target.classList.add('dragging'); }
function kbDragOver(e) { e.preventDefault(); e.currentTarget.classList.add('drag-over'); }
async function kbDrop(e, col) {
  e.preventDefault();
  col.classList.remove('drag-over');
  document.querySelectorAll('.kb-card.dragging').forEach(el => el.classList.remove('dragging'));
  if (!draggedId) return;
  const stage = col.dataset.stage;
  await api(`/api/resumes/${draggedId}/kanban`, { method:'PUT', body: JSON.stringify({ stage }) });
  toast(`Moved to ${stage}`, 'info');
  loadKanban();
  draggedId = null;
}
document.addEventListener('dragend', () => { document.querySelectorAll('.kb-col').forEach(c => c.classList.remove('drag-over')); });

// ── Interviews ─────────────────────────────────────────────────────────────
async function loadInterviews() {
  const d = await api('/api/interviews');
  allInterviews = d.interviews || [];
  document.getElementById('interviewCount').textContent = allInterviews.length;
  const list = document.getElementById('interviewList');
  if (!allInterviews.length) { list.innerHTML = '<div class="empty-sm">No interviews scheduled yet</div>'; return; }
  const today = new Date().toISOString().slice(0,10);
  list.innerHTML = allInterviews
    .sort((a,b) => a.interview_date.localeCompare(b.interview_date))
    .map(i => `<div class="int-item ${i.interview_date===today?'today':''}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div>
          <div class="int-name">${i.candidate_name}</div>
          <div class="int-meta">${i.job_title} · ${i.interviewer}</div>
          <div class="int-date">📅 ${i.interview_date} ${i.interview_time}</div>
          <span class="int-type-badge">${i.interview_type}</span>
        </div>
        <div class="int-actions">
          ${i.meeting_link ? `<a href="${i.meeting_link}" target="_blank" class="cc-act" title="Join" style="text-decoration:none">🔗</a>` : ''}
          <button class="cc-act del" onclick="deleteInterview('${i._id}')">✕</button>
        </div>
      </div>
    </div>`).join('');
}

function renderCalendar() {
  const y = calDate.getFullYear(), m = calDate.getMonth();
  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const first = new Date(y, m, 1).getDay();
  const days = new Date(y, m+1, 0).getDate();
  const today = new Date();
  const interviewDates = new Set(allInterviews.map(i => i.interview_date));

  let html = `<div class="cal-hdr">
    <button class="cal-btn" onclick="changeMonth(-1)">‹</button>
    <span>${monthNames[m]} ${y}</span>
    <button class="cal-btn" onclick="changeMonth(1)">›</button>
  </div>
  <div class="cal-grid">
    ${['Su','Mo','Tu','We','Th','Fr','Sa'].map(d=>`<div class="cal-day-name">${d}</div>`).join('')}
    ${Array(first).fill('<div></div>').join('')}
    ${Array.from({length:days},(_,i) => {
      const d = i+1;
      const dateStr = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const isToday = today.getFullYear()===y && today.getMonth()===m && today.getDate()===d;
      const hasEv = interviewDates.has(dateStr);
      return `<div class="cal-day${isToday?' today':''}${hasEv?' has-event':''}" onclick="showDayEvents('${dateStr}')">${d}</div>`;
    }).join('')}
  </div>`;
  document.getElementById('miniCalendar').innerHTML = html;
  document.getElementById('calEvents').innerHTML = '<h4>Click a date to see interviews</h4>';
}

function changeMonth(dir) { calDate = new Date(calDate.getFullYear(), calDate.getMonth()+dir, 1); renderCalendar(); }
function showDayEvents(date) {
  const evs = allInterviews.filter(i => i.interview_date === date);
  document.getElementById('calEvents').innerHTML = `<h4>${date} — ${evs.length} interview(s)</h4>` +
    (evs.length === 0 ? '<div class="empty-sm">No interviews this day</div>' :
    evs.map(i=>`<div class="cal-event-item"><b>${i.candidate_name}</b> · ${i.interview_time} · ${i.interview_type}</div>`).join(''));
}

async function deleteInterview(id) {
  if (!confirm('Delete this interview?')) return;
  await api(`/api/interviews/${id}`, { method:'DELETE' });
  toast('Interview deleted', 'info');
  loadInterviews(); renderCalendar();
}

// Schedule Modal
function openScheduleModal() {
  populateSchedCandidates();
  document.getElementById('sIntDate').value = new Date().toISOString().slice(0,10);
  document.getElementById('schedModal').style.display = 'flex';
}
async function openScheduleModalFor(resumeId) {
  await populateSchedCandidates(resumeId);
  document.getElementById('sIntDate').value = new Date().toISOString().slice(0,10);
  document.getElementById('schedModal').style.display = 'flex';
}
async function populateSchedCandidates(selectedId = '') {
  const d = await api('/api/resumes?status=shortlisted');
  const resumes = d.resumes || [];
  const sel = document.getElementById('sIntCandidate');
  sel.innerHTML = resumes.map(r => `<option value="${r._id}" ${r._id===selectedId?'selected':''}>${r.parsed?.name||'Unknown'} — ${r.job_title||'N/A'}</option>`).join('');
  if (!resumes.length) sel.innerHTML = '<option>No shortlisted candidates</option>';
}
function closeSchedModal() { document.getElementById('schedModal').style.display = 'none'; }
document.getElementById('schedModal').addEventListener('click', e => { if(e.target===document.getElementById('schedModal')) closeSchedModal(); });

async function saveInterview() {
  const sel = document.getElementById('sIntCandidate');
  const rid = sel.value;
  const r = allResumes.find(x => x._id === rid) || {};
  const p = r.parsed || {};
  const data = {
    resume_id:       rid,
    candidate_name:  p.name || 'Candidate',
    candidate_email: p.email || '',
    job_title:       r.job_title || '',
    interview_date:  document.getElementById('sIntDate').value,
    interview_time:  document.getElementById('sIntTime').value,
    interview_type:  document.getElementById('sIntType').value,
    interviewer:     document.getElementById('sIntInterviewer').value,
    meeting_link:    document.getElementById('sIntLink').value,
    notes:           document.getElementById('sIntNotes').value,
  };
  if (!data.interview_date || !data.interview_time) { toast('Date and time are required', 'error'); return; }
  const d = await api('/api/interviews', { method:'POST', body: JSON.stringify(data) });
  if (d.success) {
    toast('Interview scheduled! Email sent to candidate.', 'success');
    closeSchedModal();
    loadInterviews(); renderCalendar(); loadDashboard();
  }
}

// ── Jobs ───────────────────────────────────────────────────────────────────
async function loadJobs() {
  const d = await api('/api/jobs');
  allJobs = d.jobs || [];
  document.getElementById('jobsList').innerHTML = allJobs.length === 0
    ? '<div class="empty-sm">No jobs created yet</div>'
    : allJobs.map(j => `<div class="job-item" onclick="editJob('${j._id}')">
        <div class="ji-title">${j.title}</div>
        <div class="ji-dept">${j.department} · ${j.location||'Remote'}</div>
        <div class="ji-meta">
          <span class="ji-tag">Min ${j.min_experience} yrs</span>
          <span class="ji-tag">${j.required_skills.length} req. skills</span>
          <span class="ji-status ji-${j.status||'active'}">${cap(j.status||'active')}</span>
        </div>
      </div>`).join('');
}

function clearJobForm() {
  editingJobId = null;
  document.getElementById('jobFormTitle').textContent = 'Create Job Position';
  document.getElementById('jobForm').reset();
  document.getElementById('saveJobBtn').textContent = 'Save Position';
  document.querySelectorAll('.job-item').forEach(el => el.classList.remove('active-item'));
}

function editJob(id) {
  const j = allJobs.find(x => x._id === id);
  if (!j) return;
  editingJobId = id;
  document.getElementById('jobFormTitle').textContent = 'Edit Job Position';
  document.getElementById('jTitle').value = j.title;
  document.getElementById('jDept').value = j.department;
  document.getElementById('jLoc').value = j.location||'';
  document.getElementById('jReq').value = j.required_skills.join(', ');
  document.getElementById('jPref').value = j.preferred_skills.join(', ');
  document.getElementById('jExp').value = j.min_experience;
  document.getElementById('jStatus').value = j.status||'active';
  document.getElementById('jDesc').value = j.description||'';
  document.getElementById('saveJobBtn').textContent = 'Update Position';
  document.querySelectorAll('.job-item').forEach(el => el.classList.remove('active-item'));
  document.querySelectorAll('.job-item').forEach(el => { if(el.onclick.toString().includes(id)) el.classList.add('active-item'); });
}

document.getElementById('saveJobBtn').addEventListener('click', async () => {
  const title = document.getElementById('jTitle').value.trim();
  if (!title) { toast('Job title is required', 'error'); return; }
  const body = {
    title, department: document.getElementById('jDept').value,
    location: document.getElementById('jLoc').value,
    required_skills: document.getElementById('jReq').value,
    preferred_skills: document.getElementById('jPref').value,
    min_experience: document.getElementById('jExp').value || 0,
    status: document.getElementById('jStatus').value,
    description: document.getElementById('jDesc').value,
  };
  if (editingJobId) {
    await api(`/api/jobs/${editingJobId}`, { method:'PUT', body: JSON.stringify(body) });
    toast('Job updated!', 'success');
  } else {
    await api('/api/jobs', { method:'POST', body: JSON.stringify(body) });
    toast('Job created!', 'success');
  }
  clearJobForm(); loadJobs();
});

// ── Analytics ──────────────────────────────────────────────────────────────
async function loadAnalytics() {
  const [statsD, skillsD, timeD, resD] = await Promise.all([
    api('/api/stats'), api('/api/analytics/skills'),
    api('/api/analytics/timeline'), api('/api/resumes')
  ]);
  const resumes = resD.resumes || [];

  // Skills
  const skills = skillsD.skills || [];
  const maxSk = skills[0]?.count || 1;
  document.getElementById('anSkills').innerHTML = skills.length === 0
    ? '<div class="empty-sm">No data yet</div>'
    : skills.map(s => `<div class="sk-bar-row">
        <div class="sk-bar-name" title="${s.skill}">${s.skill}</div>
        <div class="sk-bar-track"><div class="sk-bar-fill" style="width:${Math.round(s.count/maxSk*100)}%"></div></div>
        <div class="sk-bar-cnt">${s.count}</div>
      </div>`).join('');

  // Score distribution
  const ranges = [{l:'80–100',min:80,max:100,c:'var(--c-sl)'},{l:'60–79',min:60,max:79,c:'var(--c-rv)'},{l:'40–59',min:40,max:59,c:'var(--c-mb)'},{l:'0–39',min:0,max:39,c:'var(--c-rj)'}];
  const maxC = Math.max(...ranges.map(r => resumes.filter(x => (x.scoring?.total_score||0)>=r.min && (x.scoring?.total_score||0)<=r.max).length), 1);
  document.getElementById('anScores').innerHTML = ranges.map(r => {
    const cnt = resumes.filter(x => (x.scoring?.total_score||0)>=r.min && (x.scoring?.total_score||0)<=r.max).length;
    return `<div class="score-dist-row">
      <div style="width:70px;font-size:.78rem;color:var(--sub)">${r.l}</div>
      <div class="sk-bar-track" style="flex:1"><div class="sk-bar-fill" style="width:${Math.round(cnt/maxC*100)}%;background:${r.c}"></div></div>
      <div class="sk-bar-cnt">${cnt}</div>
    </div>`;
  }).join('');

  // Status breakdown
  const statuses = ['shortlisted','review','maybe','rejected'];
  const stColors = {shortlisted:'var(--c-sl)',review:'var(--c-rv)',maybe:'var(--c-mb)',rejected:'var(--c-rj)'};
  const total = resumes.length || 1;
  document.getElementById('anStatus').innerHTML = statuses.map(s => {
    const cnt = resumes.filter(r => r.scoring?.status===s).length;
    return `<div class="score-dist-row">
      <div style="width:80px;font-size:.78rem;color:var(--sub)">${cap(s)}</div>
      <div class="sk-bar-track" style="flex:1"><div class="sk-bar-fill" style="width:${Math.round(cnt/total*100)}%;background:${stColors[s]}"></div></div>
      <div class="sk-bar-cnt">${cnt}</div>
    </div>`;
  }).join('');

  // Timeline
  const tl = timeD.timeline || [];
  if (tl.length === 0) { document.getElementById('anTimeline').innerHTML = '<div class="empty-sm">No data yet</div>'; }
  else {
    const maxTl = Math.max(...tl.map(x=>x.count), 1);
    document.getElementById('anTimeline').innerHTML = `
      <div class="tl-row">
        ${tl.slice(-14).map(t => `<div class="tl-bar" style="height:${Math.round(t.count/maxTl*100)}%;background:var(--bp)" data-tip="${t.date}: ${t.count}"></div>`).join('')}
      </div>
      <div style="font-size:.72rem;color:var(--mut);margin-top:4px;text-align:center">Last ${Math.min(tl.length,14)} days of uploads</div>`;
  }

  // Health
  const total2 = statsD.total || 0;
  const sl = statsD.shortlisted || 0;
  const convRate = total2 ? Math.round(sl/total2*100) : 0;
  const avgSc = statsD.avg_score || 0;
  const intCnt = statsD.total_interviews || 0;
  const jobsCnt = statsD.active_jobs || 0;
  document.getElementById('anHealth').innerHTML = `<div class="an-health-grid">
    ${[{v:total2,l:'Total Screened',c:'var(--c-ac)'},{v:sl,l:'Shortlisted',c:'var(--c-sl)'},
       {v:convRate+'%',l:'Conversion Rate',c:'var(--c-rv)'},{v:avgSc,l:'Avg Score',c:'var(--c-mb)'},
       {v:intCnt,l:'Interviews',c:'var(--c-ac)'}].map(m =>
      `<div class="ahc"><div class="ahc-val" style="color:${m.c}">${m.v}</div><div class="ahc-lbl">${m.l}</div></div>`).join('')}
  </div>`;
}

// ── Notifications ──────────────────────────────────────────────────────────
async function loadNotifications() {
  const d = await api('/api/notifications');
  const notifs = d.notifications || [];
  document.getElementById('notifBadge').textContent = notifs.filter(n => !n.read).length;
  const icons = { job_created:'💼', resume_uploaded:'📄', shortlisted:'✅', bulk_upload:'📂', interview_scheduled:'📅' };
  document.getElementById('notifList').innerHTML = notifs.length === 0
    ? '<div class="empty-sm">No notifications yet</div>'
    : notifs.map(n => `<div class="notif-item">
        <div class="notif-icon">${icons[n.type]||'🔔'}</div>
        <div class="notif-msg">${n.message}</div>
        <div class="notif-time">${(n.created_at||'').slice(11,16)}</div>
      </div>`).join('');
}

// ── Global Search ──────────────────────────────────────────────────────────
document.getElementById('globalSearch').addEventListener('input', e => {
  const page = document.querySelector('.page.active')?.id;
  if (page === 'page-candidates') loadCandidates();
});

// ── Export CSV ─────────────────────────────────────────────────────────────
function exportCSV() {
  window.open('/api/export/csv', '_blank');
  toast('Downloading CSV export...', 'info');
}

// ── Helpers ────────────────────────────────────────────────────────────────
function scoreColor(s) { return s>=80?'var(--c-sl)':s>=60?'var(--c-rv)':s>=40?'var(--c-mb)':'var(--c-rj)'; }
function statusLabel(s) { return {shortlisted:'✅ Shortlisted',review:'⏳ Under Review',maybe:'❓ Maybe',rejected:'❌ Rejected'}[s]||s; }
function initials(nm) { return (nm||'?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase(); }
function cap(s) { return s ? s.charAt(0).toUpperCase()+s.slice(1) : ''; }

// ── Init ───────────────────────────────────────────────────────────────────
(async () => {
  await loadUser();
  await loadDashboard();
  await populateUploadJobSel();
  const notifs = await api('/api/notifications');
  document.getElementById('notifBadge').textContent = (notifs.notifications||[]).filter(n=>!n.read).length;
})();
