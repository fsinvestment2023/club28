from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from database import Base

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    phone = Column(String, unique=True, index=True)
    name = Column(String)
    password = Column(String)
    team_id = Column(String, unique=True)
    wallet_balance = Column(Integer, default=0)
    
    # Relationship to registrations
    registrations = relationship("Registration", back_populates="user")

class Registration(Base):
    __tablename__ = "registrations"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    tournament_name = Column(String) # e.g. "Padel"
    category = Column(String)        # e.g. "Advance"
    group_id = Column(String)        # e.g. "A"
    
    user = relationship("User", back_populates="registrations")

class Tournament(Base):
    __tablename__ = "tournaments"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True)
    type = Column(String) 
    fee = Column(String) 
    prize = Column(String) 
    status = Column(String)
    settings = Column(String, default="[]")
    draw_size = Column(Integer, default=16)

class Match(Base):
    __tablename__ = "matches"
    id = Column(Integer, primary_key=True, index=True)
    category = Column(String) 
    group_id = Column(String)      
    t1 = Column(String)            
    t2 = Column(String)            
    score = Column(String, default=None)
    status = Column(String, default="Scheduled")
    date = Column(String)
    time = Column(String)
    stage = Column(String, default="Group")
    submitted_by_team = Column(String, default=None)