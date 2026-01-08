from sqlalchemy import Column, Integer, String, ForeignKey, UniqueConstraint, DateTime
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
    registration_date = Column(DateTime(timezone=True), server_default=func.now()) 
    
    registrations = relationship("Registration", back_populates="user", foreign_keys="Registration.user_id")

class Registration(Base):
    __tablename__ = "registrations"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    
    # --- NEW DOUBLES FIELDS ---
    partner_id = Column(Integer, nullable=True) # ID of the partner
    status = Column(String, default="Confirmed") # 'Confirmed' or 'Pending_Payment'
    # --------------------------

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
    
    # --- NEW FORMAT FIELD ---
    format = Column(String, default="Singles") # 'Singles' or 'Doubles'
    # ------------------------

    type = Column(String) 
    fee = Column(String) 
    prize = Column(String) 
    status = Column(String)
    venue = Column(String, default="") 
    schedule = Column(String, default="[]")
    settings = Column(String, default="[]")
    draw_size = Column(Integer, default=16)

    __table_args__ = (
        UniqueConstraint('name', 'city', 'sport', name='_name_city_sport_uc'),
    )

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