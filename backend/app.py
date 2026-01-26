from __future__ import annotations

import json
import os
from flask import Flask, jsonify, request
from flask_socketio import SocketIO, emit, join_room, leave_room
from flask_cors import CORS
from flask_bcrypt import Bcrypt
from models import db, User, UserStats, GameRecord

app = Flask(__name__)
# Configuration
app.config["SECRET_KEY"] = "sichuan-mahjong-secret-key"
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///mahjong.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["JSON_AS_ASCII"] = False

# Initialize Extensions
CORS(app, resources={r"/api/*": {"origins": "*", "supports_credentials": True}})
db.init_app(app)
bcrypt = Bcrypt(app)
socketio = SocketIO(app, cors_allowed_origins="*")

# Create DB tables
with app.app_context():
    db.create_all()

# --- Auth Routes ---

@app.route("/api/register", methods=["POST"])
def register():
    data = request.json
    username = data.get("username")
    password = data.get("password")

    if not username or not password:
        return jsonify({"error": "Username and password required"}), 400

    if User.query.filter_by(username=username).first():
        return jsonify({"error": "Username already exists"}), 409

    hashed_pw = bcrypt.generate_password_hash(password).decode('utf-8')
    new_user = User(username=username, password_hash=hashed_pw)
    
    # Initialize stats
    new_stats = UserStats(user=new_user)
    
    db.session.add(new_user)
    db.session.add(new_stats)
    db.session.commit()

    return jsonify({"message": "User created", "user": new_user.to_dict()}), 201

@app.route("/api/login", methods=["POST"])
def login():
    data = request.json
    username = data.get("username")
    password = data.get("password")

    user = User.query.filter_by(username=username).first()
    if user and bcrypt.check_password_hash(user.password_hash, password):
        return jsonify({
            "message": "Login successful",
            "user": user.to_dict(),
            "stats": user.stats.to_dict() if user.stats else {}
        }), 200
    
    return jsonify({"error": "Invalid credentials"}), 401

@app.route("/api/leaderboard", methods=["GET"])
def leaderboard():
    # Top 10 by rank_score
    top_stats = UserStats.query.order_by(UserStats.rank_score.desc()).limit(10).all()
    results = []
    for stat in top_stats:
        results.append({
            "username": stat.user.username,
            "wins": stat.wins,
            "games_played": stat.games_played,
            "rank_score": stat.rank_score
        })
    return jsonify(results), 200

# --- SocketIO Events ---

@socketio.on("connect")
def handle_connect():
    print("Client connected")

@socketio.on("disconnect")
def handle_disconnect():
    print("Client disconnected")

@socketio.on("join_game")
def handle_join(data):
    room = data.get("roomId")
    if room:
        join_room(room)
        print(f"Client joined room: {room}")
        emit("player_joined", {"message": "A player joined"}, to=room)

@socketio.on("leave_game")
def handle_leave(data):
    room = data.get("roomId")
    if room:
        leave_room(room)
        print(f"Client left room: {room}")
        emit("player_left", {"message": "A player left"}, to=room)

@socketio.on("game_action")
def handle_action(data):
    room = data.get("roomId")
    if room:
        # Broadcast action to all in room
        emit("game_action", data, to=room)

@socketio.on("game_state_sync")
def handle_state_sync(data):
    room = data.get("roomId")
    if room:
        emit("game_state_sync", data, to=room)

@app.route("/health")
def health():
    return jsonify({"status": "ok"})

if __name__ == "__main__":
    socketio.run(app, host="0.0.0.0", port=6001, debug=True)
