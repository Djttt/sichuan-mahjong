from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()

class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(128), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    stats = db.relationship('UserStats', backref='user', uselist=False, cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "username": self.username,
            "created_at": self.created_at.isoformat()
        }

class UserStats(db.Model):
    __tablename__ = 'user_stats'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), unique=True, nullable=False)
    wins = db.Column(db.Integer, default=0)
    games_played = db.Column(db.Integer, default=0)
    rank_score = db.Column(db.Integer, default=1000)

    def to_dict(self):
        return {
            "wins": self.wins,
            "games_played": self.games_played,
            "rank_score": self.rank_score
        }

class GameRecord(db.Model):
    __tablename__ = 'game_records'
    id = db.Column(db.Integer, primary_key=True)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    # Store simplified result: e.g., "Winner: UserA, Scores: ..."
    result_summary = db.Column(db.String(255))
    detail_json = db.Column(db.Text) # Full JSON data if needed

    def to_dict(self):
        return {
            "id": self.id,
            "timestamp": self.timestamp.isoformat(),
            "summary": self.result_summary
        }
