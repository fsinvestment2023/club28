from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, Date, Time
from database import Base

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    phone = Column(String, unique=True, index=True)
    name = Column(String)
    
    # --- NEW AUTH FIELDS ---
    password = Column(String) 
    team_id = Column(String, unique=True) # Must be unique
    
    group_id = Column(String, default="A")
    wallet_balance = Column(Integer, default=0)
    active_category = Column(String, default=None)

class Tournament(Base):
    __tablename__ = "tournaments"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True)
    type = Column(String)
    fee = Column(String)
    prize = Column(String)
    status = Column(String)

class Match(Base):
    __tablename__ = "matches"
    id = Column(Integer, primary_key=True, index=True)
    category = Column(String)
    group_id = Column(String)      
    t1 = Column(String)            
    t2 = Column(String)            
    score = Column(String, default=None)
    status = Column(String, default="Scheduled")
    
    # --- STRICT TYPES ---
    date = Column(Date) 
    time = Column(Time) 
    
    stage = Column(String, default="Group")
    submitted_by_team = Column(String, default=None)