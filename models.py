from sqlalchemy import Column, Integer, String, ForeignKey, UniqueConstraint, DateTime, Boolean, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    phone = Column(String, unique=True, index=True)
    name = Column(String)
    password = Column(String)
    team_id = Column(String, unique=True)
    wallet_balance = Column(Integer, default=0)
    
    email = Column(String, default="")
    gender = Column(String, default="")
    dob = Column(String, default="")
    play_location = Column(String, default="")
    bank_details = Column(String, default="") 
    push_token = Column(String, default=None) 
    
    registration_date = Column(DateTime(timezone=True), server_default=func.now()) 
    registrations = relationship("Registration", back_populates="user", foreign_keys="Registration.user_id")
    transactions = relationship("Transaction", back_populates="user")
    
    # NEW RELATIONSHIPS
    hosted_matches = relationship("PickupMatch", back_populates="host")
    pickup_participations = relationship("PickupPlayer", back_populates="user")

class Transaction(Base):
    __tablename__ = "transactions"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    amount = Column(Integer)
    type = Column(String) 
    mode = Column(String) 
    description = Column(String)
    bank_details = Column(String, default="") 
    status = Column(String, default="COMPLETED") 
    date = Column(DateTime(timezone=True), server_default=func.now())
    user = relationship("User", back_populates="transactions")

class Registration(Base):
    __tablename__ = "registrations"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    partner_id = Column(Integer, nullable=True) 
    status = Column(String, default="Confirmed") 
    tournament_name = Column(String)
    city = Column(String)
    sport = Column(String)
    category = Column(String)
    group_id = Column(String)
    user = relationship("User", back_populates="registrations", foreign_keys=[user_id])

class Tournament(Base):
    __tablename__ = "tournaments"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    city = Column(String, default="Mumbai")
    sport = Column(String, default="Padel")
    format = Column(String, default="Singles") 
    type = Column(String) 
    fee = Column(String) 
    prize = Column(String) 
    status = Column(String)
    venue = Column(String, default="") 
    about = Column(String, default="") 
    schedule = Column(String, default="[]")
    settings = Column(String, default="[]")
    draw_size = Column(Integer, default=16)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    __table_args__ = (UniqueConstraint('name', 'city', 'sport', name='_name_city_sport_uc'),)

class Match(Base):
    __tablename__ = "matches"
    id = Column(Integer, primary_key=True, index=True)
    category = Column(String) 
    city = Column(String)
    group_id = Column(String)      
    t1 = Column(String)            
    t2 = Column(String)            
    score = Column(String, default=None)
    status = Column(String, default="Scheduled")
    date = Column(String) 
    time = Column(String) 
    stage = Column(String, default="Group")
    submitted_by_team = Column(String, default=None)
    sent_reminders = Column(String, default="") 

class ClubInfo(Base):
    __tablename__ = "club_info"
    id = Column(Integer, primary_key=True, index=True)
    section_name = Column(String, unique=True)
    content = Column(String)

class Notification(Base):
    __tablename__ = "notifications"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    type = Column(String)
    title = Column(String)
    message = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class SystemSettings(Base):
    __tablename__ = "system_settings"
    id = Column(Integer, primary_key=True, index=True)
    key = Column(String, unique=True) 
    value = Column(String)            

# --- NEW TABLES FOR FIND MATCH FEATURE ---

class PickupMatch(Base):
    __tablename__ = "pickup_matches"
    id = Column(Integer, primary_key=True, index=True)
    host_id = Column(Integer, ForeignKey("users.id"))
    type = Column(String)  # PUBLIC or PRIVATE
    sport = Column(String, default="Padel")
    date = Column(String)
    time = Column(String)
    venue = Column(String)
    description = Column(String, default="")
    
    total_slots = Column(Integer)
    filled_slots = Column(Integer, default=1) # Host is 1
    total_cost = Column(Integer)
    cost_per_person = Column(Integer)
    
    is_flexible = Column(Boolean, default=False)
    join_mode = Column(String, default="OPEN") # OPEN or REQUEST
    status = Column(String, default="OPEN") # OPEN, FULL, COMPLETED, CANCELLED
    
    payout_status = Column(String, default="PENDING") # PENDING, PAID_TO_HOST
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    host = relationship("User", back_populates="hosted_matches")
    players = relationship("PickupPlayer", back_populates="match", cascade="all, delete-orphan")

class PickupPlayer(Base):
    __tablename__ = "pickup_players"
    id = Column(Integer, primary_key=True, index=True)
    match_id = Column(Integer, ForeignKey("pickup_matches.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    
    status = Column(String, default="CONFIRMED") # REQUESTED, CONFIRMED, REJECTED, INVITED
    payment_status = Column(String, default="PENDING") # PENDING, PAID_PLATFORM, PAID_HOST_DIRECT
    joined_at = Column(DateTime(timezone=True), server_default=func.now())
    
    match = relationship("PickupMatch", back_populates="players")
    user = relationship("User", back_populates="pickup_participations")