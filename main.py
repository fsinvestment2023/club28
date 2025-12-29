from fastapi import FastAPI, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from database import engine, SessionLocal, Base
import models
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime, timedelta

Base.metadata.create_all(bind=engine)
app = FastAPI()

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

# --- MODELS ---
class UserLogin(BaseModel):
    phone: str
    name: str

class TournamentCreate(BaseModel):
    name: str
    type: str
    fee: str
    prize: str

class MatchCreate(BaseModel):
    category: str
    group_id: str
    t1: str
    t2: str
    date: str
    time: str

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
    date: str
    time: str

# --- ENDPOINTS ---

@app.post("/login")
def login(user: UserLogin, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.phone == user.phone).first()
    if not db_user:
        # Default to Club 28 League so the screen isn't empty
        new_user = models.User(phone=user.phone, name=user.name, wallet_balance=0, team_id="PENDING", active_category="Club 28 League")
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        return {"status": "created", "user": new_user}
    return {"status": "found", "user": db_user}

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
    # 1. Ensure Default Tournaments Exist
    if not db.query(models.Tournament).filter(models.Tournament.name == "Club 28 League").first():
        db.add(models.Tournament(name="Club 28 League", type="League", fee="2,500", prize="50,000", status="Ongoing"))
    
    if not db.query(models.Tournament).filter(models.Tournament.name == "Saturday Cup").first():
        db.add(models.Tournament(name="Saturday Cup", type="1-Day", fee="1,000", prize="10,000", status="Open"))
    
    db.commit()

    # 2. Check Matches
    existing = db.query(models.Match).all()
    if len(existing) > 0:
        return {"message": "Loaded", "full_schedule": {"schedule": [{"id": m.id, "category": m.category, "group": m.group_id, "t1": m.t1, "t2": m.t2, "time": m.time, "date": m.date, "stage": m.stage, "status": m.status} for m in existing]}}

    # 3. Generate Mock Data (Players)
    groups = ['A', 'B', 'C', 'D']
    for group in groups:
        for i in range(1, 5): 
            t_code = f"{group}{i}"
            if not db.query(models.User).filter(models.User.team_id == t_code).first():
                db.add(models.User(phone=f"999{t_code}", name=f"Player {t_code}", team_id=t_code, group_id=group, active_category="Club 28 League", wallet_balance=10000))
    db.commit()

    # 4. Generate Matches for LEAGUE (8 Days)
    matches = []
    start_date = datetime(2025, 1, 20)
    
    # League Data
    for group in groups:
        # Get fake bots
        g_players = [f"{group}{i}" for i in range(1,5)]
        for i in range(len(g_players)):
            for j in range(i + 1, len(g_players)):
                matches.append({"cat": "Club 28 League", "g": group, "t1": g_players[i], "t2": g_players[j]})
    
    for idx, m in enumerate(matches):
        day = idx % 8
        time_slot = idx % 3
        db.add(models.Match(
            category=m['cat'], group_id=m['g'], t1=m['t1'], t2=m['t2'],
            date=(start_date + timedelta(days=day)).strftime("%Y-%m-%d"),
            time=f"{20 + time_slot}:00", status="Scheduled"
        ))

    # 5. Generate Matches for 1-DAY CUP (Single Day)
    cup_matches = [
        {"t1": "A1", "t2": "B1"}, {"t1": "C1", "t2": "D1"},
        {"t1": "A2", "t2": "B2"}, {"t1": "C2", "t2": "D2"}
    ]
    for m in cup_matches:
        db.add(models.Match(
            category="Saturday Cup", group_id="KO", t1=m['t1'], t2=m['t2'],
            date="2025-01-25", time="10:00", status="Scheduled", stage="Knockout"
        ))

    db.commit()
    return {"message": "Generated"}

# --- UTILS ---
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
        if len(sets) == 1:
             p = sets[0].strip().split('-')
             return t1 if int(p[0]) > int(p[1]) else t2
    except: return None
    return None

@app.get("/standings/{category}")
def get_standings(category: str, db: Session = Depends(get_db)):
    users = db.query(models.User).filter(models.User.active_category == category).all()
    matches = db.query(models.Match).filter(models.Match.category == category, models.Match.status == "Official").all()
    standings = []
    
    # If no users found (e.g. for Saturday Cup where we didn't assign users explicitly), mock them based on matches
    if not users:
        match_teams = set()
        all_matches = db.query(models.Match).filter(models.Match.category == category).all()
        for m in all_matches:
            match_teams.add(m.t1)
            match_teams.add(m.t2)
        users = [models.User(name=t, team_id=t, group_id="KO") for t in match_teams]

    for user in users:
        points = 0
        played = 0
        for m in matches:
            if m.t1 == user.team_id or m.t2 == user.team_id:
                played += 1
                if calculate_winner(m.score, m.t1, m.t2) == user.team_id: points += 3
        standings.append({"name": user.name, "team_id": user.team_id, "group": user.group_id, "points": points, "gamesWon": 0, "played": played})
    return standings

@app.get("/scores")
def get_scores(db: Session = Depends(get_db)):
    return db.query(models.Match).all()

@app.post("/submit-score")
def submit_score(data: ScoreSubmit, db: Session = Depends(get_db)):
    match = db.query(models.Match).filter(models.Match.id == data.match_id).first()
    if match:
        match.score = data.score
        match.submitted_by_team = data.submitted_by_team
        match.status = "Pending Verification"
        db.commit()
    return {"msg": "ok"}

@app.post("/verify-score")
def verify_score(data: ScoreVerify, db: Session = Depends(get_db)):
    match = db.query(models.Match).filter(models.Match.id == data.match_id).first()
    if match:
        match.status = "Official" if data.action == "APPROVE" else "Disputed"
        db.commit()
    return {"msg": "ok"}

@app.post("/admin/update-score")
def admin_update(data: AdminScoreUpdate, db: Session = Depends(get_db)):
    match = db.query(models.Match).filter(models.Match.id == data.match_id).first()
    if match:
        match.score = data.score
        match.status = "Official"
        db.commit()
    return {"msg": "ok"}

@app.post("/admin/edit-schedule")
def admin_edit(data: MatchScheduleUpdate, db: Session = Depends(get_db)):
    match = db.query(models.Match).filter(models.Match.id == data.match_id).first()
    if match:
        match.date = data.date
        match.time = data.time
        db.commit()
    return {"msg": "ok"}

@app.post("/admin/reset-event")
def admin_reset(db: Session = Depends(get_db)):
    db.query(models.Match).delete()
    db.query(models.Tournament).delete()
    db.commit()
    return {"msg": "reset"}

    # --- ADD TO main.py (Admin Section) ---

class TournamentUpdate(BaseModel):
    id: int
    name: str
    fee: str
    prize: str
    status: str

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