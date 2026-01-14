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
from datetime import datetime, timedelta
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from contextlib import asynccontextmanager

# --- TWILIO WHATSAPP IMPORTS ---
from twilio.rest import Client

# --- NOTIFICATION IMPORTS ---
from exponent_server_sdk import PushClient
from exponent_server_sdk import PushMessage
from exponent_server_sdk import PushServerError
from requests.exceptions import ConnectionError, HTTPError

# --- CONFIGURATION (FILL THESE) ---
RAZORPAY_KEY_ID = "rzp_test_S2LE18azXpy1S8"
RAZORPAY_KEY_SECRET = "X49kd6GkawnQWTU23KKNVhnz"

# TWILIO CREDENTIALS (GET FROM TWILIO CONSOLE)
TWILIO_SID = "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" 
TWILIO_AUTH_TOKEN = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
TWILIO_FROM = "whatsapp:+14155238886" # Sandbox Number

razorpay_client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))

try:
    twilio_client = Client(TWILIO_SID, TWILIO_AUTH_TOKEN)
except:
    twilio_client = None
    print("⚠️ Twilio Client could not start. Check Credentials.")

FACTS_DB = [
    "🎾 Did you know? Padel was invented in Mexico in 1969!",
    "🚀 Pickleball is the fastest growing sport in the USA!",
    "🎾 The longest tennis match lasted 11 hours and 5 minutes.",
    "🌍 Padel is played by over 25 million people across 90 countries.",
    "🏆 Wimbledon uses 54,250 tennis balls during the tournament.",
]

Base.metadata.create_all(bind=engine)
scheduler = AsyncIOScheduler()

# --- HELPER FUNCTIONS ---

def send_whatsapp_msg(to_number, body_text):
    if not twilio_client: return
    try:
        clean_number = to_number.strip()
        if not clean_number.startswith("+"):
            clean_number = f"+91{clean_number}"
        
        twilio_client.messages.create(
            from_=TWILIO_FROM,
            body=body_text,
            to=f"whatsapp:{clean_number}"
        )
        print(f"✅ WhatsApp Sent to {clean_number}")
    except Exception as e:
        print(f"❌ WhatsApp Error: {e}")

def send_push_alert(token, title, body):
    if not token: return
    try:
        if not token.startswith('ExponentPushToken'): return
        PushClient().publish(PushMessage(to=token, title=title, body=body))
    except Exception as e:
        print(f"❌ Push Error: {e}")

def parse_match_datetime(date_str, time_str):
    dt_str = f"{date_str} {time_str}"
    formats = ["%Y-%m-%d %H:%M", "%d/%m/%Y %I:%M %p", "%Y-%m-%d %I:%M %p"]
    for fmt in formats:
        try:
            return datetime.strptime(dt_str, fmt)
        except ValueError:
            continue
    return None

def check_match_reminders():
    db = SessionLocal()
    try:
        setting = db.query(models.SystemSettings).filter(models.SystemSettings.key == "reminder_hours").first()
        reminder_hours = json.loads(setting.value) if setting else [24, 2]
        matches = db.query(models.Match).filter(models.Match.status == "Scheduled").all()
        now = datetime.now()
        
        for m in matches:
            match_dt = parse_match_datetime(m.date, m.time)
            if not match_dt: continue
            
            time_diff = match_dt - now
            hours_left = time_diff.total_seconds() / 3600
            sent_list = m.sent_reminders.split(",") if m.sent_reminders else []

            for h in reminder_hours:
                if (h - 0.5) <= hours_left <= (h + 0.5) and str(h) not in sent_list:
                    send_match_alert(db, m, f"{h} Hours to Go! ⏰", f"Match vs {m.t2} starts in {h} hours!")
                    sent_list.append(str(h))
                    m.sent_reminders = ",".join(sent_list)
                    db.commit()
    except Exception as e:
        print(f"Scheduler Error: {e}")
    finally:
        db.close()

def send_match_alert(db, match, title, body):
    player_ids = re.findall(r'\((.*?)\)', match.t1 + match.t2)
    for tid in player_ids:
        user = db.query(models.User).filter(models.User.team_id == tid).first()
        if user and user.push_token:
            send_push_alert(user.push_token, title, body)

@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler.add_job(check_match_reminders, 'interval', minutes=1)
    scheduler.start()
    yield
    scheduler.shutdown()

app = FastAPI(lifespan=lifespan)

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
    try: return int(val)
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
        return None
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

def extract_event_name(description):
    # FIXED: More robust extraction that handles Case Sensitivity
    desc_upper = description.upper()
    try:
        if "FEE: " in desc_upper: 
            return description.split("Fee: ")[1].strip()
        if "MATCH WIN: " in desc_upper: 
            # Case insensitive split trick
            parts = re.split(r'Match Win: ', description, flags=re.IGNORECASE)
            if len(parts) > 1:
                return parts[1].split(" (Match")[0].strip()
        if "PLACE PRIZE: " in desc_upper: 
            parts = re.split(r'Place Prize: ', description, flags=re.IGNORECASE)
            if len(parts) > 1:
                return parts[1].strip()
    except:
        pass
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
class ClubInfoUpdate(BaseModel): section: str; content: str
class SystemNotifCreate(BaseModel): type: str; title: str; message: str
class RazorpayOrder(BaseModel): amount: int
class RazorpayVerify(BaseModel): razorpay_payment_id: str; razorpay_order_id: str; razorpay_signature: str; team_id: str; amount: int
class PushTokenUpdate(BaseModel): team_id: str; token: str
class SettingsUpdate(BaseModel): key: str; value: list 
class PasswordResetRequest(BaseModel): phone: str; new_password: str

# --- ENDPOINTS ---

@app.get("/")
def read_root(): return {"message": "Club 28 Backend Online"}

# --- WHATSAPP OTP ---
OTP_CACHE = {}

@app.post("/send-otp")
def send_otp(data: OTPRequest):
    otp = str(random.randint(1000, 9999))
    OTP_CACHE[data.phone] = otp
    send_whatsapp_msg(data.phone, f"Your Club 28 Code is: {otp}")
    return {"status": "sent", "otp": "1234"} # Keep 1234 for testing fallback if needed

@app.post("/check-phone")
def check_phone(data: OTPRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.phone == data.phone).first()
    if not user: raise HTTPException(status_code=404, detail="Phone number not found")
    # Send OTP for Forgot Password
    otp = str(random.randint(1000, 9999))
    OTP_CACHE[data.phone] = otp
    send_whatsapp_msg(data.phone, f"Reset Password Code: {otp}")
    return {"status": "exists", "otp": "1234", "team_id": user.team_id}

@app.post("/register")
def register(data: RegisterRequest, db: Session = Depends(get_db)):
    exists = db.query(models.User).filter(models.User.phone == data.phone).first()
    if exists: raise HTTPException(status_code=400, detail="Phone already registered")
    
    team_id = f"{data.name[:2].upper()}{data.phone[-2:]}"
    while db.query(models.User).filter(models.User.team_id == team_id).first():
        team_id = f"{data.name[:2].upper()}{random.randint(10,99)}"
        
    new_user = models.User(phone=data.phone, name=data.name, password=data.password, team_id=team_id, wallet_balance=0)
    db.add(new_user); db.commit(); db.refresh(new_user)
    
    send_whatsapp_msg(data.phone, f"🎉 Welcome to Club 28!\nYour Team ID is: {team_id}\nUse this to login.")
    return {"status": "created", "user": new_user}

@app.post("/join-tournament")
def join_tournament(data: JoinRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.phone == data.phone).first()
    if not user: raise HTTPException(status_code=404, detail="User not found")
    tourney = db.query(models.Tournament).filter(models.Tournament.name == data.tournament_name, models.Tournament.city == data.city).first()
    if not tourney: raise HTTPException(status_code=404, detail="Tournament not found")
    
    existing = db.query(models.Registration).filter(models.Registration.user_id == user.id, models.Registration.tournament_name == data.tournament_name, models.Registration.city == data.city).first()
    if existing: raise HTTPException(status_code=400, detail=f"Already registered ({existing.status})")

    categories = json.loads(tourney.settings)
    per_person_fee = 0
    for cat in categories:
        if cat['name'] == data.level: per_person_fee = safe_int(cat.get('fee')); break
    
    is_doubles = tourney.format == "Doubles"
    pay_amount = per_person_fee
    if is_doubles and data.payment_scope == "TEAM": pay_amount = per_person_fee * 2

    # Check Balance & Deduct
    if user.wallet_balance < pay_amount: raise HTTPException(status_code=400, detail="Insufficient Wallet Balance")
    user.wallet_balance -= pay_amount
    db.add(models.Transaction(user_id=user.id, amount=pay_amount, type="DEBIT", mode="EVENT_FEE", description=f"Fee: {data.tournament_name}"))

    partner = None
    if is_doubles:
        partner = db.query(models.User).filter(models.User.team_id == data.partner_team_id.upper()).first()
        if not partner: raise HTTPException(status_code=404, detail="Partner ID not found")
        
        if data.payment_scope == "TEAM":
             group, status = get_next_group(db, data.tournament_name, data.city, data.level, tourney.draw_size)
             db.add(models.Registration(user_id=user.id, partner_id=partner.id, tournament_name=data.tournament_name, city=data.city, sport=tourney.sport, category=data.level, group_id=group, status="Confirmed"))
             db.add(models.Registration(user_id=partner.id, partner_id=user.id, tournament_name=data.tournament_name, city=data.city, sport=tourney.sport, category=data.level, group_id=group, status="Confirmed"))
             db.commit()
             
             # WHATSAPP
             msg = f"🎾 Confirmed! You joined {data.tournament_name} ({data.category}). Group {group}."
             send_whatsapp_msg(user.phone, msg)
             send_whatsapp_msg(partner.phone, msg)
             
             return {"status": "joined", "message": "Team Registered!", "user": user}
        else:
             db.add(models.Registration(user_id=user.id, partner_id=partner.id, tournament_name=data.tournament_name, city=data.city, sport=tourney.sport, category=data.level, group_id=None, status="Partial_Confirmed"))
             db.add(models.Registration(user_id=partner.id, partner_id=user.id, tournament_name=data.tournament_name, city=data.city, sport=tourney.sport, category=data.level, group_id=None, status="Pending_Payment"))
             db.commit()
             
             # WHATSAPP
             send_whatsapp_msg(user.phone, f"✅ Paid for your share of {data.tournament_name}. Waiting for partner.")
             send_whatsapp_msg(partner.phone, f"📩 Invite: {user.name} invited you to {data.tournament_name}. Log in to Club 28 app to pay & confirm.")
             
             return {"status": "pending_partner", "message": "Registered! Partner must accept.", "user": user}
    else:
        # SINGLES
        group, status = get_next_group(db, data.tournament_name, data.city, data.level, tourney.draw_size)
        db.add(models.Registration(user_id=user.id, tournament_name=data.tournament_name, city=data.city, sport=tourney.sport, category=data.level, group_id=group, status="Confirmed"))
        db.commit()
        
        send_whatsapp_msg(user.phone, f"🎾 Confirmed! You joined {data.tournament_name} ({data.category}). Group {group}.")
        return {"status": "joined", "user": user}

@app.post("/confirm-partner")
def confirm_partner_registration(data: ConfirmPartnerRequest, db: Session = Depends(get_db)):
    reg_b = db.query(models.Registration).filter(models.Registration.id == data.reg_id).first()
    if not reg_b: raise HTTPException(status_code=400, detail="Invalid Request")
    
    user_b = db.query(models.User).filter(models.User.id == reg_b.user_id).first()
    reg_a = db.query(models.Registration).filter(models.Registration.user_id == reg_b.partner_id, models.Registration.tournament_name == reg_b.tournament_name, models.Registration.status == "Partial_Confirmed").first()
    
    tourney = db.query(models.Tournament).filter(models.Tournament.name == reg_b.tournament_name, models.Tournament.city == reg_b.city).first()
    categories = json.loads(tourney.settings)
    pay_amount = 0
    for cat in categories:
        if cat['name'] == reg_b.category: pay_amount = safe_int(cat.get('fee')); break

    if user_b.wallet_balance < pay_amount: raise HTTPException(status_code=400, detail="Insufficient Wallet Balance")
    user_b.wallet_balance -= pay_amount
    db.add(models.Transaction(user_id=user_b.id, amount=pay_amount, type="DEBIT", mode="EVENT_FEE", description=f"Fee: {reg_b.tournament_name}"))
    
    group, status = get_next_group(db, reg_b.tournament_name, reg_b.city, reg_b.category, tourney.draw_size)
    reg_a.status = "Confirmed"; reg_a.group_id = group
    reg_b.status = "Confirmed"; reg_b.group_id = group
    db.commit()

    # WHATSAPP
    msg = f"🚀 Team Confirmed! You are now registered for {reg_b.tournament_name}."
    send_whatsapp_msg(user_b.phone, msg)
    partner = db.query(models.User).filter(models.User.id == reg_a.user_id).first()
    if partner: send_whatsapp_msg(partner.phone, f"✅ Partner paid! Team confirmed for {reg_b.tournament_name}.")
        
    return {"status": "confirmed", "message": "Team Registered!", "new_balance": user_b.wallet_balance}

@app.get("/user/{team_id}/notifications")
def get_user_notifications(team_id: str, tournament: str = None, city: str = None, db: Session = Depends(get_db)):
    # FIXED: Includes PRIZE transactions (Earnings) & Case Insensitive Logic
    user = db.query(models.User).filter(models.User.team_id == team_id).first()
    if not user: return []
    final_feed = []
    
    # 1. Welcome + WINNINGS Notifs (Added PRIZE mode)
    txns = db.query(models.Transaction).filter(
        models.Transaction.user_id == user.id, 
        models.Transaction.mode.in_(["EVENT_FEE", "PRIZE"]) # Added PRIZE here
    ).order_by(models.Transaction.date.desc()).limit(20).all()
    
    for t in txns:
        if "(ARCHIVED)" in t.description: continue
        
        extracted_name = extract_event_name(t.description)
        # Case Insensitive Check
        if tournament and (extracted_name.upper() != tournament.upper()): continue
        
        if t.mode == "EVENT_FEE":
            final_feed.append({ "id": f"welcome_{t.id}", "tab": "PERSONAL", "title": "Registration Successful", "message": f"Welcome to {extracted_name}!", "sub_text": t.date.strftime("%d %b"), "time": t.date.strftime("%I:%M %p"), "sort_key": t.date.timestamp() })
        elif t.mode == "PRIZE":
             final_feed.append({ "id": f"prize_{t.id}", "tab": "PERSONAL", "title": "You Won! 🏆", "message": f"₹{t.amount} credited for {t.description}", "sub_text": t.date.strftime("%d %b"), "time": t.date.strftime("%I:%M %p"), "sort_key": t.date.timestamp() })

    # 2. Match Schedule Notifs
    match_query = db.query(models.Match).filter((models.Match.t1.contains(team_id) | models.Match.t2.contains(team_id)), models.Match.status == "Scheduled")
    all_matches = match_query.all()
    
    for m in all_matches:
        if tournament and m.category.upper() != tournament.upper(): continue
        
        opponent = m.t2 if team_id in m.t1 else m.t1
        final_feed.append({ "id": f"match_{m.id}", "tab": "PERSONAL", "title": "Upcoming Match", "message": f"Vs {opponent}", "sub_text": f"{m.date} @ {m.time}", "time": m.time, "sort_key": 9999999999 }) 
    
    return sorted(final_feed, key=lambda x: x['sort_key'], reverse=True)

@app.get("/user/{team_id}/transactions")
def get_user_transactions(team_id: str, tournament: str = None, db: Session = Depends(get_db)):
    # FIXED: Case Insensitive Filtering for Earnings Tracker
    user = db.query(models.User).filter(models.User.team_id == team_id).first()
    if not user: return []
    
    query = db.query(models.Transaction).filter(models.Transaction.user_id == user.id).order_by(models.Transaction.date.desc())
    all_txns = query.all()
    
    if tournament:
        filtered_txns = []
        for t in all_txns:
            if "(ARCHIVED)" in t.description: continue
            extracted_name = extract_event_name(t.description)
            if tournament.upper() == extracted_name.upper(): 
                filtered_txns.append(t)
        return filtered_txns
    
    return all_txns

# --- KEEPING EXISTING ENDPOINTS ---
@app.post("/admin/create-match")
def admin_create_match(m: MatchCreate, db: Session = Depends(get_db)):
    db.add(models.Match(category=m.category, city=m.city, group_id=m.group_id, t1=m.t1, t2=m.t2, date=m.date, time=m.time, status="Scheduled", stage=m.stage))
    db.commit()
    return {"message": "Created"}

@app.get("/tournaments")
def get_tournaments(db: Session = Depends(get_db)): return db.query(models.Tournament).all()

@app.get("/user/{team_id}")
def get_user_details(team_id: str, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.team_id == team_id).first()
    if not user: raise HTTPException(status_code=404, detail="User not found")
    
    regs = db.query(models.Registration).filter(models.Registration.user_id == user.id, models.Registration.status == "Confirmed").all()
    reg_data = [{"tournament": r.tournament_name, "city": r.city, "sport": r.sport, "level": r.category, "group": r.group_id} for r in regs]
    
    pending = db.query(models.Registration).filter(models.Registration.user_id == user.id, models.Registration.status == "Pending_Payment").all()
    pending_list = []
    for p in pending:
        partner = db.query(models.User).filter(models.User.id == p.partner_id).first()
        tourney = db.query(models.Tournament).filter(models.Tournament.name == p.tournament_name, models.Tournament.city == p.city).first()
        fee = 0
        if tourney:
            try:
                cats = json.loads(tourney.settings)
                for c in cats:
                    if c['name'] == p.category: fee = safe_int(c.get('fee')); break
            except: pass
        pending_list.append({ "reg_id": p.id, "tournament_name": p.tournament_name, "city": p.city, "level": p.category, "inviter_code": f"{partner.name} ({partner.team_id})" if partner else "Unknown", "amount_due": fee })

    return { "id": user.id, "name": user.name, "team_id": user.team_id, "phone": user.phone, "wallet_balance": user.wallet_balance, "email": user.email, "gender": user.gender, "dob": user.dob, "play_location": user.play_location, "bank_details": user.bank_details, "registrations": reg_data, "pending_requests": pending_list }

@app.get("/admin/players")
def get_all_players(db: Session = Depends(get_db)): return db.query(models.User).all()

@app.post("/login")
def login(data: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.team_id == data.team_id).first()
    if not user: raise HTTPException(status_code=404, detail="Team ID not found")
    if user.password != data.password: raise HTTPException(status_code=401, detail="Wrong Password")
    return {"status": "success", "user": user}

@app.get("/scores")
def get_scores(db: Session = Depends(get_db)): return db.query(models.Match).all()

@app.get("/standings")
def get_standings(tournament: str, city: str, level: str = None, db: Session = Depends(get_db)):
    query = db.query(models.Registration).filter(models.Registration.tournament_name == tournament, models.Registration.city == city, models.Registration.status == "Confirmed")
    if level and level not in ["undefined", "null", ""]: query = query.filter(models.Registration.category == level)
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
        if reg.partner_id:
            partner = db.query(models.User).filter(models.User.id == reg.partner_id).first()
            if partner:
                display_name = f"{user.name} ({user.team_id}) & {partner.name} ({partner.team_id})"
                if not is_pending:
                    partner_reg = db.query(models.Registration).filter(models.Registration.user_id == partner.id, models.Registration.tournament_name == name, models.Registration.city == city).first()
                    if partner_reg: processed_ids.append(partner_reg.id)
        players.append({ "id": user.id, "name": display_name, "team_id": user.team_id, "phone": user.phone, "group_id": reg.group_id if not is_pending else "WAITING", "active_level": reg.category })
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

# --- OTHER UTILS ---
@app.post("/admin/create-notification")
def create_notification(data: SystemNotifCreate, db: Session = Depends(get_db)):
    db.add(models.Notification(type=data.type, title=data.title, message=data.message))
    db.commit()
    users = db.query(models.User).filter(models.User.push_token != None).all()
    for u in users: send_push_alert(u.push_token, data.title, data.message)
    return {"status": "created"}

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
        if user.push_token: send_push_alert(user.push_token, "You Won! 🏆", f"₹{amount} credited for {desc}")

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
        if p1_amt > 0:
            amount = p1_amt // len(winner_ids)
            for tid in winner_ids:
                u = db.query(models.User).filter(models.User.team_id == tid).first()
                if u: credit_user(db, u.id, amount, f"1st Place Prize: {match.category}")
        loser_name = match.t2 if winner_name == match.t1 else match.t1
        loser_ids = re.findall(r'\((.*?)\)', loser_name)
        p2_amt = safe_int(settings.get('p2', 0))
        if loser_ids and p2_amt > 0:
            amount = p2_amt // len(loser_ids)
            for tid in loser_ids:
                u = db.query(models.User).filter(models.User.team_id == tid).first()
                if u: credit_user(db, u.id, amount, f"2nd Place Prize: {match.category}")
    elif match.stage == "3rd Place":
        p3_amt = safe_int(settings.get('p3', 0))
        if p3_amt > 0:
            amount = p3_amt // len(winner_ids)
            for tid in winner_ids:
                u = db.query(models.User).filter(models.User.team_id == tid).first()
                if u: credit_user(db, u.id, amount, f"3rd Place Prize: {match.category}")

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






