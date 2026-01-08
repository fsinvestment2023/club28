from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from database import engine, SessionLocal, Base
import models
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import json
import random

# Create Tables
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

def get_next_group(db: Session, tournament_name: str, city: str, category: str, draw_size: int):
    total_count = db.query(models.Registration).filter(
        models.Registration.tournament_name == tournament_name,
        models.Registration.city == city,
        models.Registration.category == category
    ).count()
    if total_count >= draw_size: return None, "FULL"
    num_groups = draw_size // 4
    all_groups = ['A', 'B', 'C', 'D']
    allowed_groups = all_groups[:num_groups] 
    target_index = total_count % num_groups
    target_group = allowed_groups[target_index]
    count_in_group = db.query(models.Registration).filter(
        models.Registration.tournament_name == tournament_name,
        models.Registration.city == city,
        models.Registration.category == category,
        models.Registration.group_id == target_group
    ).count()
    if count_in_group < 4: return target_group, "OK"
    for g in allowed_groups:
        c = db.query(models.Registration).filter(
            models.Registration.tournament_name == tournament_name,
            models.Registration.city == city,
            models.Registration.category == category,
            models.Registration.group_id == g
        ).count()
        if c < 4: return g, "OK"
    return None, "FULL"

# --- SCHEMAS ---
class OTPRequest(BaseModel): phone: str
class RegisterRequest(BaseModel): phone: str; name: str; password: str
class LoginRequest(BaseModel): team_id: str; password: str
class WalletUpdate(BaseModel): team_id: str; amount: int
class JoinRequest(BaseModel): phone: str; tournament_name: str; city: str; sport: str; level: str
class TournamentCreate(BaseModel): name: str; city: str; sport: str; type: str; status: str = "Open"; settings: list; draw_size: int = 16; venue: str = ""; schedule: list = []
class TournamentUpdate(BaseModel): id: int; name: str; city: str; sport: str; status: str; settings: list; draw_size: int; venue: str; schedule: list
class TournamentDelete(BaseModel): id: int
class MatchCreate(BaseModel): category: str; city: str; group_id: str; t1: str; t2: str; date: str; time: str
class MatchFullUpdate(BaseModel): id: int; t1: str; t2: str; date: str; time: str; score: str
class MatchDelete(BaseModel): id: int
class ScoreSubmit(BaseModel): match_id: int; score: str; submitted_by_team: str
class ScoreVerify(BaseModel): match_id: int; action: str
class AdminAddPlayer(BaseModel): name: str; phone: str; category: str; city: str; level: str
class UserProfileUpdate(BaseModel): team_id: str; email: str; gender: str; dob: str; play_location: str

@app.post("/send-otp")
def send_otp(data: OTPRequest): return {"status": "sent", "otp": "1234"}

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
    regs = db.query(models.Registration).filter(models.Registration.user_id == user.id).all()
    reg_data = [{"tournament": r.tournament_name, "city": r.city, "sport": r.sport, "level": r.category, "group": r.group_id} for r in regs]
    return {"status": "success", "user": user, "registrations": reg_data}

@app.get("/user/{team_id}")
def get_user_details(team_id: str, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.team_id == team_id).first()
    if not user: raise HTTPException(status_code=404, detail="User not found")
    regs = db.query(models.Registration).filter(models.Registration.user_id == user.id).all()
    reg_data = [{"tournament": r.tournament_name, "city": r.city, "sport": r.sport, "level": r.category, "group": r.group_id} for r in regs]
    return {
        "id": user.id, "name": user.name, "team_id": user.team_id, "phone": user.phone, 
        "wallet_balance": user.wallet_balance, 
        "email": user.email, "gender": user.gender, "dob": user.dob, "play_location": user.play_location,
        "registrations": reg_data
    }

@app.post("/user/update-profile")
def update_user_profile(data: UserProfileUpdate, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.team_id == data.team_id).first()
    if not user: raise HTTPException(status_code=404, detail="User not found")
    user.email = data.email
    user.gender = data.gender
    user.dob = data.dob
    user.play_location = data.play_location
    db.commit()
    return {"status": "updated", "user": user}

@app.get("/user/{team_id}/history")
def get_user_history(team_id: str, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.team_id == team_id).first()
    if not user: return []
    matches = db.query(models.Match).filter((models.Match.t1 == user.name) | (models.Match.t2 == user.name)).all()
    return matches

@app.get("/admin/players")
def get_all_players(db: Session = Depends(get_db)): return db.query(models.User).all()

@app.get("/admin/tournament-players")
def get_tournament_players(name: str, city: str, db: Session = Depends(get_db)):
    results = db.query(models.Registration, models.User).join(models.User, models.Registration.user_id == models.User.id).filter(
        models.Registration.tournament_name == name,
        models.Registration.city == city
    ).all()
    players = []
    for reg, user in results:
        players.append({"id": user.id, "name": user.name, "team_id": user.team_id, "phone": user.phone, "group_id": reg.group_id, "active_level": reg.category})
    return players

@app.post("/admin/add-wallet")
def add_wallet_money(data: WalletUpdate, db: Session = Depends(get_db)):
    clean_id = data.team_id.strip().upper()
    user = db.query(models.User).filter(models.User.team_id == clean_id).first()
    if not user: raise HTTPException(status_code=404, detail="Player not found")
    user.wallet_balance += data.amount; db.commit()
    return {"status": "ok", "new_balance": user.wallet_balance}

@app.post("/admin/manual-register")
def admin_manual_register(data: AdminAddPlayer, db: Session = Depends(get_db)):
    tourney = db.query(models.Tournament).filter(models.Tournament.name == data.category, models.Tournament.city == data.city).first()
    if not tourney: raise HTTPException(status_code=404, detail="Tournament not found")
    group, status = get_next_group(db, data.category, data.city, data.level, tourney.draw_size)
    if status == "FULL": raise HTTPException(status_code=400, detail=f"Category {data.level} is FULL")
    user = db.query(models.User).filter(models.User.phone == data.phone).first()
    if not user:
         team_id = f"{data.name[:2].upper()}{data.phone[-2:]}"
         user = models.User(phone=data.phone, name=data.name, password="password", team_id=team_id, wallet_balance=0)
         db.add(user); db.commit(); db.refresh(user)
    existing = db.query(models.Registration).filter(models.Registration.user_id == user.id, models.Registration.tournament_name == data.category, models.Registration.city == data.city).first()
    if existing: raise HTTPException(status_code=400, detail="Player already in this tournament")
    new_reg = models.Registration(user_id=user.id, tournament_name=data.category, city=data.city, sport=tourney.sport, category=data.level, group_id=group)
    db.add(new_reg); db.commit()
    return {"message": "User Registered", "group": group}

@app.post("/join-tournament")
def join_tournament(data: JoinRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.phone == data.phone).first()
    if not user: raise HTTPException(status_code=404, detail="User not found")
    tourney = db.query(models.Tournament).filter(models.Tournament.name == data.tournament_name, models.Tournament.city == data.city).first()
    if not tourney: raise HTTPException(status_code=404, detail="Tournament not found")
    existing = db.query(models.Registration).filter(models.Registration.user_id == user.id, models.Registration.tournament_name == data.tournament_name, models.Registration.city == data.city).first()
    if existing: raise HTTPException(status_code=400, detail=f"Already registered in {data.tournament_name}")
    group, status = get_next_group(db, data.tournament_name, data.city, data.level, tourney.draw_size)
    if status == "FULL": raise HTTPException(status_code=400, detail=f"Full (Limit {tourney.draw_size})")
    categories = json.loads(tourney.settings)
    required_fee = 0
    for cat in categories:
        if cat['name'] == data.level: required_fee = safe_int(cat.get('fee')); break
    if user.wallet_balance < required_fee: raise HTTPException(status_code=400, detail="Insufficient Balance")
    user.wallet_balance -= required_fee
    new_reg = models.Registration(user_id=user.id, tournament_name=data.tournament_name, city=data.city, sport=tourney.sport, category=data.level, group_id=group)
    db.add(new_reg); db.commit()
    regs = db.query(models.Registration).filter(models.Registration.user_id == user.id).all()
    reg_data = [{"tournament": r.tournament_name, "city": r.city, "sport": r.sport, "level": r.category, "group": r.group_id} for r in regs]
    return {"status": "joined", "user": {"id": user.id, "name": user.name, "team_id": user.team_id, "phone": user.phone, "wallet_balance": user.wallet_balance}, "registrations": reg_data}

@app.get("/standings")
def get_standings(tournament: str, city: str, level: str = None, db: Session = Depends(get_db)):
    query = db.query(models.Registration, models.User).join(models.User, models.Registration.user_id == models.User.id).filter(
        models.Registration.tournament_name == tournament,
        models.Registration.city == city
    )
    if level and level not in ["undefined", "null", "None", ""]: query = query.filter(models.Registration.category == level)
    results = query.all()
    matches = db.query(models.Match).filter(models.Match.category == tournament, models.Match.city == city, models.Match.status == "Official").all()
    
    standings = []
    for reg, user in results:
        points, played, won = 0, 0, 0
        total_game_points = 0
        
        for m in matches:
            if m.t1 == user.name or m.t2 == user.name:
                played += 1
                if m.score:
                    try:
                        sets = m.score.replace(" ", "").split(",")
                        for s in sets:
                            p = s.split('-')
                            if len(p) == 2:
                                s1, s2 = int(p[0]), int(p[1])
                                if m.t1 == user.name: total_game_points += s1
                                elif m.t2 == user.name: total_game_points += s2
                    except: pass
                winner = calculate_winner(m.score, m.t1, m.t2)
                if winner == user.name: 
                    points += 3
                    won += 1
                    
        standings.append({
            "name": user.name, 
            "team_id": user.team_id, 
            "group": reg.group_id or "A", 
            "points": points, 
            "gamesWon": won, 
            "played": played,
            "totalGamePoints": total_game_points
        })
    standings.sort(key=lambda x: x['points'], reverse=True)
    return standings

# --- NEW: ADMIN LEADERBOARD (Reuses Logic) ---
@app.get("/admin/leaderboard")
def admin_leaderboard(tournament: str, city: str, level: str, db: Session = Depends(get_db)):
    # Reusing the exact same logic as app, but strictly for Admin Panel display
    return get_standings(tournament, city, level, db)

@app.get("/tournaments")
def get_tournaments(db: Session = Depends(get_db)): return db.query(models.Tournament).all()

@app.post("/admin/create-tournament")
def create_tournament(data: TournamentCreate, db: Session = Depends(get_db)):
    fees = [safe_int(c.get('fee')) for c in data.settings]
    total_prizes = [safe_int(c.get('p1'))+safe_int(c.get('p2'))+safe_int(c.get('p3')) for c in data.settings]
    new_t = models.Tournament(
        name=data.name, city=data.city, sport=data.sport, type=data.type, status=data.status, 
        settings=json.dumps(data.settings), venue=data.venue, schedule=json.dumps(data.schedule),
        fee=str(min(fees)) if fees else "0", prize=str(max(total_prizes)) if total_prizes else "0", draw_size=data.draw_size
    )
    db.add(new_t); db.commit(); return {"message": "Created"}

@app.post("/admin/edit-tournament")
def admin_edit_tournament(data: TournamentUpdate, db: Session = Depends(get_db)):
    t = db.query(models.Tournament).filter(models.Tournament.id == data.id).first()
    if t:
        t.name = data.name; t.city = data.city; t.sport = data.sport; t.status = data.status; 
        t.settings = json.dumps(data.settings); t.venue = data.venue; t.schedule = json.dumps(data.schedule);
        t.draw_size = data.draw_size
        fees = [safe_int(c.get('fee')) for c in data.settings]
        t.fee = str(min(fees)) if fees else "0"
        db.commit()
    return {"message": "Updated"}

@app.post("/admin/delete-tournament")
def delete_tournament(data: TournamentDelete, db: Session = Depends(get_db)):
    t = db.query(models.Tournament).filter(models.Tournament.id == data.id).first()
    if t:
        db.query(models.Match).filter(models.Match.category == t.name, models.Match.city == t.city).delete()
        db.query(models.Registration).filter(models.Registration.tournament_name == t.name, models.Registration.city == t.city).delete()
        db.delete(t); db.commit()
    return {"message": "Deleted"}

@app.get("/scores")
def get_scores(db: Session = Depends(get_db)): return db.query(models.Match).all()

@app.post("/admin/create-match")
def admin_create_match(m: MatchCreate, db: Session = Depends(get_db)):
    db.add(models.Match(category=m.category, city=m.city, group_id=m.group_id, t1=m.t1, t2=m.t2, date=m.date or "2025-01-20", time=m.time or "10:00", status="Scheduled"))
    db.commit(); return {"message": "Created"}

@app.post("/admin/edit-match-full")
def admin_edit_match_full(data: MatchFullUpdate, db: Session = Depends(get_db)):
    m = db.query(models.Match).filter(models.Match.id == data.id).first()
    if m: 
        m.t1 = data.t1; m.t2 = data.t2; m.date = data.date; m.time = data.time; m.score = data.score; 
        m.status = "Official" if data.score else m.status; 
        db.commit()
    return {"msg": "ok"}

@app.post("/admin/delete-match")
def admin_delete_match(data: MatchDelete, db: Session = Depends(get_db)):
    db.query(models.Match).filter(models.Match.id == data.id).delete(); db.commit(); return {"msg": "deleted"}

# --- UPDATED: USER SUBMIT SCORE (Pending Verification) ---
@app.post("/submit-score")
def submit_score(data: ScoreSubmit, db: Session = Depends(get_db)):
    m = db.query(models.Match).filter(models.Match.id == data.match_id).first()
    if m: 
        m.score = data.score
        m.submitted_by_team = data.submitted_by_team
        m.status = "Pending Verification" # <--- IMPORTANT STATUS CHANGE
        db.commit()
    return {"msg": "ok"}

# --- UPDATED: VERIFY SCORE (Official or Disputed) ---
@app.post("/verify-score")
def verify_score(data: ScoreVerify, db: Session = Depends(get_db)):
    m = db.query(models.Match).filter(models.Match.id == data.match_id).first()
    if m: 
        m.status = "Official" if data.action == "APPROVE" else "Disputed" # <--- FINAL STATUS
        db.commit()
    return {"msg": "ok"}

@app.get("/generate-test-season")
def generate_test_season(db: Session = Depends(get_db)):
    return {"full_schedule": {"schedule": [{"id": m.id, "category": m.category, "city": m.city, "group": m.group_id, "t1": m.t1, "t2": m.t2, "time": m.time, "date": m.date, "stage": m.stage, "status": m.status, "score": m.score, "submitted_by_team": m.submitted_by_team} for m in db.query(models.Match).all()]}}

def calculate_winner(score_str, t1, t2):
    if not score_str: return None
    try:
        t1_sets, t2_sets = 0, 0
        for s in score_str.split(','):
            p = s.strip().split('-')
            if len(p) == 2:
                if int(p[0]) > int(p[1]): t1_sets += 1
                elif int(p[1]) > int(p[0]): t2_sets += 1
        if t1_sets > t2_sets: return t1
        elif t2_sets > t1_sets: return t2
        else: return None
    except: return None