from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from database import engine, SessionLocal, Base
import models
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import json
import random
import re # Added for parsing Team IDs

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

# --- GROUP LOGIC ---
def get_next_group(db: Session, tournament_name: str, city: str, category: str, draw_size: int):
    total_count = db.query(models.Registration).filter(
        models.Registration.tournament_name == tournament_name,
        models.Registration.city == city,
        models.Registration.category == category,
        models.Registration.status == "Confirmed"
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
        models.Registration.group_id == target_group,
        models.Registration.status == "Confirmed"
    ).count()

    if count_in_group < 4: return target_group, "OK"
    for g in allowed_groups:
        c = db.query(models.Registration).filter(
            models.Registration.tournament_name == tournament_name,
            models.Registration.city == city,
            models.Registration.category == category,
            models.Registration.group_id == g,
            models.Registration.status == "Confirmed"
        ).count()
        if c < 4: return g, "OK"
    return None, "FULL"

# --- SCHEMAS ---
class OTPRequest(BaseModel): phone: str
class RegisterRequest(BaseModel): phone: str; name: str; password: str
class LoginRequest(BaseModel): team_id: str; password: str
class WalletUpdate(BaseModel): team_id: str; amount: int
class JoinRequest(BaseModel): 
    phone: str; tournament_name: str; city: str; sport: str; level: str; 
    partner_team_id: str = ""; payment_mode: str = "WALLET"; payment_scope: str = "INDIVIDUAL"
class TournamentCreate(BaseModel): name: str; city: str; sport: str; format: str; type: str; status: str = "Open"; settings: list; draw_size: int = 16; venue: str = ""; schedule: list = []
class TournamentUpdate(BaseModel): id: int; name: str; city: str; sport: str; format: str; status: str; settings: list; draw_size: int; venue: str; schedule: list
class TournamentDelete(BaseModel): id: int
class MatchCreate(BaseModel): category: str; city: str; group_id: str; t1: str; t2: str; date: str; time: str; stage: str
class MatchFullUpdate(BaseModel): id: int; t1: str; t2: str; date: str; time: str; score: str
class MatchDelete(BaseModel): id: int
class ScoreSubmit(BaseModel): match_id: int; score: str; submitted_by_team: str
class ScoreVerify(BaseModel): match_id: int; action: str
class AdminAddPlayer(BaseModel): name: str; phone: str; category: str; city: str; level: str
class UserProfileUpdate(BaseModel): team_id: str; email: str; gender: str; dob: str; play_location: str
class ConfirmPartnerRequest(BaseModel): reg_id: int; payment_mode: str
class WithdrawRequest(BaseModel): team_id: str; amount: int

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
    regs = db.query(models.Registration).filter(models.Registration.user_id == user.id, models.Registration.status == "Confirmed").all()
    reg_data = [{"tournament": r.tournament_name, "city": r.city, "sport": r.sport, "level": r.category, "group": r.group_id} for r in regs]
    return {"status": "success", "user": user, "registrations": reg_data}

@app.get("/user/{team_id}")
def get_user_details(team_id: str, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.team_id == team_id).first()
    if not user: raise HTTPException(status_code=404, detail="User not found")
    regs = db.query(models.Registration).filter(models.Registration.user_id == user.id, models.Registration.status == "Confirmed").all()
    reg_data = [{"tournament": r.tournament_name, "city": r.city, "sport": r.sport, "level": r.category, "group": r.group_id} for r in regs]
    return {
        "id": user.id, "name": user.name, "team_id": user.team_id, "phone": user.phone, 
        "wallet_balance": user.wallet_balance, "email": user.email, "gender": user.gender, "dob": user.dob, "play_location": user.play_location,
        "registrations": reg_data
    }

@app.get("/user/{team_id}/pending")
def get_pending_requests(team_id: str, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.team_id == team_id).first()
    if not user: return []
    pending = db.query(models.Registration).filter(models.Registration.user_id == user.id, models.Registration.status == "Pending_Payment").all()
    results = []
    for p in pending:
        partner = db.query(models.User).filter(models.User.id == p.partner_id).first()
        partner_name = f"{partner.name} ({partner.team_id})" if partner else "Unknown"
        tourney = db.query(models.Tournament).filter(models.Tournament.name == p.tournament_name, models.Tournament.city == p.city).first()
        fee = 0
        if tourney:
            cats = json.loads(tourney.settings)
            for c in cats:
                if c['name'] == p.category: fee = safe_int(c.get('fee')); break
        results.append({"reg_id": p.id, "tournament": p.tournament_name, "city": p.city, "level": p.category, "partner": partner_name, "fee_share": fee})
    return results

@app.post("/user/update-profile")
def update_user_profile(data: UserProfileUpdate, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.team_id == data.team_id).first()
    if not user: raise HTTPException(status_code=404, detail="User not found")
    user.email = data.email; user.gender = data.gender; user.dob = data.dob; user.play_location = data.play_location; db.commit()
    return {"status": "updated", "user": user}

@app.get("/user/{team_id}/history")
def get_user_history(team_id: str, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.team_id == team_id).first()
    if not user: return []
    # Search for user name in matches (Checking if name is part of T1 or T2 strings for doubles)
    matches = db.query(models.Match).filter(models.Match.t1.contains(user.name) | models.Match.t2.contains(user.name)).all()
    return matches

@app.get("/admin/players")
def get_all_players(db: Session = Depends(get_db)): return db.query(models.User).all()

@app.get("/admin/tournament-players")
def get_tournament_players(name: str, city: str, db: Session = Depends(get_db)):
    results = db.query(models.Registration).filter(models.Registration.tournament_name == name, models.Registration.city == city, models.Registration.status == "Confirmed").all()
    players = []
    processed_ids = []
    for reg in results:
        if reg.id in processed_ids: continue
        user = db.query(models.User).filter(models.User.id == reg.user_id).first()
        display_name = f"{user.name} ({user.team_id})"
        if reg.partner_id:
            partner = db.query(models.User).filter(models.User.id == reg.partner_id).first()
            if partner:
                display_name = f"{user.name} ({user.team_id}) & {partner.name} ({partner.team_id})"
                partner_reg = db.query(models.Registration).filter(models.Registration.user_id == partner.id, models.Registration.tournament_name == name, models.Registration.city == city).first()
                if partner_reg: processed_ids.append(partner_reg.id)
        players.append({"id": user.id, "name": display_name, "team_id": user.team_id, "phone": user.phone, "group_id": reg.group_id, "active_level": reg.category})
        processed_ids.append(reg.id)
    return players

@app.post("/admin/add-wallet")
def add_wallet_money(data: WalletUpdate, db: Session = Depends(get_db)):
    clean_id = data.team_id.strip().upper()
    user = db.query(models.User).filter(models.User.team_id == clean_id).first()
    if not user: raise HTTPException(status_code=404, detail="Player not found")
    user.wallet_balance += data.amount
    db.add(models.Transaction(user_id=user.id, amount=data.amount, type="CREDIT", mode="WALLET_TOPUP", description="Admin Top-up"))
    db.commit()
    return {"status": "ok", "new_balance": user.wallet_balance}

@app.post("/user/withdraw")
def withdraw_money(data: WithdrawRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.team_id == data.team_id).first()
    if not user: raise HTTPException(status_code=404, detail="User not found")
    if user.wallet_balance < data.amount: raise HTTPException(status_code=400, detail="Insufficient Balance")
    user.wallet_balance -= data.amount
    db.add(models.Transaction(user_id=user.id, amount=data.amount, type="DEBIT", mode="WITHDRAWAL", description="User Withdrawal"))
    db.commit()
    return {"status": "success", "new_balance": user.wallet_balance}

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
    
    new_reg = models.Registration(user_id=user.id, tournament_name=data.category, city=data.city, sport=tourney.sport, category=data.level, group_id=group, status="Confirmed")
    db.add(new_reg); db.commit()
    return {"message": "User Registered", "group": group}

@app.post("/join-tournament")
def join_tournament(data: JoinRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.phone == data.phone).first()
    if not user: raise HTTPException(status_code=404, detail="User not found")
    tourney = db.query(models.Tournament).filter(models.Tournament.name == data.tournament_name, models.Tournament.city == data.city).first()
    if not tourney: raise HTTPException(status_code=404, detail="Tournament not found")
    existing = db.query(models.Registration).filter(models.Registration.user_id == user.id, models.Registration.tournament_name == data.tournament_name, models.Registration.city == data.city).first()
    if existing: raise HTTPException(status_code=400, detail=f"Already registered (Status: {existing.status})")

    categories = json.loads(tourney.settings)
    per_person_fee = 0
    for cat in categories:
        if cat['name'] == data.level: per_person_fee = safe_int(cat.get('fee')); break
    
    is_doubles = tourney.format == "Doubles"
    pay_amount = per_person_fee
    if is_doubles and data.payment_scope == "TEAM": pay_amount = per_person_fee * 2

    partner = None
    if is_doubles:
        if not data.partner_team_id: raise HTTPException(status_code=400, detail="Partner Team ID required")
        partner = db.query(models.User).filter(models.User.team_id == data.partner_team_id.upper()).first()
        if not partner: raise HTTPException(status_code=404, detail="Partner ID not found")
        if partner.id == user.id: raise HTTPException(status_code=400, detail="Cannot partner with yourself")
        p_exist = db.query(models.Registration).filter(models.Registration.user_id == partner.id, models.Registration.tournament_name == data.tournament_name, models.Registration.city == data.city).first()
        if p_exist: raise HTTPException(status_code=400, detail="Partner already registered")

    if data.payment_mode == "WALLET":
        if user.wallet_balance < pay_amount: raise HTTPException(status_code=400, detail="Insufficient Wallet Balance")
        user.wallet_balance -= pay_amount
        db.add(models.Transaction(user_id=user.id, amount=pay_amount, type="DEBIT", mode="EVENT_FEE", description=f"Fee: {data.tournament_name}"))
    else:
        db.add(models.Transaction(user_id=user.id, amount=pay_amount, type="CREDIT", mode="DIRECT_PAYMENT", description=f"Direct Pay: {data.tournament_name}"))
        db.add(models.Transaction(user_id=user.id, amount=pay_amount, type="DEBIT", mode="EVENT_FEE", description=f"Fee: {data.tournament_name}"))

    if is_doubles:
        if data.payment_scope == "TEAM":
             group, status = get_next_group(db, data.tournament_name, data.city, data.level, tourney.draw_size)
             if status == "FULL": raise HTTPException(status_code=400, detail="Tournament Full")
             reg_a = models.Registration(user_id=user.id, partner_id=partner.id, tournament_name=data.tournament_name, city=data.city, sport=tourney.sport, category=data.level, group_id=group, status="Confirmed")
             reg_b = models.Registration(user_id=partner.id, partner_id=user.id, tournament_name=data.tournament_name, city=data.city, sport=tourney.sport, category=data.level, group_id=group, status="Confirmed")
             db.add(reg_a); db.add(reg_b); db.commit()
             return {"status": "joined", "message": "Team Registered!", "user": {"id": user.id, "name": user.name, "team_id": user.team_id, "phone": user.phone, "wallet_balance": user.wallet_balance}}
        else:
             reg_a = models.Registration(user_id=user.id, partner_id=partner.id, tournament_name=data.tournament_name, city=data.city, sport=tourney.sport, category=data.level, group_id=None, status="Partial_Confirmed")
             reg_b = models.Registration(user_id=partner.id, partner_id=user.id, tournament_name=data.tournament_name, city=data.city, sport=tourney.sport, category=data.level, group_id=None, status="Pending_Payment")
             db.add(reg_a); db.add(reg_b); db.commit()
             return {"status": "pending_partner", "message": "Registered! Partner must accept.", "user": {"id": user.id, "name": user.name, "team_id": user.team_id, "phone": user.phone, "wallet_balance": user.wallet_balance}}
    else:
        group, status = get_next_group(db, data.tournament_name, data.city, data.level, tourney.draw_size)
        if status == "FULL": raise HTTPException(status_code=400, detail="Tournament Full")
        new_reg = models.Registration(user_id=user.id, tournament_name=data.tournament_name, city=data.city, sport=tourney.sport, category=data.level, group_id=group, status="Confirmed")
        db.add(new_reg); db.commit()
        regs = db.query(models.Registration).filter(models.Registration.user_id == user.id, models.Registration.status == "Confirmed").all()
        reg_data = [{"tournament": r.tournament_name, "city": r.city, "sport": r.sport, "level": r.category, "group": r.group_id} for r in regs]
        return {"status": "joined", "user": {"id": user.id, "name": user.name, "team_id": user.team_id, "phone": user.phone, "wallet_balance": user.wallet_balance}, "registrations": reg_data}

@app.post("/confirm-partner")
def confirm_partner_registration(data: ConfirmPartnerRequest, db: Session = Depends(get_db)):
    reg_b = db.query(models.Registration).filter(models.Registration.id == data.reg_id).first()
    if not reg_b or reg_b.status != "Pending_Payment": raise HTTPException(status_code=400, detail="Invalid Request")
    user_b = db.query(models.User).filter(models.User.id == reg_b.user_id).first()
    reg_a = db.query(models.Registration).filter(models.Registration.user_id == reg_b.partner_id, models.Registration.tournament_name == reg_b.tournament_name, models.Registration.status == "Partial_Confirmed").first()
    
    tourney = db.query(models.Tournament).filter(models.Tournament.name == reg_b.tournament_name, models.Tournament.city == reg_b.city).first()
    categories = json.loads(tourney.settings)
    pay_amount = 0
    for cat in categories:
        if cat['name'] == reg_b.category: pay_amount = safe_int(cat.get('fee')); break

    if data.payment_mode == "WALLET":
        if user_b.wallet_balance < pay_amount: raise HTTPException(status_code=400, detail="Insufficient Wallet Balance")
        user_b.wallet_balance -= pay_amount
        db.add(models.Transaction(user_id=user_b.id, amount=pay_amount, type="DEBIT", mode="EVENT_FEE", description=f"Fee: {reg_b.tournament_name}"))
    
    group, status = get_next_group(db, reg_b.tournament_name, reg_b.city, reg_b.category, tourney.draw_size)
    reg_a.status = "Confirmed"; reg_a.group_id = group
    reg_b.status = "Confirmed"; reg_b.group_id = group
    db.commit()
    return {"status": "confirmed", "message": "Team Registered!", "new_balance": user_b.wallet_balance}

@app.get("/standings")
def get_standings(tournament: str, city: str, level: str = None, db: Session = Depends(get_db)):
    query = db.query(models.Registration).filter(models.Registration.tournament_name == tournament, models.Registration.city == city, models.Registration.status == "Confirmed")
    if level and level not in ["undefined", "null", "None", ""]: query = query.filter(models.Registration.category == level)
    results = query.all()
    matches = db.query(models.Match).filter(models.Match.category == tournament, models.Match.city == city, models.Match.status == "Official").all()
    standings = []
    processed_ids = []
    
    for reg in results:
        if reg.id in processed_ids: continue
        user = db.query(models.User).filter(models.User.id == reg.user_id).first()
        display_name = f"{user.name} ({user.team_id})"
        if reg.partner_id:
             partner = db.query(models.User).filter(models.User.id == reg.partner_id).first()
             if partner:
                 display_name = f"{user.name} ({user.team_id}) & {partner.name} ({partner.team_id})"
                 partner_reg = db.query(models.Registration).filter(models.Registration.user_id == partner.id, models.Registration.tournament_name == tournament).first()
                 if partner_reg: processed_ids.append(partner_reg.id)
        
        points, played, won, total_game_points = 0, 0, 0, 0
        for m in matches:
            # Check if user OR partner is in the match
            is_in_t1 = user.name in m.t1
            is_in_t2 = user.name in m.t2
            
            # Robust check for doubles partner logic
            if reg.partner_id:
                partner = db.query(models.User).filter(models.User.id == reg.partner_id).first()
                if partner:
                    if partner.name in m.t1: is_in_t1 = True
                    if partner.name in m.t2: is_in_t2 = True

            if is_in_t1 or is_in_t2:
                played += 1
                if m.score:
                    try:
                        sets = m.score.replace(" ", "").split(",")
                        for s in sets:
                            p = s.split('-')
                            if len(p) == 2:
                                s1, s2 = int(p[0]), int(p[1])
                                if is_in_t1: total_game_points += s1
                                elif is_in_t2: total_game_points += s2
                    except: pass
                
                winner_name = calculate_winner(m.score, m.t1, m.t2)
                # Winner check
                if winner_name and (user.name in winner_name or (reg.partner_id and partner.name in winner_name)): 
                    points += 3; won += 1
                    
        standings.append({"name": display_name, "team_id": user.team_id, "group": reg.group_id or "A", "points": points, "gamesWon": won, "played": played, "totalGamePoints": total_game_points})
        processed_ids.append(reg.id)
    standings.sort(key=lambda x: x['points'], reverse=True)
    return standings

@app.get("/user/{team_id}/transactions")
def get_user_transactions(team_id: str, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.team_id == team_id).first()
    if not user: return []
    return db.query(models.Transaction).filter(models.Transaction.user_id == user.id).order_by(models.Transaction.date.desc()).all()

@app.get("/admin/transactions")
def get_all_transactions(db: Session = Depends(get_db)):
    results = db.query(models.Transaction, models.User).join(models.User, models.Transaction.user_id == models.User.id).order_by(models.Transaction.date.desc()).all()
    txns = []
    for txn, user in results:
        txns.append({"id": txn.id, "date": txn.date, "amount": txn.amount, "type": txn.type, "mode": txn.mode, "description": txn.description, "user_name": user.name, "user_phone": user.phone, "team_id": user.team_id})
    return txns

# ... (Rest of Admin Endpoints) ...
@app.get("/admin/leaderboard")
def admin_leaderboard(tournament: str, city: str, level: str, db: Session = Depends(get_db)): return get_standings(tournament, city, level, db)
@app.get("/tournaments")
def get_tournaments(db: Session = Depends(get_db)): return db.query(models.Tournament).all()
@app.post("/admin/create-tournament")
def create_tournament(data: TournamentCreate, db: Session = Depends(get_db)):
    fees = [safe_int(c.get('fee')) for c in data.settings]
    total_prizes = [safe_int(c.get('p1'))+safe_int(c.get('p2'))+safe_int(c.get('p3')) for c in data.settings]
    new_t = models.Tournament(name=data.name, city=data.city, sport=data.sport, format=data.format, type=data.type, status=data.status, settings=json.dumps(data.settings), venue=data.venue, schedule=json.dumps(data.schedule), fee=str(min(fees)) if fees else "0", prize=str(max(total_prizes)) if total_prizes else "0", draw_size=data.draw_size)
    db.add(new_t); db.commit(); return {"message": "Created"}
@app.post("/admin/edit-tournament")
def admin_edit_tournament(data: TournamentUpdate, db: Session = Depends(get_db)):
    t = db.query(models.Tournament).filter(models.Tournament.id == data.id).first()
    if t:
        t.name = data.name; t.city = data.city; t.sport = data.sport; t.format = data.format; t.status = data.status; t.settings = json.dumps(data.settings); t.venue = data.venue; t.schedule = json.dumps(data.schedule); t.draw_size = data.draw_size; fees = [safe_int(c.get('fee')) for c in data.settings]; t.fee = str(min(fees)) if fees else "0"
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
    db.add(models.Match(category=m.category, city=m.city, group_id=m.group_id, t1=m.t1, t2=m.t2, date=m.date or "2025-01-20", time=m.time or "10:00", status="Scheduled", stage=m.stage))
    db.commit(); return {"message": "Created"}
@app.post("/admin/edit-match-full")
def admin_edit_match_full(data: MatchFullUpdate, db: Session = Depends(get_db)):
    m = db.query(models.Match).filter(models.Match.id == data.id).first()
    if m: m.t1 = data.t1; m.t2 = data.t2; m.date = data.date; m.time = data.time; m.score = data.score; m.status = "Official" if data.score else m.status; db.commit()
    return {"msg": "ok"}
@app.post("/admin/delete-match")
def admin_delete_match(data: MatchDelete, db: Session = Depends(get_db)):
    db.query(models.Match).filter(models.Match.id == data.id).delete(); db.commit(); return {"msg": "deleted"}
@app.post("/submit-score")
def submit_score(data: ScoreSubmit, db: Session = Depends(get_db)):
    m = db.query(models.Match).filter(models.Match.id == data.match_id).first()
    if m: m.score = data.score; m.submitted_by_team = data.submitted_by_team; m.status = "Pending Verification"; db.commit()
    return {"msg": "ok"}

# --- AUTOMATED PRIZE DISTRIBUTION ---
def distribute_prize(match, winner_name, db):
    tourney = db.query(models.Tournament).filter(models.Tournament.name == match.category, models.Tournament.city == match.city).first()
    if not tourney: return
    categories = json.loads(tourney.settings)
    
    # Identify prize money based on stage
    prize_amount = 0
    prize_desc = ""
    
    # Check if this is a "Final" or "3rd Place" match
    is_final = match.stage == "Final"
    is_3rd = match.stage == "3rd Place"

    # Find the specific category settings for this match
    match_category_settings = None
    for cat in categories:
        # Assuming the match category matches the setting name (e.g. "Advance")
        # You might need to store the specific 'level' in the Match table if multiple levels exist
        if cat['name'] in [match.category, "Advance", "Intermediate", "Open"]: # Simple fallback matching
             match_category_settings = cat
             break
    
    if not match_category_settings: return

    if is_final:
        prize_amount = safe_int(match_category_settings.get('p1'))
        prize_desc = f"1st Place: {match.category}"
    elif is_3rd:
        prize_amount = safe_int(match_category_settings.get('p3'))
        prize_desc = f"3rd Place: {match.category}"
    else:
        # Regular Match Win Bonus
        prize_amount = safe_int(match_category_settings.get('per_match', 0))
        prize_desc = f"Match Win Bonus"

    if prize_amount > 0:
        # DOUBLES CHECK: If winner name has "&", split prize
        if "&" in winner_name:
            # Try to extract IDs from format "Name (ID) & Name (ID)"
            ids = re.findall(r'\((.*?)\)', winner_name)
            if ids:
                 split_prize = prize_amount // 2
                 for team_id in ids:
                     user = db.query(models.User).filter(models.User.team_id == team_id).first()
                     if user:
                         user.wallet_balance += split_prize
                         db.add(models.Transaction(user_id=user.id, amount=split_prize, type="CREDIT", mode="PRIZE", description=prize_desc))
        else:
            # SINGLES CHECK
            # Extract single ID
            single_id_match = re.search(r'\((.*?)\)', winner_name)
            if single_id_match:
                 team_id = single_id_match.group(1)
                 user = db.query(models.User).filter(models.User.team_id == team_id).first()
                 if user:
                     user.wallet_balance += prize_amount
                     db.add(models.Transaction(user_id=user.id, amount=prize_amount, type="CREDIT", mode="PRIZE", description=prize_desc))

    # Handle 2nd Place (Loser of Final)
    if is_final:
        loser_name = match.t2 if winner_name == match.t1 else match.t1
        p2_amount = safe_int(match_category_settings.get('p2'))
        
        if p2_amount > 0:
             ids = re.findall(r'\((.*?)\)', loser_name)
             if ids:
                 split_prize = p2_amount // 2
                 for team_id in ids:
                     user = db.query(models.User).filter(models.User.team_id == team_id).first()
                     if user:
                         user.wallet_balance += split_prize
                         db.add(models.Transaction(user_id=user.id, amount=split_prize, type="CREDIT", mode="PRIZE", description=f"2nd Place: {match.category}"))
             else:
                 # Single loser
                 single_id_match = re.search(r'\((.*?)\)', loser_name)
                 if single_id_match:
                     team_id = single_id_match.group(1)
                     user = db.query(models.User).filter(models.User.team_id == team_id).first()
                     if user:
                         user.wallet_balance += p2_amount
                         db.add(models.Transaction(user_id=user.id, amount=p2_amount, type="CREDIT", mode="PRIZE", description=f"2nd Place: {match.category}"))


@app.post("/verify-score")
def verify_score(data: ScoreVerify, db: Session = Depends(get_db)):
    m = db.query(models.Match).filter(models.Match.id == data.match_id).first()
    if m: 
        m.status = "Official" if data.action == "APPROVE" else "Disputed"
        
        if m.status == "Official":
             winner = calculate_winner(m.score, m.t1, m.t2)
             if winner: distribute_prize(m, winner, db)

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