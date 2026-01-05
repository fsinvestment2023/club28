from fastapi import FastAPI, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from database import engine, SessionLocal, Base
import models
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import json
import random

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

def safe_int(val):
    try:
        if val is None or val == "": return 0
        return int(val)
    except: return 0

# --- SCHEMAS ---
class OTPRequest(BaseModel):
    phone: str
class RegisterRequest(BaseModel):
    phone: str; name: str; password: str
class LoginRequest(BaseModel):
    team_id: str; password: str
class ForgotPasswordRequest(BaseModel):
    phone: str; new_password: str
class WalletUpdate(BaseModel):
    team_id: str; amount: int
class JoinRequest(BaseModel):
    phone: str; tournament_name: str; level: str
class TournamentCreate(BaseModel):
    name: str; type: str; status: str = "Open"; settings: list 
class TournamentUpdate(BaseModel):
    id: int; name: str; status: str; settings: list
class TournamentDelete(BaseModel):
    id: int
class MatchCreate(BaseModel):
    category: str; group_id: str; t1: str; t2: str; date: str; time: str
class MatchFullUpdate(BaseModel):
    id: int; t1: str; t2: str; date: str; time: str; score: str
class MatchDelete(BaseModel):
    id: int
class ScoreSubmit(BaseModel):
    match_id: int; category: str; t1_name: str; t2_name: str; score: str; submitted_by_team: str
class ScoreVerify(BaseModel):
    match_id: int; action: str
class AdminScoreUpdate(BaseModel):
    match_id: int; score: str
class MatchScheduleUpdate(BaseModel):
    match_id: int; date: str; time: str

# --- AUTH & USER ENDPOINTS ---
@app.post("/send-otp")
def send_otp(data: OTPRequest):
    return {"status": "sent", "otp": "1234"}

@app.post("/register")
def register(data: RegisterRequest, db: Session = Depends(get_db)):
    exists = db.query(models.User).filter(models.User.phone == data.phone).first()
    if exists: raise HTTPException(status_code=400, detail="Phone already registered")
    team_id = f"{data.name[:2].upper()}{data.phone[-2:]}"
    while db.query(models.User).filter(models.User.team_id == team_id).first():
        team_id = f"{data.name[:2].upper()}{random.randint(10,99)}"
    new_user = models.User(phone=data.phone, name=data.name, password=data.password, team_id=team_id, wallet_balance=0)
    db.add(new_user); db.commit(); db.refresh(new_user)
    return {"status": "created", "user": new_user}

@app.post("/login")
def login(data: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.team_id == data.team_id).first()
    if not user: raise HTTPException(status_code=404, detail="Team ID not found")
    if user.password != data.password: raise HTTPException(status_code=401, detail="Wrong Password")
    return {"status": "success", "user": user}

@app.post("/reset-password")
def reset_password(data: ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.phone == data.phone).first()
    if not user: raise HTTPException(status_code=404, detail="Phone not found")
    user.password = data.new_password; db.commit()
    return {"status": "updated"}

@app.get("/user/{team_id}")
def get_user_details(team_id: str, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.team_id == team_id).first()
    if not user: raise HTTPException(status_code=404, detail="User not found")
    return user

# --- ADMIN ENDPOINTS ---
@app.get("/admin/players")
def get_all_players(db: Session = Depends(get_db)):
    return db.query(models.User).all()

@app.get("/admin/tournament-players/{name}")
def get_tournament_players(name: str, db: Session = Depends(get_db)):
    return db.query(models.User).filter(models.User.active_category == name).all()

@app.post("/admin/add-wallet")
def add_wallet_money(data: WalletUpdate, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.team_id == data.team_id).first()
    if not user: raise HTTPException(status_code=404, detail="Player not found")
    user.wallet_balance += data.amount; db.commit()
    return {"status": "ok", "new_balance": user.wallet_balance}

@app.get("/tournaments")
def get_tournaments(db: Session = Depends(get_db)):
    return db.query(models.Tournament).all()

@app.post("/admin/create-tournament")
def create_tournament(data: TournamentCreate, db: Session = Depends(get_db)):
    fees = [safe_int(c.get('fee')) for c in data.settings]
    total_prizes = [safe_int(c.get('p1'))+safe_int(c.get('p2'))+safe_int(c.get('p3')) for c in data.settings]
    new_t = models.Tournament(name=data.name, type=data.type, status=data.status, settings=json.dumps(data.settings), fee=str(min(fees)) if fees else "0", prize=str(max(total_prizes)) if total_prizes else "0")
    db.add(new_t); db.commit(); return {"message": "Created"}

@app.post("/admin/edit-tournament")
def admin_edit_tournament(data: TournamentUpdate, db: Session = Depends(get_db)):
    t = db.query(models.Tournament).filter(models.Tournament.id == data.id).first()
    if t:
        t.name = data.name; t.status = data.status; t.settings = json.dumps(data.settings)
        fees = [safe_int(c.get('fee')) for c in data.settings]
        t.fee = str(min(fees)) if fees else "0"
        total_prizes = [safe_int(c.get('p1'))+safe_int(c.get('p2'))+safe_int(c.get('p3')) for c in data.settings]
        t.prize = str(max(total_prizes)) if total_prizes else "0"
        db.commit()
    return {"message": "Updated"}

@app.post("/admin/delete-tournament")
def delete_tournament(data: TournamentDelete, db: Session = Depends(get_db)):
    t = db.query(models.Tournament).filter(models.Tournament.id == data.id).first()
    if t:
        db.query(models.Match).filter(models.Match.category == t.name).delete()
        db.delete(t); db.commit()
    return {"message": "Deleted"}

@app.post("/join-tournament")
def join_tournament(data: JoinRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.phone == data.phone).first()
    if not user: raise HTTPException(status_code=404, detail="User not found")
    
    if user.active_category == data.tournament_name:
        raise HTTPException(status_code=400, detail="Already registered for this event")

    tourney = db.query(models.Tournament).filter(models.Tournament.name == data.tournament_name).first()
    if not tourney: raise HTTPException(status_code=404, detail="Tournament not found")

    categories = json.loads(tourney.settings)
    required_fee = 0
    for cat in categories:
        if cat['name'] == data.level: required_fee = safe_int(cat.get('fee')); break
    
    if required_fee == 0 and required_fee != 0: raise HTTPException(status_code=400, detail="Invalid Category")
    if user.wallet_balance < required_fee: raise HTTPException(status_code=400, detail="Insufficient Balance")

    user.wallet_balance -= required_fee
    user.active_category = data.tournament_name
    user.active_level = data.level
    db.commit(); db.refresh(user)
    return {"status": "joined", "user": user}

@app.get("/standings/{category}")
def get_standings(category: str, level: str = None, db: Session = Depends(get_db)):
    query = db.query(models.User).filter(models.User.active_category == category)
    if level and level != "undefined": query = query.filter(models.User.active_level == level)
    users = query.all()
    matches = db.query(models.Match).filter(models.Match.category == category, models.Match.status == "Official").all()
    standings = []
    for user in users:
        points, played, won = 0, 0, 0
        for m in matches:
            if m.t1 == user.team_id or m.t2 == user.team_id:
                played += 1
                if calculate_winner(m.score, m.t1, m.t2) == user.team_id: points += 3; won += 1
        standings.append({"name": user.name, "team_id": user.team_id, "group": user.group_id, "points": points, "gamesWon": won, "played": played})
    standings.sort(key=lambda x: x['points'], reverse=True)
    return standings

def calculate_winner(score_str, t1, t2):
    if not score_str: return None
    try:
        t1_sets, t2_sets = 0, 0
        for s in score_str.split(','):
            p = s.strip().split('-')
            if len(p) == 2:
                if int(p[0]) > int(p[1]): t1_sets += 1
                elif int(p[1]) > int(p[0]): t2_sets += 1
        return t1 if t1_sets > t2_sets else t2 if t2_sets > t1_sets else None
    except: return None

@app.get("/scores")
def get_scores(db: Session = Depends(get_db)): return db.query(models.Match).all()

@app.post("/admin/create-match")
def admin_create_match(m: MatchCreate, db: Session = Depends(get_db)):
    db.add(models.Match(category=m.category, group_id=m.group_id, t1=m.t1, t2=m.t2, date=m.date or "2025-01-20", time=m.time or "10:00", status="Scheduled"))
    db.commit(); return {"message": "Created"}

@app.post("/admin/edit-match-full")
def admin_edit_match_full(data: MatchFullUpdate, db: Session = Depends(get_db)):
    m = db.query(models.Match).filter(models.Match.id == data.id).first()
    if m: m.t1 = data.t1; m.t2 = data.t2; m.date = data.date; m.time = data.time; m.score = data.score; 
    if data.score: m.status = "Official"; db.commit()
    return {"msg": "ok"}

@app.post("/admin/delete-match")
def admin_delete_match(data: MatchDelete, db: Session = Depends(get_db)):
    db.query(models.Match).filter(models.Match.id == data.id).delete(); db.commit(); return {"msg": "deleted"}

@app.post("/submit-score")
def submit_score(data: ScoreSubmit, db: Session = Depends(get_db)):
    m = db.query(models.Match).filter(models.Match.id == data.match_id).first()
    if m: m.score = data.score; m.submitted_by_team = data.submitted_by_team; m.status = "Pending Verification"; db.commit()
    return {"msg": "ok"}

@app.post("/verify-score")
def verify_score(data: ScoreVerify, db: Session = Depends(get_db)):
    m = db.query(models.Match).filter(models.Match.id == data.match_id).first()
    if m: m.status = "Official" if data.action == "APPROVE" else "Disputed"; db.commit()
    return {"msg": "ok"}

@app.post("/admin/update-score")
def admin_update_score(data: AdminScoreUpdate, db: Session = Depends(get_db)):
    m = db.query(models.Match).filter(models.Match.id == data.match_id).first()
    if m: m.score = data.score; m.status = "Official"; db.commit()
    return {"msg": "ok"}

@app.post("/admin/edit-schedule")
def admin_edit_schedule(data: MatchScheduleUpdate, db: Session = Depends(get_db)):
    m = db.query(models.Match).filter(models.Match.id == data.match_id).first()
    if m: m.date = data.date; m.time = data.time; db.commit()
    return {"msg": "ok"}

@app.get("/generate-test-season")
def generate_test_season(db: Session = Depends(get_db)):
    return {"full_schedule": {"schedule": [{"id": m.id, "category": m.category, "group": m.group_id, "t1": m.t1, "t2": m.t2, "time": m.time, "date": m.date, "stage": m.stage, "status": m.status} for m in db.query(models.Match).all()]}}