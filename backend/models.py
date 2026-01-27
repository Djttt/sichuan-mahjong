from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, timedelta

db = SQLAlchemy()

class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(128), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    stats = db.relationship('UserStats', backref='user', uselist=False, cascade="all, delete-orphan")
    replenish_logs = db.relationship('EloReplenishLog', backref='user', cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "username": self.username,
            "created_at": self.created_at.isoformat()
        }


class UserStats(db.Model):
    """
    用户统计数据表 - 增强版
    包含 ELO 积分、四川麻将特色统计、行为统计
    """
    __tablename__ = 'user_stats'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), unique=True, nullable=False)
    
    # === 核心 ELO 积分 ===
    elo_score = db.Column(db.Integer, default=1000)  # 当前 ELO 分数
    max_elo = db.Column(db.Integer, default=1000)    # 历史最高 ELO
    min_elo = db.Column(db.Integer, default=1000)    # 历史最低 ELO
    
    # === 对局统计 ===
    total_games = db.Column(db.Integer, default=0)   # 总对局数
    wins = db.Column(db.Integer, default=0)          # 胜场
    
    # === 行为统计 ===
    self_draw_count = db.Column(db.Integer, default=0)     # 自摸次数
    discard_loss_count = db.Column(db.Integer, default=0)  # 放炮次数
    
    # === 四川麻将特色统计 ===
    qingyise_count = db.Column(db.Integer, default=0)  # 清一色次数
    qidui_count = db.Column(db.Integer, default=0)     # 七对次数
    gang_count = db.Column(db.Integer, default=0)      # 杠次数
    
    # === 连胜/连败记录 ===
    current_streak = db.Column(db.Integer, default=0)      # 当前连胜(正)/连败(负)
    max_winning_streak = db.Column(db.Integer, default=0)  # 最高连胜
    max_losing_streak = db.Column(db.Integer, default=0)   # 最高连败
    
    # === 补分相关 ===
    replenish_count = db.Column(db.Integer, default=0)  # 补分次数
    last_replenish_at = db.Column(db.DateTime, nullable=True)  # 上次补分时间
    
    # === 时间戳 ===
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # 兼容旧字段名 (暂时保留，后续可移除)
    @property
    def games_played(self):
        return self.total_games
    
    @property
    def rank_score(self):
        return self.elo_score

    def to_dict(self):
        win_rate = (self.wins / self.total_games * 100) if self.total_games > 0 else 0
        return {
            # 核心数据
            "elo_score": self.elo_score,
            "max_elo": self.max_elo,
            "min_elo": self.min_elo,
            # 对局数据
            "total_games": self.total_games,
            "wins": self.wins,
            "win_rate": round(win_rate, 1),
            # 行为数据
            "self_draw_count": self.self_draw_count,
            "discard_loss_count": self.discard_loss_count,
            # 四川麻将特色
            "qingyise_count": self.qingyise_count,
            "qidui_count": self.qidui_count,
            "gang_count": self.gang_count,
            # 连胜连败
            "current_streak": self.current_streak,
            "max_winning_streak": self.max_winning_streak,
            "max_losing_streak": self.max_losing_streak,
            # 补分
            "replenish_count": self.replenish_count,
            # 兼容旧字段
            "games_played": self.total_games,
            "rank_score": self.elo_score,
        }
    
    def can_replenish(self) -> tuple[bool, str]:
        """检查是否可以补分，返回 (可否, 原因)"""
        if self.elo_score > 0:
            return False, "积分仍为正数，无需补分"
        
        if self.last_replenish_at:
            cooldown_end = self.last_replenish_at + timedelta(hours=24)
            if datetime.utcnow() < cooldown_end:
                remaining = cooldown_end - datetime.utcnow()
                hours = int(remaining.total_seconds() // 3600)
                minutes = int((remaining.total_seconds() % 3600) // 60)
                return False, f"冷却中，请等待 {hours}小时{minutes}分钟"
        
        return True, "可以补分"
    
    def do_replenish(self) -> int:
        """执行补分，返回补分前的分数"""
        before_elo = self.elo_score
        self.elo_score = 1000
        self.replenish_count += 1
        self.last_replenish_at = datetime.utcnow()
        # 更新 min_elo（因为归零了）
        if before_elo < self.min_elo:
            self.min_elo = before_elo
        return before_elo
    
    def update_after_game(self, is_win: bool, elo_change: int, 
                          is_self_draw: bool = False, is_discard_loss: bool = False,
                          is_qingyise: bool = False, is_qidui: bool = False, gang_count: int = 0):
        """对局结束后更新统计数据"""
        # 更新 ELO
        self.elo_score += elo_change
        self.total_games += 1
        
        # 更新历史最高/最低
        if self.elo_score > self.max_elo:
            self.max_elo = self.elo_score
        if self.elo_score < self.min_elo:
            self.min_elo = self.elo_score
        
        # 更新胜负
        if is_win:
            self.wins += 1
            # 连胜
            if self.current_streak >= 0:
                self.current_streak += 1
            else:
                self.current_streak = 1
            if self.current_streak > self.max_winning_streak:
                self.max_winning_streak = self.current_streak
        else:
            # 连败
            if self.current_streak <= 0:
                self.current_streak -= 1
            else:
                self.current_streak = -1
            if abs(self.current_streak) > self.max_losing_streak:
                self.max_losing_streak = abs(self.current_streak)
        
        # 更新行为统计
        if is_self_draw:
            self.self_draw_count += 1
        if is_discard_loss:
            self.discard_loss_count += 1
        
        # 更新四川麻将特色统计
        if is_qingyise:
            self.qingyise_count += 1
        if is_qidui:
            self.qidui_count += 1
        self.gang_count += gang_count


class EloReplenishLog(db.Model):
    """
    补分记录表 - 记录每次补分行为
    用于追踪和防止滥用
    """
    __tablename__ = 'elo_replenish_logs'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    before_elo = db.Column(db.Integer, nullable=False)  # 补分前分数
    after_elo = db.Column(db.Integer, default=1000)     # 补分后分数
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "before_elo": self.before_elo,
            "after_elo": self.after_elo,
            "created_at": self.created_at.isoformat()
        }


class GameRecord(db.Model):
    """
    对局记录表 - 增强版
    """
    __tablename__ = 'game_records'
    id = db.Column(db.Integer, primary_key=True)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    result_summary = db.Column(db.String(255))  # 简要结果
    detail_json = db.Column(db.Text)  # 完整 JSON 数据
    
    # 新增：对局类型
    game_type = db.Column(db.String(20), default='normal')  # normal, ranked, etc.

    def to_dict(self):
        return {
            "id": self.id,
            "timestamp": self.timestamp.isoformat(),
            "summary": self.result_summary,
            "game_type": self.game_type
        }


class GamePlayer(db.Model):
    """
    对局玩家关联表 - 记录每局游戏的参与者和表现
    """
    __tablename__ = 'game_players'
    id = db.Column(db.Integer, primary_key=True)
    game_id = db.Column(db.Integer, db.ForeignKey('game_records.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    
    # 对局表现
    final_score = db.Column(db.Integer, default=0)  # 最终得分
    elo_change = db.Column(db.Integer, default=0)   # ELO 变化
    is_winner = db.Column(db.Boolean, default=False)
    
    # 详细数据
    is_self_draw = db.Column(db.Boolean, default=False)   # 是否自摸胡
    is_discard_loss = db.Column(db.Boolean, default=False)  # 是否放炮
    is_qingyise = db.Column(db.Boolean, default=False)    # 是否清一色
    is_qidui = db.Column(db.Boolean, default=False)       # 是否七对
    gang_count = db.Column(db.Integer, default=0)         # 杠数
    
    # 关系
    game = db.relationship('GameRecord', backref='players')
    user = db.relationship('User', backref='game_history')
    
    def to_dict(self):
        return {
            "game_id": self.game_id,
            "user_id": self.user_id,
            "final_score": self.final_score,
            "elo_change": self.elo_change,
            "is_winner": self.is_winner,
            "is_self_draw": self.is_self_draw,
            "is_discard_loss": self.is_discard_loss,
            "is_qingyise": self.is_qingyise,
            "is_qidui": self.is_qidui,
            "gang_count": self.gang_count
        }
