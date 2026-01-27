from __future__ import annotations

import json
import os
from flask import Flask, jsonify, request, session
from flask_socketio import SocketIO, emit, join_room, leave_room
from flask_cors import CORS
from flask_bcrypt import Bcrypt
from models import db, User, UserStats, GameRecord, GamePlayer, EloReplenishLog

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

# === 常量配置 ===
MIN_GAMES_FOR_LEADERBOARD = 10  # 进入主榜的最低对局数
ELO_K_FACTOR = 32  # ELO 变化系数

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
    
    # Initialize stats with new fields
    new_stats = UserStats(user=new_user)
    
    db.session.add(new_user)
    db.session.add(new_stats)
    db.session.commit()

    # Log in immediately
    session['user_id'] = new_user.id

    return jsonify({"message": "User created", "user": new_user.to_dict(), "stats": new_stats.to_dict()}), 201

@app.route("/api/login", methods=["POST"])
def login():
    data = request.json
    username = data.get("username")
    password = data.get("password")

    user = User.query.filter_by(username=username).first()
    if user and bcrypt.check_password_hash(user.password_hash, password):
        session['user_id'] = user.id
        return jsonify({
            "message": "Login successful",
            "user": user.to_dict(),
            "stats": user.stats.to_dict() if user.stats else {}
        }), 200
    
    return jsonify({"error": "Invalid credentials"}), 401

@app.route("/api/me", methods=["GET"])
def get_current_user():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({"error": "Not logged in"}), 401
        
    user = User.query.get(user_id)
    if not user:
        session.clear()
        return jsonify({"error": "User not found"}), 401
        
    return jsonify({
        "user": user.to_dict(),
        "stats": user.stats.to_dict() if user.stats else {}
    }), 200

@app.route("/api/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify({"message": "Logged out"}), 200


@app.route("/api/user/<int:user_id>/stats", methods=["GET"])
def get_user_stats(user_id):
    """获取用户完整统计数据"""
    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404
    
    return jsonify({
        "user": user.to_dict(),
        "stats": user.stats.to_dict() if user.stats else {}
    }), 200


# === 多榜单 API ===

@app.route("/api/leaderboard", methods=["GET"])
def leaderboard():
    """
    竞技榜（主榜）
    排序规则: elo_score DESC, total_games DESC, replenish_count ASC
    要求: total_games >= 10
    """
    top_stats = (UserStats.query
                 .filter(UserStats.total_games >= MIN_GAMES_FOR_LEADERBOARD)
                 .order_by(
                     UserStats.elo_score.desc(),
                     UserStats.total_games.desc(),
                     UserStats.replenish_count.asc()
                 )
                 .limit(20)
                 .all())
    
    results = []
    for stat in top_stats:
        win_rate = (stat.wins / stat.total_games * 100) if stat.total_games > 0 else 0
        results.append({
            "username": stat.user.username,
            "user_id": stat.user_id,
            "elo_score": stat.elo_score,
            "wins": stat.wins,
            "total_games": stat.total_games,
            "win_rate": round(win_rate, 1),
            "self_draw_count": stat.self_draw_count,
            "discard_loss_count": stat.discard_loss_count,
            "replenish_count": stat.replenish_count,
            # 兼容旧字段
            "games_played": stat.total_games,
            "rank_score": stat.elo_score,
        })
    return jsonify(results), 200


@app.route("/api/leaderboard/games", methods=["GET"])
def leaderboard_games():
    """
    肝帝榜
    排序规则: total_games DESC
    """
    top_stats = (UserStats.query
                 .order_by(UserStats.total_games.desc())
                 .limit(20)
                 .all())
    
    results = []
    for stat in top_stats:
        results.append({
            "username": stat.user.username,
            "user_id": stat.user_id,
            "total_games": stat.total_games,
            "wins": stat.wins,
            "elo_score": stat.elo_score,
        })
    return jsonify(results), 200


@app.route("/api/leaderboard/special", methods=["GET"])
def leaderboard_special():
    """
    牌型榜 - 四川麻将特色榜单
    返回多个子榜单
    """
    # 清一色王
    qingyise_top = (UserStats.query
                    .filter(UserStats.qingyise_count > 0)
                    .order_by(UserStats.qingyise_count.desc())
                    .limit(10)
                    .all())
    
    # 七对狂魔
    qidui_top = (UserStats.query
                 .filter(UserStats.qidui_count > 0)
                 .order_by(UserStats.qidui_count.desc())
                 .limit(10)
                 .all())
    
    # 自摸王
    self_draw_top = (UserStats.query
                     .filter(UserStats.self_draw_count > 0)
                     .order_by(UserStats.self_draw_count.desc())
                     .limit(10)
                     .all())
    
    # 放炮之王 😈
    discard_loss_top = (UserStats.query
                        .filter(UserStats.discard_loss_count > 0)
                        .order_by(UserStats.discard_loss_count.desc())
                        .limit(10)
                        .all())
    
    # 杠神
    gang_top = (UserStats.query
                .filter(UserStats.gang_count > 0)
                .order_by(UserStats.gang_count.desc())
                .limit(10)
                .all())
    
    def format_entry(stat, key_field):
        return {
            "username": stat.user.username,
            "user_id": stat.user_id,
            "count": getattr(stat, key_field),
            "total_games": stat.total_games,
        }
    
    return jsonify({
        "qingyise": [format_entry(s, "qingyise_count") for s in qingyise_top],
        "qidui": [format_entry(s, "qidui_count") for s in qidui_top],
        "self_draw": [format_entry(s, "self_draw_count") for s in self_draw_top],
        "discard_loss": [format_entry(s, "discard_loss_count") for s in discard_loss_top],
        "gang": [format_entry(s, "gang_count") for s in gang_top],
    }), 200


@app.route("/api/leaderboard/fun", methods=["GET"])
def leaderboard_fun():
    """
    娱乐榜
    最大负分、连败记录等
    """
    # 最低分记录
    min_elo_top = (UserStats.query
                   .filter(UserStats.min_elo < 1000)
                   .order_by(UserStats.min_elo.asc())
                   .limit(10)
                   .all())
    
    # 最高连败
    losing_streak_top = (UserStats.query
                         .filter(UserStats.max_losing_streak > 0)
                         .order_by(UserStats.max_losing_streak.desc())
                         .limit(10)
                         .all())
    
    # 补分次数最多
    replenish_top = (UserStats.query
                     .filter(UserStats.replenish_count > 0)
                     .order_by(UserStats.replenish_count.desc())
                     .limit(10)
                     .all())
    
    return jsonify({
        "min_elo": [{
            "username": s.user.username,
            "min_elo": s.min_elo,
            "current_elo": s.elo_score,
        } for s in min_elo_top],
        "losing_streak": [{
            "username": s.user.username,
            "max_losing_streak": s.max_losing_streak,
            "total_games": s.total_games,
        } for s in losing_streak_top],
        "replenish": [{
            "username": s.user.username,
            "replenish_count": s.replenish_count,
            "current_elo": s.elo_score,
        } for s in replenish_top],
    }), 200


# === 补分 API ===

@app.route("/api/user/<int:user_id>/replenish", methods=["POST"])
def replenish_elo(user_id):
    """
    补分 API
    规则：
    1. ELO <= 0 时才能补分
    2. 24 小时冷却
    3. 记录补分日志
    """
    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404
    
    if not user.stats:
        return jsonify({"error": "User stats not found"}), 404
    
    stats = user.stats
    
    # 检查是否可以补分
    can_do, reason = stats.can_replenish()
    if not can_do:
        return jsonify({"error": reason, "can_replenish": False}), 400
    
    # 执行补分（事务）
    try:
        before_elo = stats.do_replenish()
        
        # 记录补分日志
        log = EloReplenishLog(
            user_id=user_id,
            before_elo=before_elo,
            after_elo=1000
        )
        db.session.add(log)
        db.session.commit()
        
        return jsonify({
            "message": "补分成功！",
            "before_elo": before_elo,
            "after_elo": 1000,
            "replenish_count": stats.replenish_count,
            "stats": stats.to_dict()
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"补分失败: {str(e)}"}), 500


@app.route("/api/user/<int:user_id>/can-replenish", methods=["GET"])
def check_can_replenish(user_id):
    """检查用户是否可以补分"""
    user = User.query.get(user_id)
    if not user or not user.stats:
        return jsonify({"can_replenish": False, "reason": "用户不存在"}), 404
    
    can_do, reason = user.stats.can_replenish()
    return jsonify({
        "can_replenish": can_do,
        "reason": reason,
        "elo_score": user.stats.elo_score,
        "replenish_count": user.stats.replenish_count
    }), 200


# === 对局结算 API ===

@app.route("/api/game/settle", methods=["POST"])
def settle_game():
    """
    对局结算 API - 原子操作
    请求体:
    {
        "players": [
            {
                "user_id": 1,
                "final_score": 100,
                "is_winner": true,
                "is_self_draw": true,
                "is_discard_loss": false,
                "is_qingyise": false,
                "is_qidui": false,
                "gang_count": 0
            },
            ...
        ],
        "result_summary": "玩家A 胡牌",
        "game_type": "ranked"
    }
    """
    data = request.json
    players_data = data.get("players", [])
    result_summary = data.get("result_summary", "")
    game_type = data.get("game_type", "normal")
    
    if not players_data:
        return jsonify({"error": "No players data"}), 400
    
    try:
        # 开始事务
        # 1. 创建对局记录
        game_record = GameRecord(
            result_summary=result_summary,
            detail_json=json.dumps(data),
            game_type=game_type
        )
        db.session.add(game_record)
        db.session.flush()  # 获取 game_id
        
        # 2. 计算 ELO 变化（简化版本）
        # 真实 ELO 计算应该基于对手分数，这里用简化版
        winner_count = sum(1 for p in players_data if p.get("is_winner"))
        
        results = []
        
        for player_data in players_data:
            user_id = player_data.get("user_id")
            if not user_id:
                continue
            
            user = User.query.get(user_id)
            if not user or not user.stats:
                continue
            
            is_winner = player_data.get("is_winner", False)
            final_score = player_data.get("final_score", 0)
            
            # 简化 ELO 计算
            if is_winner:
                elo_change = ELO_K_FACTOR // winner_count
            else:
                elo_change = -ELO_K_FACTOR // (len(players_data) - winner_count) if winner_count < len(players_data) else 0
            
            # 创建对局玩家记录
            game_player = GamePlayer(
                game_id=game_record.id,
                user_id=user_id,
                final_score=final_score,
                elo_change=elo_change,
                is_winner=is_winner,
                is_self_draw=player_data.get("is_self_draw", False),
                is_discard_loss=player_data.get("is_discard_loss", False),
                is_qingyise=player_data.get("is_qingyise", False),
                is_qidui=player_data.get("is_qidui", False),
                gang_count=player_data.get("gang_count", 0)
            )
            db.session.add(game_player)
            
            # 更新用户统计
            user.stats.update_after_game(
                is_win=is_winner,
                elo_change=elo_change,
                is_self_draw=player_data.get("is_self_draw", False),
                is_discard_loss=player_data.get("is_discard_loss", False),
                is_qingyise=player_data.get("is_qingyise", False),
                is_qidui=player_data.get("is_qidui", False),
                gang_count=player_data.get("gang_count", 0)
            )
            
            results.append({
                "user_id": user_id,
                "username": user.username,
                "elo_change": elo_change,
                "new_elo": user.stats.elo_score,
            })
        
        db.session.commit()
        
        return jsonify({
            "message": "对局结算成功",
            "game_id": game_record.id,
            "results": results
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"对局结算失败: {str(e)}"}), 500


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
