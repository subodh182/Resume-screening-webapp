"""
TalentSift v2 — Advanced Resume Screening System
Features: MongoDB, Email Notifications, Bulk Upload, Interview Scheduler,
          Kanban Board, Role-based Auth, Analytics, Export
"""

from flask import Flask, render_template, request, jsonify, session, redirect, url_for, send_file
from werkzeug.utils import secure_filename
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime, timedelta
from functools import wraps
import os, re, uuid, json, io, csv

# ── Optional imports (graceful fallback) ──────────────────────────────────────
try:
    from pymongo import MongoClient
    from bson import ObjectId
    MONGO_AVAILABLE = True
except ImportError:
    MONGO_AVAILABLE = False

try:
    import smtplib
    from email.mime.text import MIMEText
    from email.mime.multipart import MIMEMultipart
    EMAIL_AVAILABLE = True
except ImportError:
    EMAIL_AVAILABLE = False

try:
    import pdfplumber
    PDF_AVAILABLE = True
except ImportError:
    PDF_AVAILABLE = False

try:
    from docx import Document as DocxDocument
    DOCX_AVAILABLE = True
except ImportError:
    DOCX_AVAILABLE = False

# ── App Config ────────────────────────────────────────────────────────────────
# app = Flask(__name__)
app = Flask(__name__, template_folder="../templates", static_folder="../static")
app.secret_key = os.environ.get('SECRET_KEY', 'talentsift_v2_secret_2024_xyz')
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024   # 50 MB
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['ALLOWED_EXTENSIONS'] = {'pdf', 'doc', 'docx', 'txt'}

# Email config (set via env vars or edit here)
app.config['MAIL_SERVER']   = os.environ.get('MAIL_SERVER',   'smtp.gmail.com')
app.config['MAIL_PORT']     = int(os.environ.get('MAIL_PORT', 587))
app.config['MAIL_USERNAME'] = os.environ.get('MAIL_USERNAME', '')
app.config['MAIL_PASSWORD'] = os.environ.get('MAIL_PASSWORD', '')
app.config['MAIL_FROM']     = os.environ.get('MAIL_FROM',     'noreply@talentsift.com')

os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# ── Database (MongoDB with in-memory fallback) ────────────────────────────────
class DB:
    """Thin abstraction: MongoDB if available, else in-memory dicts."""
    def __init__(self):
        self.use_mongo = False
        self._users        = {}
        self._jobs         = {}
        self._resumes      = {}
        self._interviews   = {}
        self._notifications= []

        if MONGO_AVAILABLE:
            try:
                # client = MongoClient(
                #     os.environ.get('MONGO_URI', 'mongodb://localhost:27017/'),
                #     serverSelectionTimeoutMS=2000
                # )
                mongo_uri = os.environ.get("MONGO_URI")
                if mongo_uri:
                    try:
                        client = MongoClient(mongo_uri, serverSelectionTimeoutMS=5000)
                        client.server_info()
                        self.db = client["talentsift"]
                        self.use_mongo = True
                        print("✅ MongoDB connected")
                        self._seed_default_jobs_mongo()
                    except Exception as e:
                        print(f"⚠ MongoDB connection failed: {e}")
                        self.use_mongo = False
                        self._seed_memory()
                else:
                    print("MongoDB not configured, using in-memory DB")
                    self.use_mongo = False
                    self._seed_memory()

            except Exception as e:
                print(f"⚠️  MongoDB not available ({e}), using in-memory storage")
                self._seed_memory()
        else:
            print("⚠️  pymongo not installed, using in-memory storage")
            self._seed_memory()

    # ── Seed data ──────────────────────────────────────────────────────────
    def _seed_memory(self):
        admin_id = str(uuid.uuid4())
        self._users[admin_id] = {
            '_id': admin_id, 'name': 'HR Admin', 'email': 'admin@talentsift.com',
            'password': generate_password_hash('admin123'),
            'role': 'admin', 'created_at': datetime.now().isoformat()
        }
        for j in self._default_jobs():
            self._jobs[j['_id']] = j

    def _seed_default_jobs_mongo(self):
        if self.db.jobs.count_documents({}) == 0:
            for j in self._default_jobs():
                self.db.jobs.insert_one(j)
        if self.db.users.count_documents({}) == 0:
            self.db.users.insert_one({
                '_id': str(uuid.uuid4()), 'name': 'HR Admin',
                'email': 'admin@talentsift.com',
                'password': generate_password_hash('admin123'),
                'role': 'admin', 'created_at': datetime.now().isoformat()
            })

    def _default_jobs(self):
        return [
            {'_id': str(uuid.uuid4())[:8], 'title': 'Senior Python Developer',
             'department': 'Engineering', 'location': 'Remote',
             'required_skills': ['python','django','flask','postgresql','docker','rest api'],
             'preferred_skills': ['kubernetes','aws','redis','celery'],
             'min_experience': 3, 'status': 'active',
             'description': 'Build scalable backend services.',
             'created_at': datetime.now().isoformat()},
            {'_id': str(uuid.uuid4())[:8], 'title': 'Data Scientist',
             'department': 'Analytics', 'location': 'Hybrid',
             'required_skills': ['python','machine learning','pandas','numpy','scikit-learn'],
             'preferred_skills': ['tensorflow','pytorch','spark','sql'],
             'min_experience': 2, 'status': 'active',
             'description': 'Build predictive models.',
             'created_at': datetime.now().isoformat()},
            {'_id': str(uuid.uuid4())[:8], 'title': 'Frontend Engineer',
             'department': 'Product', 'location': 'On-site',
             'required_skills': ['javascript','react','html','css','git'],
             'preferred_skills': ['typescript','nextjs','tailwind','graphql'],
             'min_experience': 2, 'status': 'active',
             'description': 'Build beautiful user interfaces.',
             'created_at': datetime.now().isoformat()},
            {'_id': str(uuid.uuid4())[:8], 'title': 'DevOps Engineer',
             'department': 'Infrastructure', 'location': 'Remote',
             'required_skills': ['docker','kubernetes','aws','linux','ci/cd','terraform'],
             'preferred_skills': ['ansible','prometheus','grafana','jenkins'],
             'min_experience': 3, 'status': 'active',
             'description': 'Manage cloud infrastructure.',
             'created_at': datetime.now().isoformat()},
        ]

    # ── Generic CRUD ──────────────────────────────────────────────────────
    def _fix(self, doc):
        if doc and '_id' in doc:
            doc['_id'] = str(doc['_id'])
        return doc

    # Users
    def find_user_by_email(self, email):
        if self.use_mongo:
            u = self.db.users.find_one({'email': email})
            return self._fix(u)
        return next((u for u in self._users.values() if u['email'] == email), None)

    def find_user_by_id(self, uid):
        if self.use_mongo:
            u = self.db.users.find_one({'_id': uid})
            return self._fix(u)
        return self._users.get(uid)

    def create_user(self, data):
        uid = str(uuid.uuid4())
        data['_id'] = uid
        if self.use_mongo:
            self.db.users.insert_one(data)
        else:
            self._users[uid] = data
        return uid

    def all_users(self):
        if self.use_mongo:
            return [self._fix(u) for u in self.db.users.find()]
        return list(self._users.values())

    # Jobs
    def all_jobs(self, status=None):
        if self.use_mongo:
            q = {'status': status} if status else {}
            return [self._fix(j) for j in self.db.jobs.find(q)]
        jobs = list(self._jobs.values())
        if status:
            jobs = [j for j in jobs if j.get('status') == status]
        return jobs

    def find_job(self, jid):
        if self.use_mongo:
            j = self.db.jobs.find_one({'_id': jid})
            return self._fix(j)
        return self._jobs.get(jid)

    def create_job(self, data):
        jid = str(uuid.uuid4())[:8]
        data['_id'] = jid
        if self.use_mongo:
            self.db.jobs.insert_one(data)
        else:
            self._jobs[jid] = data
        return jid

    def update_job(self, jid, data):
        if self.use_mongo:
            self.db.jobs.update_one({'_id': jid}, {'$set': data})
        elif jid in self._jobs:
            self._jobs[jid].update(data)

    def delete_job(self, jid):
        if self.use_mongo:
            self.db.jobs.delete_one({'_id': jid})
        else:
            self._jobs.pop(jid, None)

    # Resumes
    def all_resumes(self, job_id=None, status=None, search=None):
        if self.use_mongo:
            q = {}
            if job_id:  q['job_id'] = job_id
            if status:  q['scoring.status'] = status
            docs = [self._fix(r) for r in self.db.resumes.find(q).sort('scoring.total_score', -1)]
        else:
            docs = list(self._resumes.values())
            if job_id:  docs = [r for r in docs if r.get('job_id') == job_id]
            if status:  docs = [r for r in docs if r.get('scoring', {}).get('status') == status]
            docs.sort(key=lambda x: x.get('scoring', {}).get('total_score', 0), reverse=True)
        if search:
            sl = search.lower()
            docs = [r for r in docs if
                sl in (r.get('parsed', {}).get('name', '') or '').lower() or
                sl in (r.get('parsed', {}).get('email', '') or '').lower() or
                sl in (r.get('job_title', '') or '').lower() or
                any(sl in s for s in r.get('parsed', {}).get('skills', []))]
        return docs

    def find_resume(self, rid):
        if self.use_mongo:
            r = self.db.resumes.find_one({'_id': rid})
            return self._fix(r)
        return self._resumes.get(rid)

    def create_resume(self, data):
        rid = str(uuid.uuid4())[:10]
        data['_id'] = rid
        if self.use_mongo:
            self.db.resumes.insert_one(data)
        else:
            self._resumes[rid] = data
        return rid

    def update_resume(self, rid, data):
        if self.use_mongo:
            self.db.resumes.update_one({'_id': rid}, {'$set': data})
        elif rid in self._resumes:
            self._resumes[rid].update(data)

    def delete_resume(self, rid):
        if self.use_mongo:
            self.db.resumes.delete_one({'_id': rid})
        else:
            self._resumes.pop(rid, None)

    def resume_count(self):
        if self.use_mongo:
            return self.db.resumes.count_documents({})
        return len(self._resumes)

    # Interviews
    def all_interviews(self, resume_id=None):
        if self.use_mongo:
            q = {'resume_id': resume_id} if resume_id else {}
            return [self._fix(i) for i in self.db.interviews.find(q)]
        interviews = list(self._interviews.values())
        if resume_id:
            interviews = [i for i in interviews if i.get('resume_id') == resume_id]
        return interviews

    def create_interview(self, data):
        iid = str(uuid.uuid4())[:10]
        data['_id'] = iid
        if self.use_mongo:
            self.db.interviews.insert_one(data)
        else:
            self._interviews[iid] = data
        return iid

    def update_interview(self, iid, data):
        if self.use_mongo:
            self.db.interviews.update_one({'_id': iid}, {'$set': data})
        elif iid in self._interviews:
            self._interviews[iid].update(data)

    def delete_interview(self, iid):
        if self.use_mongo:
            self.db.interviews.delete_one({'_id': iid})
        else:
            self._interviews.pop(iid, None)

    # Notifications
    def add_notification(self, data):
        data['_id'] = str(uuid.uuid4())[:8]
        data['read'] = False
        data['created_at'] = datetime.now().isoformat()
        if self.use_mongo:
            self.db.notifications.insert_one(data)
        else:
            self._notifications.append(data)

    def get_notifications(self, limit=20):
        if self.use_mongo:
            return [self._fix(n) for n in
                    self.db.notifications.find().sort('created_at', -1).limit(limit)]
        return sorted(self._notifications, key=lambda x: x.get('created_at',''), reverse=True)[:limit]

db = DB()

# ── Helpers ───────────────────────────────────────────────────────────────────
def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in app.config['ALLOWED_EXTENSIONS']

def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'error': 'Authentication required', 'redirect': '/login'}), 401
        return f(*args, **kwargs)
    return decorated

def role_required(*roles):
    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            if 'user_id' not in session:
                return jsonify({'error': 'Authentication required'}), 401
            user = db.find_user_by_id(session['user_id'])
            if not user or user.get('role') not in roles:
                return jsonify({'error': 'Insufficient permissions'}), 403
            return f(*args, **kwargs)
        return decorated
    return decorator

# ── Email ─────────────────────────────────────────────────────────────────────
def send_email(to_email, subject, html_body):
    if not app.config['MAIL_USERNAME']:
        print(f"[EMAIL DEMO] To: {to_email} | Subject: {subject}")
        return True
    try:
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From']    = app.config['MAIL_FROM']
        msg['To']      = to_email
        msg.attach(MIMEText(html_body, 'html'))
        with smtplib.SMTP(app.config['MAIL_SERVER'], app.config['MAIL_PORT']) as server:
            server.starttls()
            server.login(app.config['MAIL_USERNAME'], app.config['MAIL_PASSWORD'])
            server.send_message(msg)
        return True
    except Exception as e:
        print(f"Email error: {e}")
        return False

def email_shortlist(candidate_name, candidate_email, job_title):
    html = f"""
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      <div style="background:linear-gradient(135deg,#4cc9f0,#818cf8);padding:30px;border-radius:12px 12px 0 0">
        <h1 style="color:white;margin:0">TalentSift 🎉</h1>
      </div>
      <div style="background:#f8faff;padding:30px;border-radius:0 0 12px 12px">
        <h2 style="color:#0f172a">Congratulations, {candidate_name}!</h2>
        <p style="color:#475569">We are pleased to inform you that your application for
        <strong>{job_title}</strong> has been <strong style="color:#06d6a0">shortlisted</strong>.</p>
        <p style="color:#475569">Our team will reach out to you shortly for the next steps.</p>
        <div style="margin-top:24px;padding:16px;background:#e0fdf4;border-radius:8px;border-left:4px solid #06d6a0">
          <strong style="color:#065f46">Next Step:</strong>
          <p style="color:#065f46;margin:4px 0">Expect an interview scheduling email within 2–3 business days.</p>
        </div>
        <p style="color:#94a3b8;font-size:13px;margin-top:24px">— TalentSift Hiring Team</p>
      </div>
    </div>"""
    return send_email(candidate_email, f"🎉 Shortlisted for {job_title} — TalentSift", html)

def email_interview(candidate_name, candidate_email, job_title, interview_date, interview_time, interview_type, meeting_link=''):
    link_html = f'<p><a href="{meeting_link}" style="color:#4cc9f0">Join Meeting Link</a></p>' if meeting_link else ''
    html = f"""
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      <div style="background:linear-gradient(135deg,#f4a261,#ef4444);padding:30px;border-radius:12px 12px 0 0">
        <h1 style="color:white;margin:0">📅 Interview Scheduled</h1>
      </div>
      <div style="background:#f8faff;padding:30px;border-radius:0 0 12px 12px">
        <h2>Dear {candidate_name},</h2>
        <p>Your interview for <strong>{job_title}</strong> has been scheduled:</p>
        <div style="background:white;border:1px solid #e2e8f0;border-radius:10px;padding:20px;margin:16px 0">
          <p>📅 <strong>Date:</strong> {interview_date}</p>
          <p>🕐 <strong>Time:</strong> {interview_time}</p>
          <p>💼 <strong>Type:</strong> {interview_type}</p>
          {link_html}
        </div>
        <p style="color:#475569">Please confirm your availability by replying to this email.</p>
        <p style="color:#94a3b8;font-size:13px">— TalentSift Hiring Team</p>
      </div>
    </div>"""
    return send_email(candidate_email, f"📅 Interview Scheduled — {job_title}", html)

def email_rejection(candidate_name, candidate_email, job_title):
    html = f"""
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      <div style="background:#334155;padding:30px;border-radius:12px 12px 0 0">
        <h1 style="color:white;margin:0">TalentSift</h1>
      </div>
      <div style="background:#f8faff;padding:30px;border-radius:0 0 12px 12px">
        <h2>Dear {candidate_name},</h2>
        <p>Thank you for applying for <strong>{job_title}</strong>. After careful consideration,
        we have decided to move forward with other candidates at this time.</p>
        <p>We appreciate your interest and encourage you to apply for future openings.</p>
        <p style="color:#94a3b8;font-size:13px">— TalentSift Hiring Team</p>
      </div>
    </div>"""
    return send_email(candidate_email, f"Update on your application — {job_title}", html)

# ── Resume Parser ─────────────────────────────────────────────────────────────
ALL_SKILLS = [
    "python","java","javascript","typescript","c++","c#","ruby","go","rust","php","swift","kotlin","scala","r",
    "react","angular","vue","nextjs","nuxtjs","nodejs","express","django","flask","fastapi","spring","laravel",
    "sql","postgresql","mysql","mongodb","redis","elasticsearch","cassandra","sqlite","mariadb","dynamodb",
    "aws","azure","gcp","docker","kubernetes","terraform","ansible","jenkins","gitlab ci","github actions",
    "machine learning","deep learning","nlp","computer vision","tensorflow","pytorch","keras","xgboost",
    "pandas","numpy","scikit-learn","spark","hadoop","kafka","airflow","dbt","power bi","tableau",
    "git","agile","scrum","ci/cd","rest api","graphql","microservices","grpc","websockets",
    "html","css","sass","tailwind","bootstrap","webpack","vite","rollup","babel",
    "linux","bash","powershell","celery","rabbitmq","nginx","apache","prometheus","grafana",
    "figma","photoshop","illustrator","sketch","after effects",
    "excel","word","powerpoint","jira","confluence","notion","slack",
    "blockchain","solidity","web3","unity","unreal engine","opengl","vulkan",
    "flutter","react native","android","ios","xamarin",
]

def extract_text(filepath, ext):
    try:
        if ext == 'txt':
            with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                return f.read()
        if ext == 'pdf' and PDF_AVAILABLE:
            with pdfplumber.open(filepath) as pdf:
                return '\n'.join(p.extract_text() or '' for p in pdf.pages)
        if ext in ('doc','docx') and DOCX_AVAILABLE:
            doc = DocxDocument(filepath)
            return '\n'.join(p.text for p in doc.paragraphs)
        # Fallback: raw bytes → printable ASCII
        with open(filepath, 'rb') as f:
            raw = f.read()
        text = raw.decode('utf-8', errors='ignore')
        return re.sub(r'[^\x20-\x7E\n\r\t]', ' ', text)
    except Exception as e:
        print(f"Extract error: {e}")
        return ""

def parse_resume(text):
    tl = text.lower()
    # Email
    emails = re.findall(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', text)
    email = emails[0] if emails else 'Not found'
    # Phone
    phones = re.findall(r'(\+?[\d\s\-\(\)]{10,15})', text)
    phone = phones[0].strip() if phones else 'Not found'
    # Name (heuristic)
    name = 'Unknown Candidate'
    for line in [l.strip() for l in text.split('\n') if l.strip()][:6]:
        if 2 <= len(line.split()) <= 4 and re.match(r'^[A-Za-z\s\.\-]+$', line) and '@' not in line:
            name = line; break
    # Skills
    skills = [s for s in ALL_SKILLS if re.search(r'\b' + re.escape(s) + r'\b', tl)]
    # Experience
    exp = 0
    for pat in [r'(\d+)\+?\s*years?\s*(?:of\s*)?experience',
                r'experience\s*(?:of\s*)?(\d+)\+?\s*years?',
                r'(\d+)\+?\s*yrs?\s*(?:of\s*)?experience']:
        m = re.findall(pat, tl)
        if m: exp = max(int(x) for x in m); break
    # Education
    edu_map = [('phd','PhD / Doctorate'),('master','Master\'s Degree'),('mba','MBA'),
               ('m.tech','M.Tech'),('m.sc','M.Sc'),('m.e.','M.E.'),
               ('bachelor','Bachelor\'s Degree'),('b.tech','B.Tech'),
               ('b.sc','B.Sc'),('b.e.','B.E.'),('bca','BCA')]
    edu = 'Not specified'
    for key, label in edu_map:
        if key in tl: edu = label; break
    # Certifications
    certs = [c for c in ['aws certified','google certified','microsoft certified','pmp','cpa',
                          'cfa','cissp','comptia','oracle certified','pmi','six sigma']
             if c in tl]
    # Summary snippet
    lines = [l.strip() for l in text.split('\n') if len(l.strip()) > 40]
    summary = lines[0][:200] if lines else ''
    return dict(name=name, email=email, phone=phone, skills=skills,
                experience_years=exp, education=edu, certifications=certs, summary=summary)

def score_resume(parsed, job):
    if not job:
        return dict(total_score=0, rating='N/A', status='pending', breakdown={}, percentage=0)
    score = 0
    bd = {}
    rsk = set(job.get('required_skills', []))
    psk = set(job.get('preferred_skills', []))
    csk = set(parsed['skills'])

    # Required (50 pts)
    if rsk:
        rm = csk & rsk
        rs = int(len(rm)/len(rsk)*50)
        bd['required_skills'] = {'score':rs,'max':50,'matched':list(rm),'missing':list(rsk-csk)}
        score += rs

    # Preferred (25 pts)
    if psk:
        pm = csk & psk
        ps = int(len(pm)/len(psk)*25)
        bd['preferred_skills'] = {'score':ps,'max':25,'matched':list(pm),'missing':list(psk-csk)}
        score += ps

    # Experience (15 pts)
    ey = parsed['experience_years']
    me = job.get('min_experience', 0)
    es = 15 if ey >= me*1.5 else (12 if ey >= me else (7 if ey >= me-1 else 3))
    bd['experience'] = {'score':es,'max':15,'candidate_years':ey,'required_years':me}
    score += es

    # Education (10 pts)
    edu = parsed['education'].lower()
    edus = 10 if any(d in edu for d in ['phd','master','mba','m.tech','m.sc','m.e.']) \
           else (7 if any(d in edu for d in ['bachelor','b.tech','b.sc','b.e.','bca']) else 3)
    bd['education'] = {'score':edus,'max':10,'detected':parsed['education']}
    score += edus

    rating = 'Excellent' if score>=80 else ('Good' if score>=60 else ('Average' if score>=40 else 'Below Average'))
    status = 'shortlisted' if score>=80 else ('review' if score>=60 else ('maybe' if score>=40 else 'rejected'))
    return dict(total_score=score, max_score=100, percentage=score,
                rating=rating, status=status, breakdown=bd)

# ── Auth Routes ───────────────────────────────────────────────────────────────
@app.route('/')
def index():
    if 'user_id' not in session:
        return redirect('/login')
    return render_template('index.html')

@app.route('/login')
def login_page():
    if 'user_id' in session:
        return redirect('/')
    return render_template('login.html')

@app.route('/api/auth/login', methods=['POST'])
def login():
    d = request.get_json()
    user = db.find_user_by_email(d.get('email',''))
    if not user or not check_password_hash(user['password'], d.get('password','')):
        return jsonify({'error': 'Invalid email or password'}), 401
    session['user_id'] = user['_id']
    session['user_name'] = user['name']
    session['user_role'] = user['role']
    return jsonify({'success': True, 'user': {'name': user['name'], 'role': user['role'], 'email': user['email']}})

@app.route('/api/auth/register', methods=['POST'])
def register():
    d = request.get_json()
    if db.find_user_by_email(d.get('email','')):
        return jsonify({'error': 'Email already registered'}), 409
    uid = db.create_user({
        'name': d['name'], 'email': d['email'],
        'password': generate_password_hash(d['password']),
        'role': d.get('role', 'recruiter'),
        'created_at': datetime.now().isoformat()
    })
    return jsonify({'success': True, 'user_id': uid})

@app.route('/api/auth/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'success': True})

@app.route('/api/auth/me')
@login_required
def me():
    user = db.find_user_by_id(session['user_id'])
    if not user:
        return jsonify({'error': 'User not found'}), 404
    return jsonify({'user': {k: v for k, v in user.items() if k != 'password'}})

# ── Job Routes ────────────────────────────────────────────────────────────────
@app.route('/api/jobs', methods=['GET'])
@login_required
def get_jobs():
    status = request.args.get('status')
    return jsonify({'jobs': db.all_jobs(status)})

@app.route('/api/jobs', methods=['POST'])
@login_required
def create_job():
    d = request.get_json()
    jid = db.create_job({
        'title':             d['title'],
        'department':        d.get('department',''),
        'location':          d.get('location','Remote'),
        'required_skills':   [s.strip().lower() for s in d.get('required_skills','').split(',') if s.strip()],
        'preferred_skills':  [s.strip().lower() for s in d.get('preferred_skills','').split(',') if s.strip()],
        'min_experience':    int(d.get('min_experience', 0)),
        'description':       d.get('description',''),
        'status':            'active',
        'created_by':        session.get('user_id'),
        'created_at':        datetime.now().isoformat(),
    })
    db.add_notification({'type':'job_created','message':f"New job posted: {d['title']}"})
    return jsonify({'success': True, 'job_id': jid})

@app.route('/api/jobs/<jid>', methods=['PUT'])
@login_required
def update_job(jid):
    d = request.get_json()
    if 'required_skills' in d and isinstance(d['required_skills'], str):
        d['required_skills'] = [s.strip().lower() for s in d['required_skills'].split(',') if s.strip()]
    if 'preferred_skills' in d and isinstance(d['preferred_skills'], str):
        d['preferred_skills'] = [s.strip().lower() for s in d['preferred_skills'].split(',') if s.strip()]
    db.update_job(jid, d)
    return jsonify({'success': True})

@app.route('/api/jobs/<jid>', methods=['DELETE'])
@login_required
def delete_job(jid):
    db.delete_job(jid)
    return jsonify({'success': True})

# ── Upload / Bulk Upload ──────────────────────────────────────────────────────
@app.route('/api/upload', methods=['POST'])
@login_required
def upload_resume():
    if 'resume' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    file = request.files['resume']
    if not file.filename or not allowed_file(file.filename):
        return jsonify({'error': 'Invalid file type. Use PDF, DOC, DOCX, TXT'}), 400

    job_id = request.form.get('job_id','')
    job    = db.find_job(job_id) if job_id else (db.all_jobs('active') or [{}])[0]

    fname  = secure_filename(file.filename)
    fpath  = os.path.join(app.config['UPLOAD_FOLDER'], f"{uuid.uuid4().hex}_{fname}")
    file.save(fpath)
    ext    = fname.rsplit('.',1)[1].lower()
    text   = extract_text(fpath, ext)
    try: os.remove(fpath)
    except: pass

    parsed  = parse_resume(text)
    scoring = score_resume(parsed, job)

    rid = db.create_resume({
        'filename':    fname,
        'job_id':      job.get('_id',''),
        'job_title':   job.get('title','N/A'),
        'uploaded_by': session.get('user_id',''),
        'uploaded_at': datetime.now().isoformat(),
        'parsed':      parsed,
        'scoring':     scoring,
        'kanban_stage':'applied',
        'notes':       [],
        'tags':        [],
    })

    resume = db.find_resume(rid)
    db.add_notification({'type':'resume_uploaded',
                         'message':f"New resume: {parsed['name']} for {job.get('title','')}"})
    return jsonify({'success': True, 'resume': resume})

@app.route('/api/upload/bulk', methods=['POST'])
@login_required
def bulk_upload():
    files  = request.files.getlist('resumes')
    job_id = request.form.get('job_id','')
    job    = db.find_job(job_id) if job_id else (db.all_jobs('active') or [{}])[0]

    results = []
    for file in files:
        if not file.filename or not allowed_file(file.filename):
            results.append({'filename': file.filename, 'error': 'Invalid file type'})
            continue
        fname = secure_filename(file.filename)
        fpath = os.path.join(app.config['UPLOAD_FOLDER'], f"{uuid.uuid4().hex}_{fname}")
        file.save(fpath)
        ext   = fname.rsplit('.',1)[1].lower()
        text  = extract_text(fpath, ext)
        try: os.remove(fpath)
        except: pass
        parsed  = parse_resume(text)
        scoring = score_resume(parsed, job)
        rid = db.create_resume({
            'filename':    fname,
            'job_id':      job.get('_id',''),
            'job_title':   job.get('title','N/A'),
            'uploaded_by': session.get('user_id',''),
            'uploaded_at': datetime.now().isoformat(),
            'parsed':      parsed,
            'scoring':     scoring,
            'kanban_stage':'applied',
            'notes': [], 'tags': [],
        })
        results.append({'filename': fname, 'resume_id': rid,
                        'name': parsed['name'], 'score': scoring['total_score'],
                        'status': scoring['status']})
    db.add_notification({'type':'bulk_upload','message':f"Bulk upload: {len(files)} resumes processed"})
    return jsonify({'success': True, 'results': results, 'total': len(files)})

# ── Resume Routes ─────────────────────────────────────────────────────────────
@app.route('/api/resumes')
@login_required
def get_resumes():
    docs = db.all_resumes(
        job_id=request.args.get('job_id',''),
        status=request.args.get('status',''),
        search=request.args.get('search','')
    )
    return jsonify({'resumes': docs, 'total': len(docs)})

@app.route('/api/resumes/<rid>', methods=['GET'])
@login_required
def get_resume(rid):
    r = db.find_resume(rid)
    if not r: return jsonify({'error': 'Not found'}), 404
    return jsonify({'resume': r})

@app.route('/api/resumes/<rid>', methods=['PUT'])
@login_required
def update_resume_route(rid):
    d = request.get_json()
    db.update_resume(rid, d)
    return jsonify({'success': True})

@app.route('/api/resumes/<rid>', methods=['DELETE'])
@login_required
def delete_resume_route(rid):
    db.delete_resume(rid)
    return jsonify({'success': True})

@app.route('/api/resumes/<rid>/status', methods=['PUT'])
@login_required
def update_status(rid):
    d = request.get_json()
    new_status = d.get('status')
    r = db.find_resume(rid)
    if not r: return jsonify({'error': 'Not found'}), 404

    db.update_resume(rid, {'scoring.status': new_status})

    # Send email
    parsed = r.get('parsed', {})
    if new_status == 'shortlisted':
        email_shortlist(parsed.get('name','Candidate'),
                        parsed.get('email',''),
                        r.get('job_title','the position'))
        db.add_notification({'type':'shortlisted',
                             'message':f"{parsed.get('name')} shortlisted for {r.get('job_title','')}"})
    elif new_status == 'rejected':
        email_rejection(parsed.get('name','Candidate'),
                        parsed.get('email',''),
                        r.get('job_title','the position'))

    return jsonify({'success': True})

@app.route('/api/resumes/<rid>/note', methods=['POST'])
@login_required
def add_note(rid):
    d = request.get_json()
    note = {'text': d.get('text',''), 'by': session.get('user_name',''),
            'at': datetime.now().isoformat()}
    r = db.find_resume(rid)
    if not r: return jsonify({'error': 'Not found'}), 404
    notes = r.get('notes', []) + [note]
    db.update_resume(rid, {'notes': notes})
    return jsonify({'success': True, 'note': note})

@app.route('/api/resumes/<rid>/kanban', methods=['PUT'])
@login_required
def update_kanban(rid):
    d = request.get_json()
    db.update_resume(rid, {'kanban_stage': d.get('stage','applied')})
    return jsonify({'success': True})

# ── Export ────────────────────────────────────────────────────────────────────
@app.route('/api/export/csv')
@login_required
def export_csv():
    resumes = db.all_resumes()
    output  = io.StringIO()
    writer  = csv.writer(output)
    writer.writerow(['Name','Email','Phone','Job Title','Score','Rating','Status',
                     'Experience','Education','Skills','Uploaded At'])
    for r in resumes:
        p = r.get('parsed', {})
        s = r.get('scoring', {})
        writer.writerow([
            p.get('name',''), p.get('email',''), p.get('phone',''),
            r.get('job_title',''), s.get('total_score',''), s.get('rating',''), s.get('status',''),
            p.get('experience_years',''), p.get('education',''),
            ', '.join(p.get('skills',[])), r.get('uploaded_at','')
        ])
    output.seek(0)
    return send_file(io.BytesIO(output.getvalue().encode()),
                     mimetype='text/csv',
                     as_attachment=True,
                     download_name=f"talentsift_export_{datetime.now().strftime('%Y%m%d')}.csv")

# ── Interview Scheduler ───────────────────────────────────────────────────────
@app.route('/api/interviews', methods=['GET'])
@login_required
def get_interviews():
    resume_id = request.args.get('resume_id','')
    return jsonify({'interviews': db.all_interviews(resume_id or None)})

@app.route('/api/interviews', methods=['POST'])
@login_required
def create_interview():
    d = request.get_json()
    resume_id = d.get('resume_id','')
    r = db.find_resume(resume_id)

    iid = db.create_interview({
        'resume_id':      resume_id,
        'candidate_name': d.get('candidate_name',''),
        'candidate_email':d.get('candidate_email',''),
        'job_title':      d.get('job_title',''),
        'interview_date': d.get('interview_date',''),
        'interview_time': d.get('interview_time',''),
        'interview_type': d.get('interview_type','Video Call'),
        'interviewer':    d.get('interviewer',''),
        'meeting_link':   d.get('meeting_link',''),
        'notes':          d.get('notes',''),
        'status':         'scheduled',
        'created_at':     datetime.now().isoformat(),
        'created_by':     session.get('user_id',''),
    })

    # Update resume kanban stage
    if r:
        db.update_resume(resume_id, {'kanban_stage': 'interview'})

    # Send email
    email_interview(
        d.get('candidate_name','Candidate'),
        d.get('candidate_email',''),
        d.get('job_title',''),
        d.get('interview_date',''),
        d.get('interview_time',''),
        d.get('interview_type','Video Call'),
        d.get('meeting_link','')
    )

    db.add_notification({'type':'interview_scheduled',
                         'message':f"Interview scheduled: {d.get('candidate_name')} on {d.get('interview_date')}"})
    return jsonify({'success': True, 'interview_id': iid})

@app.route('/api/interviews/<iid>', methods=['PUT'])
@login_required
def update_interview_route(iid):
    db.update_interview(iid, request.get_json())
    return jsonify({'success': True})

@app.route('/api/interviews/<iid>', methods=['DELETE'])
@login_required
def delete_interview_route(iid):
    db.delete_interview(iid)
    return jsonify({'success': True})

# ── Stats & Notifications ─────────────────────────────────────────────────────
@app.route('/api/stats')
@login_required
def stats():
    resumes = db.all_resumes()
    total   = len(resumes)
    def cnt(st): return sum(1 for r in resumes if r.get('scoring',{}).get('status')==st)
    avg = round(sum(r.get('scoring',{}).get('total_score',0) for r in resumes)/total,1) if total else 0
    interviews = db.all_interviews()
    jobs = db.all_jobs('active')
    return jsonify({
        'total': total, 'shortlisted': cnt('shortlisted'),
        'review': cnt('review'), 'maybe': cnt('maybe'),
        'rejected': cnt('rejected'), 'avg_score': avg,
        'total_interviews': len(interviews),
        'active_jobs': len(jobs),
    })

@app.route('/api/analytics/skills')
@login_required
def analytics_skills():
    resumes = db.all_resumes()
    counts = {}
    for r in resumes:
        for s in r.get('parsed',{}).get('skills',[]):
            counts[s] = counts.get(s,0)+1
    top = sorted(counts.items(), key=lambda x: x[1], reverse=True)[:15]
    return jsonify({'skills': [{'skill':k,'count':v} for k,v in top]})

@app.route('/api/analytics/timeline')
@login_required
def analytics_timeline():
    resumes = db.all_resumes()
    by_day = {}
    for r in resumes:
        day = r.get('uploaded_at','')[:10]
        if day: by_day[day] = by_day.get(day,0)+1
    data = [{'date':k,'count':v} for k,v in sorted(by_day.items())]
    return jsonify({'timeline': data})

@app.route('/api/notifications')
@login_required
def get_notifications():
    return jsonify({'notifications': db.get_notifications(30)})

@app.route('/api/users')
@login_required
def get_users():
    users = [{'_id':u['_id'],'name':u['name'],'email':u['email'],'role':u['role']}
             for u in db.all_users()]
    return jsonify({'users': users})

if __name__ == '__main__':
    print("\n" + "="*50)
    print("  TalentSift v2 — Resume Screening System")
    print("="*50)
    print(f"  MongoDB:  {'✅ Available' if MONGO_AVAILABLE else '⚠️  Using in-memory'}")
    print(f"  PDF:      {'✅ pdfplumber' if PDF_AVAILABLE else '⚠️  Basic extraction'}")
    print(f"  DOCX:     {'✅ python-docx' if DOCX_AVAILABLE else '⚠️  Basic extraction'}")
    print(f"  URL:      http://localhost:5000")
    print(f"  Login:    admin@talentsift.com / admin123")
    print("="*50 + "\n")
    app.run(debug=True, port=5000)

    import traceback

@app.errorhandler(Exception)
def handle_exception(e):
    return traceback.format_exc(), 500
