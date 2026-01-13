from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from database import engine, SessionLocal, Base
import models
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import json
import random
import re
from sqlalchemy import desc
import razorpay

# Create Database Tables
Base.metadata.create_all(bind=engine)

app = FastAPI()

# --- CORS MIDDLEWARE ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- RAZORPAY CONFIGURATION ---
RAZORPAY_KEY_ID = "rzp_test_S2LE18azXpy1S8"
RAZORPAY_KEY_SECRET = "X49kd6GkawnQWTU23KKNVhnz"
razorpay_client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))

# --- DEPENDENCY ---
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- HELPER FUNCTIONS ---
def safe_int(val):
    try:
        if val is None or val == "": return 0
        return int(val)
    except: return 0

def calculate_winner(score_str, t1, t2):
    if not score_str: return None
    try:
        t1_sets, t2_sets = 0, 0
        score_txt = score_str.replace(" ", "")
        sets = re.split(r'[,|]', score_txt)
        for s in sets:
            p = s.split('-')
            if len(p) == 2:
                if int(p[0]) > int(p[1]): t1_sets += 1
                elif int(p[1]) > int(p[0]): t2_sets += 1
        if t1_sets > t2_sets: return t1
        elif t2_sets > t1_sets: return t2
        else: return None
    except: return None

def get_winner_text(score, t1, t2):
    winner = calculate_winner(score, t1, t2)
    if not winner: return "Match Drawn"
    loser = t2 if winner == t1 else t1
    return f"{winner} beats {loser}"

def get_next_group(db: Session, tournament_name: str, city: str, category: str, draw_size: int):
    total_count = db.query(models.Registration).filter(
        models.Registration.tournament_name == tournament_name,
        models.Registration.city == city,
        models.Registration.category == category,
        models.Registration.status == "Confirmed"
    ).count()
    allowed_groups = ['A', 'B', 'C', 'D'][:(draw_size // 4)]
    if not allowed_groups: allowed_groups = ['A']
    return allowed_groups[total_count % len(allowed_groups)], "OK"

# --- NEW HELPER: STRICT EVENT NAME EXTRACTION ---
def extract_event_name(description):
    # Extracts the exact event name from transaction descriptions
    # Formats: "Fee: EVENTNAME", "Match Win: EVENTNAME (Match #1)", "1st Place Prize: EVENTNAME"
    desc_upper = description.upper()
    
    if "FEE: " in desc_upper:
        return description.split("Fee: ")[1].strip()
    
    if "MATCH WIN: " in desc_upper:
        # Split by "Match Win: " then take part before " (Match"
        part1 = description.split("Match Win: ")[1]
        return part1.split(" (Match")[0].strip()
    
    if "PLACE PRIZE: " in desc_upper:
        # Handle 1st/2nd/3rd Place Prize
        return description.split("Place Prize: ")[1].strip()
        
    return ""

# --- SCHEMAS ---
class OTPRequest(BaseModel): phone: str
class RegisterRequest(BaseModel): phone: str; name: str; password: str
class LoginRequest(BaseModel): team_id: str; password: str
class WalletUpdate(BaseModel): team_id: str; amount: int
class JoinRequest(BaseModel): phone: str; tournament_name: str; city: str; sport: str; level: str; partner_team_id: str = ""; payment_mode: str = "WALLET"; payment_scope: str = "INDIVIDUAL"
class TournamentCreate(BaseModel): name: str; city: str; sport: str; format: str; type: str; status: str = "Open"; settings: list; draw_size: int = 16; venue: str = ""; about: str = ""; schedule: list = []
class TournamentUpdate(BaseModel): id: int; name: str; city: str; sport: str; format: str; status: str; settings: list; draw_size: int; venue: str; about: str; schedule: list
class TournamentDelete(BaseModel): id: int
class MatchCreate(BaseModel): category: str; city: str; group_id: str; t1: str; t2: str; date: str; time: str; stage: str
class MatchFullUpdate(BaseModel): id: int; t1: str; t2: str; date: str; time: str; score: str
class MatchDelete(BaseModel): id: int
class ScoreSubmit(BaseModel): match_id: int; score: str; submitted_by_team: str
class ScoreVerify(BaseModel): match_id: int; action: str
class AdminAddPlayer(BaseModel): name: str; phone: str; category: str; city: str; level: str
class UserProfileUpdate(BaseModel): team_id: str; email: str; gender: str; dob: str; play_location: str
class ConfirmPartnerRequest(BaseModel): reg_id: int; payment_mode: str
class WithdrawRequest(BaseModel): team_id: str; amount: int; bank_details: str 
class ConfirmWithdrawal(BaseModel): transaction_id: int 
class PasswordResetRequest(BaseModel): phone: str; new_password: str
class ClubInfoUpdate(BaseModel): section: str; content: str
class SystemNotifCreate(BaseModel): type: str; title: str; message: str
class RazorpayOrder(BaseModel): amount: int
class RazorpayVerify(BaseModel): razorpay_payment_id: str; razorpay_order_id: str; razorpay_signature: str; team_id: str; amount: int

# --- ENDPOINTS ---

@app.get("/")
def read_root():
    return {"message": "Club 28 Backend is Online!"}

@app.post("/razorpay/create-order")
def create_razorpay_order(data: RazorpayOrder):
    try:
        amount_in_paise = data.amount * 100
        order_data = { "amount": amount_in_paise, "currency": "INR", "receipt": f"receipt_{random.randint(1000, 9999)}", "payment_capture": 1 }
        order = razorpay_client.order.create(data=order_data)
        return {"status": "created", "order_id": order["id"], "key_id": RAZORPAY_KEY_ID}
    except Exception as e:
        print(e)
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/razorpay/verify-payment")
def verify_razorpay_payment(data: RazorpayVerify, db: Session = Depends(get_db)):
    try:
        params_dict = { 'razorpay_order_id': data.razorpay_order_id, 'razorpay_payment_id': data.razorpay_payment_id, 'razorpay_signature': data.razorpay_signature }
        razorpay_client.utility.verify_payment_signature(params_dict)
    except:
        raise HTTPException(status_code=400, detail="Invalid Payment Signature")
    user = db.query(models.User).filter(models.User.team_id == data.team_id).first()
    if not user: raise HTTPException(status_code=404, detail="User not found")
    user.wallet_balance += data.amount
    db.add(models.Transaction(user_id=user.id, amount=data.amount, type="CREDIT", mode="WALLET_TOPUP", description=f"Razorpay Add: {data.razorpay_payment_id}"))
    db.commit()
    return {"status": "success", "new_balance": user.wallet_balance}

@app.post("/user/withdraw")
def withdraw_money(data: WithdrawRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.team_id == data.team_id).first()
    if not user: raise HTTPException(status_code=404, detail="User not found")
    if user.wallet_balance < data.amount: raise HTTPException(status_code=400, detail="Insufficient Balance")
    user.bank_details = data.bank_details 
    user.wallet_balance -= data.amount
    db.add(models.Transaction(user_id=user.id, amount=data.amount, type="DEBIT", mode="WITHDRAWAL", description="User Withdrawal Request", bank_details=data.bank_details, status="PENDING"))
    db.commit()
    return {"status": "success", "new_balance": user.wallet_balance}

@app.post("/admin/confirm-withdrawal")
def confirm_withdrawal(data: ConfirmWithdrawal, db: Session = Depends(get_db)):
    txn = db.query(models.Transaction).filter(models.Transaction.id == data.transaction_id).first()
    if not txn: raise HTTPException(status_code=404, detail="Transaction not found")
    txn.status = "COMPLETED"
    db.commit()
    return {"status": "success"}

@app.get("/admin/transactions")
def get_all_transactions(db: Session = Depends(get_db)):
    results = db.query(models.Transaction, models.User).join(models.User, models.Transaction.user_id == models.User.id).order_by(models.Transaction.date.desc()).all()
    txns = []
    for txn, user in results:
        txns.append({
            "id": txn.id, "date": txn.date, "amount": txn.amount, "type": txn.type, "mode": txn.mode, "description": txn.description, 
            "bank_details": txn.bank_details, "status": txn.status,
            "user_name": user.name, "user_phone": user.phone, "team_id": user.team_id
        })
    return txns

@app.get("/user/{team_id}")
def get_user_details(team_id: str, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.team_id == team_id).first()
    if not user: raise HTTPException(status_code=404, detail="User not found")
    
    # 1. Confirmed Registrations
    regs = db.query(models.Registration).filter(models.Registration.user_id == user.id, models.Registration.status == "Confirmed").all()
    reg_data = [{"tournament": r.tournament_name, "city": r.city, "sport": r.sport, "level": r.category, "group": r.group_id} for r in regs]
    
    # 2. Pending Requests (where I am the Partner who needs to pay)
    pending = db.query(models.Registration).filter(models.Registration.user_id == user.id, models.Registration.status == "Pending_Payment").all()
    pending_list = []
    for p in pending:
        # Find the person who invited me (partner_id points to them)
        partner = db.query(models.User).filter(models.User.id == p.partner_id).first()
        tourney = db.query(models.Tournament).filter(models.Tournament.name == p.tournament_name, models.Tournament.city == p.city).first()
        
        fee = 0
        if tourney:
            try:
                cats = json.loads(tourney.settings)
                for c in cats:
                    if c['name'] == p.category: 
                        fee = safe_int(c.get('fee'))
                        break
            except: pass
            
        pending_list.append({
            "reg_id": p.id,
            "tournament_name": p.tournament_name, 
            "city": p.city,
            "level": p.category,
            "inviter_code": f"{partner.name} ({partner.team_id})" if partner else "Unknown",
            "amount_due": fee
        })

    return { 
        "id": user.id, "name": user.name, "team_id": user.team_id, "phone": user.phone, 
        "wallet_balance": user.wallet_balance, "email": user.email, "gender": user.gender, "dob": user.dob, 
        "play_location": user.play_location, "bank_details": user.bank_details,
        "registrations": reg_data,
        "pending_requests": pending_list
    }

@app.get("/admin/players")
def get_all_players(db: Session = Depends(get_db)): 
    return db.query(models.User).all()

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

@app.post("/check-phone")
def check_phone(data: OTPRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.phone == data.phone).first()
    if not user: raise HTTPException(status_code=404, detail="Phone number not found")
    return {"status": "exists", "otp": "1234", "team_id": user.team_id}

@app.post("/reset-password")
def reset_password(data: PasswordResetRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.phone == data.phone).first()
    if not user: raise HTTPException(status_code=404, detail="User not found")
    user.password = data.new_password
    db.commit()
    return {"status": "success", "message": "Password updated"}

@app.get("/club-info/{section}")
def get_club_info(section: str, db: Session = Depends(get_db)):
    info = db.query(models.ClubInfo).filter(models.ClubInfo.section_name == section).first()
    return {"content": info.content if info else ""}

@app.post("/admin/update-club-info")
def update_club_info(data: ClubInfoUpdate, db: Session = Depends(get_db)):
    info = db.query(models.ClubInfo).filter(models.ClubInfo.section_name == data.section).first()
    if not info:
        info = models.ClubInfo(section_name=data.section, content=data.content)
        db.add(info)
    else:
        info.content = data.content
    db.commit()
    return {"status": "updated"}

@app.get("/user/{team_id}/notifications")
def get_user_notifications(team_id: str, tournament: str = None, city: str = None, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.team_id == team_id).first()
    if not user: return []
    final_feed = []
    
    # 1. PERSONAL (Strict Exact Match)
    txns_query = db.query(models.Transaction).filter(models.Transaction.user_id == user.id, models.Transaction.mode == "EVENT_FEE").order_by(models.Transaction.date.desc()).limit(10).all()
    for t in txns_query:
        if "(ARCHIVED)" in t.description: continue
        
        extracted_name = extract_event_name(t.description)
        
        # STRICT CHECK: Extracted name must MATCH the requested tournament exactly
        if tournament and (extracted_name.upper() != tournament.upper()): continue
        
        # Ensure tournament still exists
        exists = db.query(models.Tournament).filter(models.Tournament.name == extracted_name).first()
        if not exists: continue 
        
        final_feed.append({ "id": f"welcome_{t.id}", "tab": "PERSONAL", "title": "Registration Successful", "message": f"Welcome to {extracted_name}!", "sub_text": t.date.strftime("%d %b"), "time": t.date.strftime("%I:%M %p"), "sort_key": t.date.timestamp() })

    # 2. MATCHES
    match_query = db.query(models.Match).filter((models.Match.t1.contains(team_id) | models.Match.t2.contains(team_id)), models.Match.status == "Scheduled")
    if tournament: match_query = match_query.filter(models.Match.category == tournament) # DB already exact matches columns
    if city: match_query = match_query.filter(models.Match.city == city)
    matches = match_query.all()
    for m in matches:
        opponent = m.t2 if team_id in m.t1 else m.t1
        final_feed.append({ "id": f"match_{m.id}", "tab": "PERSONAL", "title": "Upcoming Match", "message": f"Vs {opponent}", "sub_text": f"Scheduled: {m.date} @ {m.time}", "time": m.time, "sort_key": 9999999999 })
    
    # 3. RESULTS
    event_match_query = db.query(models.Match).filter(models.Match.status == "Official")
    if tournament: event_match_query = event_match_query.filter(models.Match.category == tournament) # DB exact match
    if city: event_match_query = event_match_query.filter(models.Match.city == city)
    finished_matches = event_match_query.order_by(models.Match.id.desc()).limit(10).all()
    for m in finished_matches:
        final_feed.append({ "id": f"res_{m.id}", "tab": "EVENT", "title": "Match Result", "message": get_winner_text(m.score, m.t1, m.t2), "sub_text": f"{m.category} ({m.city}) • Score: {m.score}", "time": "", "sort_key": m.id })

    # 4. COMMUNITY
    if not tournament:
        new_tourneys = db.query(models.Tournament).order_by(models.Tournament.id.desc()).limit(5).all()
        for t in new_tourneys:
            final_feed.append({ "id": f"tour_{t.id}", "tab": "COMMUNITY", "title": "New Event Added", "message": f"{t.name} is now open!", "sub_text": f"{t.city} • {t.sport}", "time": "", "sort_key": t.id * 1000 })
        manual_notifs = db.query(models.Notification).filter(models.Notification.type == "COMMUNITY").order_by(models.Notification.created_at.desc()).limit(5).all()
        for n in manual_notifs:
            final_feed.append({ "id": f"notif_{n.id}", "tab": "COMMUNITY", "title": n.title, "message": n.message, "sub_text": n.created_at.strftime("%d %b"), "time": "", "sort_key": n.created_at.timestamp() })

    return sorted(final_feed, key=lambda x: x['sort_key'], reverse=True)

@app.post("/admin/create-notification")
def create_notification(data: SystemNotifCreate, db: Session = Depends(get_db)):
    db.add(models.Notification(type=data.type, title=data.title, message=data.message))
    db.commit()
    return {"status": "created"}

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
    matches = db.query(models.Match).filter(models.Match.t1.contains(user.name) | models.Match.t2.contains(user.name)).all()
    return matches

@app.get("/admin/tournament-players")
def get_tournament_players(name: str, city: str, db: Session = Depends(get_db)):
    results = db.query(models.Registration).filter(
        models.Registration.tournament_name == name,
        models.Registration.city == city,
        models.Registration.status.in_(["Confirmed", "Partial_Confirmed"]) 
    ).all()

    players = []
    processed_ids = []

    for reg in results:
        if reg.id in processed_ids: continue

        user = db.query(models.User).filter(models.User.id == reg.user_id).first()
        display_name = f"{user.name} ({user.team_id})"
        
        is_pending = reg.status == "Partial_Confirmed"
        status_suffix = " ⏳ (PENDING)" if is_pending else ""

        if reg.partner_id:
            partner = db.query(models.User).filter(models.User.id == reg.partner_id).first()
            if partner:
                display_name = f"{user.name} ({user.team_id}) & {partner.name} ({partner.team_id}){status_suffix}"
                
                if not is_pending:
                    partner_reg = db.query(models.Registration).filter(
                        models.Registration.user_id == partner.id, 
                        models.Registration.tournament_name == name, 
                        models.Registration.city == city
                    ).first()
                    if partner_reg: processed_ids.append(partner_reg.id)
        
        players.append({
            "id": user.id, 
            "name": display_name, 
            "team_id": user.team_id, 
            "phone": user.phone, 
            "group_id": reg.group_id if not is_pending else "WAITING", 
            "active_level": reg.category
        })
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

@app.post("/admin/manual-register")
def admin_manual_register(data: AdminAddPlayer, db: Session = Depends(get_db)):
    tourney = db.query(models.Tournament).filter(models.Tournament.name == data.category, models.Tournament.city == data.city).first()
    if not tourney: raise HTTPException(status_code=404, detail="Tournament not found")
    group, status = get_next_group(db, data.category, data.city, data.level, tourney.draw_size)
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
             reg_a = models.Registration(user_id=user.id, partner_id=partner.id, tournament_name=data.tournament_name, city=data.city, sport=tourney.sport, category=data.level, group_id=group, status="Confirmed")
             reg_b = models.Registration(user_id=partner.id, partner_id=user.id, tournament_name=data.tournament_name, city=data.city, sport=tourney.sport, category=data.level, group_id=group, status="Confirmed")
             db.add(reg_a); db.add(reg_b); db.commit()
             return {"status": "joined", "message": "Team Registered!", "user": {"id": user.id, "name": user.name, "team_id": user.team_id, "phone": user.phone, "wallet_balance": user.wallet_balance}, "registrations": []}
        else:
             reg_a = models.Registration(user_id=user.id, partner_id=partner.id, tournament_name=data.tournament_name, city=data.city, sport=tourney.sport, category=data.level, group_id=None, status="Partial_Confirmed")
             reg_b = models.Registration(user_id=partner.id, partner_id=user.id, tournament_name=data.tournament_name, city=data.city, sport=tourney.sport, category=data.level, group_id=None, status="Pending_Payment")
             db.add(reg_a); db.add(reg_b); db.commit()
             return {"status": "pending_partner", "message": "Registered! Partner must accept.", "user": {"id": user.id, "name": user.name, "team_id": user.team_id, "phone": user.phone, "wallet_balance": user.wallet_balance}}
    else:
        group, status = get_next_group(db, data.tournament_name, data.city, data.level, tourney.draw_size)
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
    else:
        db.add(models.Transaction(user_id=user_b.id, amount=pay_amount, type="CREDIT", mode="DIRECT_PAYMENT", description=f"Direct Pay: {reg_b.tournament_name}"))
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
            is_in_t1 = user.team_id in m.t1
            is_in_t2 = user.team_id in m.t2
            if reg.partner_id:
                partner = db.query(models.User).filter(models.User.id == reg.partner_id).first()
                if partner:
                    if partner.team_id in m.t1: is_in_t1 = True
                    if partner.team_id in m.t2: is_in_t2 = True
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
                if winner_name and (user.team_id in winner_name): points += 3; won += 1
        standings.append({"name": display_name, "team_id": user.team_id, "group": reg.group_id or "A", "points": points, "gamesWon": won, "played": played, "totalGamePoints": total_game_points})
        processed_ids.append(reg.id)
    standings.sort(key=lambda x: x['points'], reverse=True)
    return standings

# --- UPDATED: STRICT TRANSACTION FILTERING ---
@app.get("/user/{team_id}/transactions")
def get_user_transactions(team_id: str, tournament: str = None, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.team_id == team_id).first()
    if not user: return []
    query = db.query(models.Transaction).filter(models.Transaction.user_id == user.id).order_by(models.Transaction.date.desc())
    all_txns = query.all()
    if tournament:
        filtered_txns = []
        for t in all_txns:
            if "(ARCHIVED)" in t.description: continue
            
            extracted_name = extract_event_name(t.description)
            # STRICT CHECK: Extracted name must MATCH the requested tournament exactly
            if tournament.upper() == extracted_name.upper(): 
                filtered_txns.append(t)
        return filtered_txns
    return all_txns

@app.get("/admin/leaderboard")
def admin_leaderboard(tournament: str, city: str, level: str, db: Session = Depends(get_db)): return get_standings(tournament, city, level, db)
@app.get("/tournaments")
def get_tournaments(db: Session = Depends(get_db)): return db.query(models.Tournament).all()

@app.post("/admin/create-tournament")
def create_tournament(data: TournamentCreate, db: Session = Depends(get_db)):
    fees = [safe_int(c.get('fee')) for c in data.settings]
    total_prizes = [safe_int(c.get('p1'))+safe_int(c.get('p2'))+safe_int(c.get('p3')) for c in data.settings]
    new_t = models.Tournament(name=data.name, city=data.city, sport=data.sport, format=data.format, type=data.type, status=data.status, settings=json.dumps(data.settings), venue=data.venue, about=data.about, schedule=json.dumps(data.schedule), fee=str(min(fees)) if fees else "0", prize=str(max(total_prizes)) if total_prizes else "0", draw_size=data.draw_size)
    db.add(new_t); db.commit(); return {"message": "Created"}

@app.post("/admin/edit-tournament")
def admin_edit_tournament(data: TournamentUpdate, db: Session = Depends(get_db)):
    t = db.query(models.Tournament).filter(models.Tournament.id == data.id).first()
    if t:
        t.name = data.name; t.city = data.city; t.sport = data.sport; t.format = data.format; t.status = data.status; t.settings = json.dumps(data.settings); t.venue = data.venue; t.about = data.about; t.schedule = json.dumps(data.schedule); t.draw_size = data.draw_size; fees = [safe_int(c.get('fee')) for c in data.settings]; t.fee = str(min(fees)) if fees else "0"
        db.commit()
    return {"message": "Updated"}

# --- UPDATED: STRICT ARCHIVING ---
@app.post("/admin/delete-tournament")
def delete_tournament(data: TournamentDelete, db: Session = Depends(get_db)):
    t = db.query(models.Tournament).filter(models.Tournament.id == data.id).first()
    if t:
        # STRICT ARCHIVE: Only archive if EXTRACTED name matches exactly
        candidates = db.query(models.Transaction).filter(
            models.Transaction.description.contains(t.name), # Broad fetch for speed
            models.Transaction.mode.in_(['EVENT_FEE', 'PRIZE'])
        ).all()
        
        for txn in candidates:
            # Check exact match before archiving
            extracted_name = extract_event_name(txn.description)
            if extracted_name.upper() == t.name.upper():
                if "(ARCHIVED)" not in txn.description:
                    txn.description = f"{txn.description} (ARCHIVED)"
        
        db.query(models.Match).filter(models.Match.category == t.name, models.Match.city == t.city).delete()
        db.query(models.Registration).filter(models.Registration.tournament_name == t.name, models.Registration.city == t.city).delete()
        db.delete(t)
        db.commit()
    return {"message": "Deleted & History Archived"}

@app.get("/scores")
def get_scores(db: Session = Depends(get_db)): return db.query(models.Match).all()
@app.post("/admin/create-match")
def admin_create_match(m: MatchCreate, db: Session = Depends(get_db)):
    db.add(models.Match(category=m.category, city=m.city, group_id=m.group_id, t1=m.t1, t2=m.t2, date=m.date or "2025-01-20", time=m.time or "10:00", status="Scheduled", stage=m.stage))
    db.commit(); return {"message": "Created"}

@app.post("/admin/edit-match-full")
def admin_edit_match_full(data: MatchFullUpdate, db: Session = Depends(get_db)):
    m = db.query(models.Match).filter(models.Match.id == data.id).first()
    if m: 
        m.t1 = data.t1; m.t2 = data.t2; m.date = data.date; m.time = data.time; m.score = data.score
        if data.score:
            m.status = "Official"
            winner = calculate_winner(m.score, m.t1, m.t2)
            if winner: distribute_prize(m, winner, db)
        db.commit()
    return {"msg": "ok"}

@app.post("/admin/delete-match")
def admin_delete_match(data: MatchDelete, db: Session = Depends(get_db)):
    db.query(models.Match).filter(models.Match.id == data.id).delete(); db.commit(); return {"msg": "deleted"}
@app.post("/submit-score")
def submit_score(data: ScoreSubmit, db: Session = Depends(get_db)):
    m = db.query(models.Match).filter(models.Match.id == data.match_id).first()
    if m: m.score = data.score; m.submitted_by_team = data.submitted_by_team; m.status = "Pending Verification"; db.commit()
    return {"msg": "ok"}

def credit_user(db, user_id, amount, desc):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if user:
        user.wallet_balance += amount
        db.add(models.Transaction(user_id=user.id, amount=amount, type="CREDIT", mode="PRIZE", description=desc))

def distribute_prize(match, winner_name, db):
    tourney = db.query(models.Tournament).filter(models.Tournament.name == match.category, models.Tournament.city == match.city).first()
    if not tourney: return
    categories = json.loads(tourney.settings)
    winner_ids = re.findall(r'\((.*?)\)', winner_name)
    if not winner_ids: return
    first_winner = db.query(models.User).filter(models.User.team_id == winner_ids[0]).first()
    if not first_winner: return
    reg = db.query(models.Registration).filter(models.Registration.user_id == first_winner.id, models.Registration.tournament_name == match.category, models.Registration.city == match.city).first()
    if not reg: return
    match_level = reg.category 
    settings = next((c for c in categories if c['name'] == match_level), None)
    if not settings: return
    per_match_amt = safe_int(settings.get('per_match', 0))
    match_desc = f"Match Win: {match.category} (Match #{match.id})"
    if per_match_amt > 0:
        amount = per_match_amt // len(winner_ids)
        for tid in winner_ids:
            u = db.query(models.User).filter(models.User.team_id == tid).first()
            if u: credit_user(db, u.id, amount, match_desc)
    
    if match.stage == "Final":
        p1_amt = safe_int(settings.get('p1', 0))
        p1_desc = f"1st Place Prize: {match.category}"
        if p1_amt > 0:
            amount = p1_amt // len(winner_ids)
            for tid in winner_ids:
                u = db.query(models.User).filter(models.User.team_id == tid).first()
                if u: credit_user(db, u.id, amount, p1_desc)
        loser_name = match.t2 if winner_name == match.t1 else match.t1
        loser_ids = re.findall(r'\((.*?)\)', loser_name)
        p2_amt = safe_int(settings.get('p2', 0))
        p2_desc = f"2nd Place Prize: {match.category}"
        if loser_ids and p2_amt > 0:
            amount = p2_amt // len(loser_ids)
            for tid in loser_ids:
                u = db.query(models.User).filter(models.User.team_id == tid).first()
                if u: credit_user(db, u.id, amount, p2_desc)
    elif match.stage == "3rd Place":
        p3_amt = safe_int(settings.get('p3', 0))
        p3_desc = f"3rd Place Prize: {match.category}"
        if p3_amt > 0:
            amount = p3_amt // len(winner_ids)
            for tid in winner_ids:
                u = db.query(models.User).filter(models.User.team_id == tid).first()
                if u: credit_user(db, u.id, amount, p3_desc)

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