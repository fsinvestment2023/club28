import random
from fastapi import FastAPI, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from database import engine, SessionLocal, Base
import models
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime, timedelta, date, time

# Create Tables
Base.metadata.create_all(bind=engine)

app = FastAPI()

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_db():
    db = SessionLocal()
    try: yield db
    finally: db.close()

# --- IN-MEMORY OTP STORAGE ---
otp_storage = {}

# --- PYDANTIC MODELS ---
class OTPRequest(BaseModel):
    phone: str

class RegisterRequest(BaseModel):
    phone: str
    otp: str
    name: str
    password: str

class LoginRequest(BaseModel):
    team_id: str
    password: str

class ResetPasswordRequest(BaseModel):
    phone: str
    otp: str
    new_password: str

class TournamentCreate(BaseModel):
    name: str
    type: str
    fee: str
    prize: str

class TournamentUpdate(BaseModel):
    id: int
    name: str
    fee: str
    prize: str
    status: str

class MatchCreate(BaseModel):
    category: str
    group_id: str
    t1: str
    t2: str
    date: date
    time: time

class ScoreSubmit(BaseModel):
    match_id: int
    category: str
    t1_name: str
    t2_name: str
    score: str
    submitted_by_team: str

class ScoreVerify(BaseModel):
    match_id: int
    action: str

class AdminScoreUpdate(BaseModel):
    match_id: int
    score: str

class MatchScheduleUpdate(BaseModel):
    match_id: int
    date: date
    time: time

class WalletUpdate(BaseModel):
    team_id: str
    amount: int

# --- AUTH ENDPOINTS ---

@app.post("/auth/send-otp")
def send_otp(req: OTPRequest):
    otp = str(random.randint(1000, 9999))
    otp_storage[req.phone] = otp
    print(f"DEBUG OTP for {req.phone}: {otp}") 
    return {"status": "sent", "debug_otp": otp}

@app.post("/auth/register")
def register(req: RegisterRequest, db: Session = Depends(get_db)):
    if otp_storage.get(req.phone) != req.otp:
        raise HTTPException(status_code=400, detail="Invalid OTP")
    
    if db.query(models.User).filter(models.User.phone == req.phone).first():
        raise HTTPException(status_code=400, detail="Phone already used")

    clean_name = req.name.replace(" ", "").upper()[:3]
    new_team_id = f"{clean_name}{random.randint(100,999)}"
    while db.query(models.User).filter(models.User.team_id == new_team_id).first():
        new_team_id = f"{clean_name}{random.randint(100,999)}"

    new_user = models.User(
        phone=req.phone, name=req.name, password=req.password,
        team_id=new_team_id, wallet_balance=0, active_category=None
    )
    db.add(new_user)
    db.commit()
    del otp_storage[req.phone]
    return {"status": "created", "team_id": new_team_id, "user": new_user}

@app.post("/auth/login")
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.team_id == req.team_id).first()
    if not user or user.password != req.password:
        raise HTTPException(status_code=401, detail="Invalid Team ID or Password")
    return {"status": "success", "user": user}

@app.post("/auth/reset-password")
def reset_password(req: ResetPasswordRequest, db: Session = Depends(get_db)):
    if otp_storage.get(req.phone) != req.otp:
        raise HTTPException(status_code=400, detail="Invalid OTP")
    
    user = db.query(models.User).filter(models.User.phone == req.phone).first()
    if not user: raise HTTPException(status_code=404, detail="User not found")
    
    user.password = req.new_password
    db.commit()
    del otp_storage[req.phone]
    return {"status": "success", "team_id": user.team_id}

# --- NEW: GET USER PROFILE (For Auto-Refresh) ---
@app.get("/user/{team_id}")
def get_user_profile(team_id: str, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.team_id == team_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

# --- TOURNAMENTS & MATCHES ---

@app.get("/tournaments")
def get_tournaments(db: Session = Depends(get_db)):
    return db.query(models.Tournament).all()

@app.post("/admin/create-tournament")
def create_tournament(data: TournamentCreate, db: Session = Depends(get_db)):
    exists = db.query(models.Tournament).filter(models.Tournament.name == data.name).first()
    if exists: return {"message": "Tournament exists"}
    new_t = models.Tournament(name=data.name, type=data.type, fee=data.fee, prize=data.prize, status="Open")
    db.add(new_t)
    db.commit()
    return {"message": "Tournament Created"}

@app.post("/admin/edit-tournament")
def admin_edit_tournament(data: TournamentUpdate, db: Session = Depends(get_db)):
    tourney = db.query(models.Tournament).filter(models.Tournament.id == data.id).first()
    if tourney:
        tourney.name = data.name
        tourney.fee = data.fee
        tourney.prize = data.prize
        tourney.status = data.status
        db.commit()
    return {"message": "Tournament Updated"}

@app.post("/admin/create-match")
def admin_create_match(match: MatchCreate, db: Session = Depends(get_db)):
    new_match = models.Match(
        category=match.category, group_id=match.group_id, t1=match.t1, t2=match.t2,
        date=match.date, time=match.time, status="Scheduled", stage="Group"
    )
    db.add(new_match)
    db.commit()
    return {"message": "Match Created"}

@app.get("/generate-test-season")
def generate_test_season(db: Session = Depends(get_db)):
    if not db.query(models.Tournament).filter(models.Tournament.name == "Club 28 League").first():
        db.add(models.Tournament(name="Club 28 League", type="League", fee="2,500", prize="50,000", status="Ongoing"))
    if not db.query(models.Tournament).filter(models.Tournament.name == "Saturday Cup").first():
        db.add(models.Tournament(name="Saturday Cup", type="1-Day", fee="1,000", prize="10,000", status="Open"))
    db.commit()

    existing = db.query(models.Match).all()
    if len(existing) > 0:
        return {"message": "Loaded", "full_schedule": {"schedule": [{"id": m.id, "category": m.category, "group": m.group_id, "t1": m.t1, "t2": m.t2, "time": m.time, "date": m.date, "stage": m.stage, "status": m.status} for m in existing]}}

    matches = []
    start_date = datetime(2025, 1, 20)
    groups = ['A', 'B', 'C', 'D']
    for group in groups:
        g_players = [f"{group}{i}" for i in range(1,5)]
        for i in range(len(g_players)):
            for j in range(i + 1, len(g_players)):
                matches.append({"cat": "Club 28 League", "g": group, "t1": g_players[i], "t2": g_players[j]})
    
    for idx, m in enumerate(matches):
        day = idx % 8
        time_slot = idx % 3
        m_date = (start_date + timedelta(days=day)).date()
        m_time = time(20 + time_slot, 0)
        db.add(models.Match(category=m['cat'], group_id=m['g'], t1=m['t1'], t2=m['t2'], date=m_date, time=m_time, status="Scheduled"))
    db.commit()
    return {"message": "Generated"}

# --- UTILS & SCORING ---
def calculate_winner(score_str, t1, t2):
    if not score_str: return None
    try:
        t1_s, t2_s = 0, 0
        sets = score_str.split(',')
        for s in sets:
            p = s.strip().split('-')
            if len(p) == 2:
                if int(p[0]) > int(p[1]): t1_s += 1
                elif int(p[1]) > int(p[0]): t2_s += 1
        if t1_s > t2_s: return t1
        if t2_s > t1_s: return t2
    except: return None
    return None

@app.get("/standings/{category}")
def get_standings(category: str, db: Session = Depends(get_db)):
    matches = db.query(models.Match).filter(models.Match.category == category, models.Match.status == "Official").all()
    stats = {}
    all_teams = set()
    for m in db.query(models.Match).filter(models.Match.category == category).all():
        all_teams.add(m.t1); all_teams.add(m.t2)
    for team in all_teams: stats[team] = {"points": 0, "played": 0, "won": 0, "group": "A"}
    for m in matches:
        if m.t1 in stats: stats[m.t1]["played"] += 1
        if m.t2 in stats: stats[m.t2]["played"] += 1
        winner = calculate_winner(m.score, m.t1, m.t2)
        if winner and winner in stats: stats[winner]["points"] += 3; stats[winner]["won"] += 1
    result = []
    for team, s in stats.items():
        grp = "A"
        found = next((x for x in db.query(models.Match).filter(models.Match.category == category).all() if x.t1 == team or x.t2 == team), None)
        if found: grp = found.group_id
        result.append({"name": team, "team_id": team, "group": grp, "points": s["points"], "gamesWon": s["won"], "played": s["played"]})
    return result

@app.get("/scores")
def get_scores(db: Session = Depends(get_db)): return db.query(models.Match).all()

@app.post("/submit-score")
def submit_score(data: ScoreSubmit, db: Session = Depends(get_db)):
    match = db.query(models.Match).filter(models.Match.id == data.match_id).first()
    if match: match.score = data.score; match.submitted_by_team = data.submitted_by_team; match.status = "Pending Verification"; db.commit()
    return {"msg": "ok"}

@app.post("/verify-score")
def verify_score(data: ScoreVerify, db: Session = Depends(get_db)):
    match = db.query(models.Match).filter(models.Match.id == data.match_id).first()
    if match: match.status = "Official" if data.action == "APPROVE" else "Disputed"; db.commit()
    return {"msg": "ok"}

@app.post("/admin/update-score")
def admin_update(data: AdminScoreUpdate, db: Session = Depends(get_db)):
    match = db.query(models.Match).filter(models.Match.id == data.match_id).first()
    if match: match.score = data.score; match.status = "Official"; db.commit()
    return {"msg": "ok"}

@app.post("/admin/edit-schedule")
def admin_edit(data: MatchScheduleUpdate, db: Session = Depends(get_db)):
    match = db.query(models.Match).filter(models.Match.id == data.match_id).first()
    if match: match.date = data.date; match.time = data.time; db.commit()
    return {"msg": "ok"}

@app.post("/admin/reset-event")
def admin_reset(db: Session = Depends(get_db)):
    db.query(models.Match).delete(); db.query(models.Tournament).delete(); db.commit()
    return {"msg": "reset"}

# --- ADMIN PLAYER & WALLET ---
@app.get("/admin/users")
def get_all_users(db: Session = Depends(get_db)):
    return db.query(models.User).all()

@app.post("/admin/add-funds")
def add_funds(data: WalletUpdate, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.team_id == data.team_id).first()
    if not user: 
        raise HTTPException(status_code=404, detail="User not found")
    
    user.wallet_balance += data.amount
    db.commit()
    return {"message": "Funds Added", "new_balance": user.wallet_balance, "user": user.name}