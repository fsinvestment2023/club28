from sqlalchemy import Column, Integer, String, ForeignKey, UniqueConstraint
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
    registrations = relationship("Registration", back_populates="user")

class Registration(Base):
    __tablename__ = "registrations"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    tournament_name = Column(String)
    city = Column(String)
    sport = Column(String)
    category = Column(String)
    group_id = Column(String)
    user = relationship("User", back_populates="registrations")

class Tournament(Base):
    __tablename__ = "tournaments"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    city = Column(String, default="Mumbai")
    sport = Column(String, default="Padel")
    type = Column(String) 
    fee = Column(String) 
    prize = Column(String) 
    status = Column(String)
    
    # --- NEW COLUMNS ---
    venue = Column(String, default="") 
    schedule = Column(String, default="[]") # Stores JSON string of schedule rows
    # -------------------

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