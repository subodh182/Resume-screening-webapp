# TalentSift v2 — Advanced Resume Screening System

A fully-featured, production-ready AI-powered Resume Screening System with MongoDB, Email Notifications, Bulk Upload, Interview Scheduler, Kanban Board, Role-based Authentication, and Advanced Analytics.

---

## ✨ Complete Feature List

| Feature | Status |
|---------|--------|
| 🔐 Login / Register (Role-based Auth) | ✅ |
| 🗄️ MongoDB Database (with in-memory fallback) | ✅ |
| 📄 Single Resume Upload & AI Scoring | ✅ |
| 📂 Bulk Resume Upload (50+ at once) | ✅ |
| 📊 Smart Scoring Engine (100 points) | ✅ |
| 👥 Candidates Grid with Filters | ✅ |
| 🎛️ Kanban Board (Drag & Drop) | ✅ |
| 📅 Interview Scheduler + Email | ✅ |
| 📧 Email Notifications (Shortlist/Reject/Interview) | ✅ |
| 💼 Job Position Manager (CRUD) | ✅ |
| 📈 Advanced Analytics Dashboard | ✅ |
| 🔔 Notifications Center | ✅ |
| 📤 CSV Export | ✅ |
| 📝 Recruiter Notes | ✅ |
| 🌙 Dark & Light Theme | ✅ |
| 📱 Fully Responsive (Mobile/Tablet/Desktop) | ✅ |
| 🔍 Global Search | ✅ |

---

## 📁 Project Structure

```
talentsift_v2/
├── app.py                   # Flask backend (main server, all API endpoints)
├── requirements.txt         # Python dependencies
├── README.md                # This file
├── uploads/                 # Temporary upload directory (auto-created)
├── templates/
│   ├── index.html           # Main SPA (all pages)
│   └── login.html           # Login/Register page
└── static/
    ├── css/
    │   └── style.css        # Complete UI (dark + light themes)
    └── js/
        └── app.js           # All frontend logic
```

---

## 🚀 Quick Start

### Step 1 — Install Python Dependencies

```bash
# Basic (works without MongoDB)
pip install flask werkzeug

# Full features (recommended)
pip install flask werkzeug pymongo pdfplumber python-docx
```

### Step 2 — Configure (Optional)

**Email notifications** — Edit `app.py` or set environment variables:
```bash
export MAIL_USERNAME="your@gmail.com"
export MAIL_PASSWORD="your-app-password"
export MAIL_FROM="noreply@yourcompany.com"
```

**MongoDB** — Install and start MongoDB:
```bash
# macOS
brew install mongodb-community && brew services start mongodb-community

# Ubuntu
sudo apt install mongodb && sudo systemctl start mongodb

# Windows: Download from mongodb.com
```

Or use MongoDB Atlas (cloud): set `MONGO_URI` environment variable:
```bash
export MONGO_URI="mongodb+srv://user:pass@cluster.mongodb.net/"
```

### Step 3 — Run

```bash
python app.py
```

### Step 4 — Open Browser
```
http://localhost:5000
```

**Default Login:**
- Email: `admin@talentsift.com`
- Password: `admin123`

---

## 📖 Feature Guide

### 🔐 Authentication
- **Login/Register** with role-based access
- Roles: `admin`, `hr_manager`, `recruiter`
- Sessions persist across browser tabs

### 📄 Single Resume Upload
1. Go to **Upload Resume** page
2. Select the target job position
3. Drag & drop or click to upload (PDF, DOC, DOCX, TXT)
4. Click **Analyze Resume**
5. View animated 4-step analysis
6. See full results: score ring, breakdown, matched/missing skills
7. Shortlist or Reject (sends automatic email)

### 📂 Bulk Upload
1. Go to **Bulk Upload** page
2. Select job position
3. Drop multiple files at once (up to 50)
4. Click **Analyze All Resumes**
5. Get a table of results for all resumes

### 🎛️ Kanban Board
- **6 stages**: Applied → Screening → Interview → Offer → Hired → Rejected
- **Drag & Drop** cards between stages
- Auto-updates database on drop
- Visual count per stage

### 📅 Interview Scheduler
- Schedule interviews from Candidates page (📅 button) or Interviews page
- Fills candidate info automatically from resume
- Types: Video Call, Phone, Technical, HR Round, In-Person, Panel
- **Sends email** to candidate with date, time, type, and meeting link
- Mini calendar view with event dots
- Click any date to see scheduled interviews

### 📧 Email Notifications
Three automatic emails:
1. **Shortlist Email** — Congratulations + next steps
2. **Interview Email** — Date, time, type, meeting link
3. **Rejection Email** — Professional rejection notice

> If MAIL_USERNAME is not configured, emails are logged to console (demo mode)

### 💼 Job Positions
- Create, view, and edit job postings
- Fields: title, department, location, required skills, preferred skills, min experience, status, description
- Status: Active / Paused / Closed
- Scoring engine uses required/preferred skills for matching

### 📈 Analytics
- **Top Skills in Demand** — Bar chart of most common skills
- **Score Distribution** — How candidates score across ranges
- **Status Breakdown** — Shortlisted vs Review vs Maybe vs Rejected
- **Upload Timeline** — Daily upload trend chart
- **Pipeline Health** — Key metrics at a glance

### 📝 Recruiter Notes
- Open any candidate's detail modal
- Add timestamped notes visible to all team members

### 📤 CSV Export
- Click **⬇ CSV** button in topbar
- Downloads all candidates with: name, email, phone, score, status, skills, etc.

---

## 🔧 API Reference

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/register` | Register |
| POST | `/api/auth/logout` | Logout |
| GET | `/api/auth/me` | Current user info |

### Jobs
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/jobs` | List jobs |
| POST | `/api/jobs` | Create job |
| PUT | `/api/jobs/<id>` | Update job |
| DELETE | `/api/jobs/<id>` | Delete job |

### Resumes
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/upload` | Upload single resume |
| POST | `/api/upload/bulk` | Bulk upload resumes |
| GET | `/api/resumes` | List resumes (filterable) |
| GET | `/api/resumes/<id>` | Get single resume |
| PUT | `/api/resumes/<id>/status` | Update status + send email |
| PUT | `/api/resumes/<id>/kanban` | Move kanban stage |
| POST | `/api/resumes/<id>/note` | Add recruiter note |
| DELETE | `/api/resumes/<id>` | Delete resume |

### Interviews
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/interviews` | List interviews |
| POST | `/api/interviews` | Schedule + send email |
| PUT | `/api/interviews/<id>` | Update interview |
| DELETE | `/api/interviews/<id>` | Delete interview |

### Analytics & Misc
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/stats` | Dashboard statistics |
| GET | `/api/analytics/skills` | Top skills data |
| GET | `/api/analytics/timeline` | Upload timeline |
| GET | `/api/notifications` | Recent notifications |
| GET | `/api/export/csv` | Download CSV |

---

## 🎨 Scoring Algorithm

| Category | Points | Calculation |
|----------|--------|-------------|
| Required Skills | 50 | (matched / total required) × 50 |
| Preferred Skills | 25 | (matched / total preferred) × 25 |
| Experience | 15 | ≥ 1.5× required → 15pts; ≥ required → 12pts; within 1yr → 7pts |
| Education | 10 | PhD/Master → 10pts; Bachelor → 7pts; Other → 3pts |

**Rating:**
- 80–100: Excellent → Shortlisted
- 60–79: Good → Under Review
- 40–59: Average → Maybe
- 0–39: Below Average → Rejected

---

## 🔒 Security Notes

- Passwords hashed with Werkzeug PBKDF2
- Session-based auth (Flask sessions)
- Files deleted immediately after parsing
- For production: use HTTPS, stronger SECRET_KEY, proper MongoDB auth

---

## 🛠️ Production Upgrades

1. **Use gunicorn**: `pip install gunicorn && gunicorn -w 4 app:app`
2. **Environment file**: Create `.env` for secrets
3. **Rate limiting**: `pip install flask-limiter`
4. **File storage**: Store in S3/GCS instead of local disk
5. **Real OCR**: `pip install pytesseract` for scanned PDFs
6. **LLM Integration**: Connect Claude API for semantic scoring

---

## 👤 Default Users

| Email | Password | Role |
|-------|----------|------|
| admin@talentsift.com | admin123 | admin |

Create more users via the Register page.

---

**Built with Flask + MongoDB + Vanilla JS | TalentSift v2**
# Created By Subodh Singh (Software Developer)
