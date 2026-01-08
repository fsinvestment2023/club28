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
    transactions = relationship("Transaction", back_populates="user")

class Transaction(Base):
    __tablename__ = "transactions"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    amount = Column(Integer)
    type = Column(String) # "CREDIT" (Added) or "DEBIT" (Withdrawn/Spent)
    mode = Column(String) # "WALLET_TOPUP", "EVENT_FEE", "DIRECT_PAYMENT"
    description = Column(String)
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