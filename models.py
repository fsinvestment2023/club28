from sqlalchemy import Column, Integer, String, Boolean, ForeignKey
from database import Base

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    phone = Column(String, unique=True, index=True)
    name = Column(String)
    team_id = Column(String)
    group_id = Column(String)
    wallet_balance = Column(Integer, default=0)
    active_category = Column(String, default=None) # Stores the Tournament Name they joined

class Tournament(Base):
    __tablename__ = "tournaments"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True) # e.g. "Jan League", "1-Day Cup"
    type = Column(String) # "League" or "Knockout"
    fee = Column(String) # "2,500"
    prize = Column(String) # "50,000"
    status = Column(String) # "Open", "Ongoing", "Finished"

class Match(Base):
    __tablename__ = "matches"
    id = Column(Integer, primary_key=True, index=True)
    category = Column(String) # LINKS TO TOURNAMENT NAME
    group_id = Column(String)      
    t1 = Column(String)            
    t2 = Column(String)            
    score = Column(String, default=None)
    status = Column(String, default="Scheduled")
    date = Column(String)
    time = Column(String)
    stage = Column(String, default="Group")
    submitted_by_team = Column(String, default=None)