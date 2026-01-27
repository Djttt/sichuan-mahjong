"""
数据库迁移脚本
从旧的 user_stats 结构迁移到新的增强版结构

使用方法:
    cd backend
    python migrate_db.py

注意: 请在运行前备份数据库!
"""

import os
import sqlite3
import shutil
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(__file__), 'instance', 'mahjong.db')
BACKUP_PATH = os.path.join(os.path.dirname(__file__), 'instance', f'mahjong_backup_{datetime.now().strftime("%Y%m%d_%H%M%S")}.db')


def backup_database():
    """备份数据库"""
    if os.path.exists(DB_PATH):
        shutil.copy(DB_PATH, BACKUP_PATH)
        print(f"✅ 数据库已备份到: {BACKUP_PATH}")
    else:
        print("⚠️  数据库文件不存在，将创建新数据库")


def get_table_columns(cursor, table_name):
    """获取表的所有列名"""
    cursor.execute(f"PRAGMA table_info({table_name})")
    return [row[1] for row in cursor.fetchall()]


def migrate():
    """执行数据库迁移"""
    backup_database()
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        # === 检查并更新 user_stats 表 ===
        print("\n📊 检查 user_stats 表...")
        
        existing_columns = get_table_columns(cursor, 'user_stats')
        print(f"   现有列: {existing_columns}")
        
        # 需要添加的新列及其默认值
        # 注意: SQLite 不支持 ALTER TABLE 时使用非常量默认值 (如 CURRENT_TIMESTAMP)
        new_columns = {
            'elo_score': 'INTEGER DEFAULT 1000',
            'max_elo': 'INTEGER DEFAULT 1000',
            'min_elo': 'INTEGER DEFAULT 1000',
            'total_games': 'INTEGER DEFAULT 0',
            'self_draw_count': 'INTEGER DEFAULT 0',
            'discard_loss_count': 'INTEGER DEFAULT 0',
            'qingyise_count': 'INTEGER DEFAULT 0',
            'qidui_count': 'INTEGER DEFAULT 0',
            'gang_count': 'INTEGER DEFAULT 0',
            'current_streak': 'INTEGER DEFAULT 0',
            'max_winning_streak': 'INTEGER DEFAULT 0',
            'max_losing_streak': 'INTEGER DEFAULT 0',
            'replenish_count': 'INTEGER DEFAULT 0',
            'last_replenish_at': 'DATETIME',  # 允许 NULL
            'updated_at': 'DATETIME',  # 允许 NULL，SQLite 不支持非常量默认值
        }
        
        for col_name, col_type in new_columns.items():
            if col_name not in existing_columns:
                print(f"   添加列: {col_name}")
                cursor.execute(f"ALTER TABLE user_stats ADD COLUMN {col_name} {col_type}")
        
        # 迁移旧数据
        # 如果存在 rank_score 但没有 elo_score 的值，进行迁移
        if 'rank_score' in existing_columns:
            print("   迁移 rank_score -> elo_score...")
            cursor.execute("""
                UPDATE user_stats 
                SET elo_score = rank_score, 
                    max_elo = rank_score, 
                    min_elo = rank_score 
                WHERE elo_score IS NULL OR elo_score = 1000
            """)
        
        # 如果存在 games_played 但没有 total_games 的值，进行迁移
        if 'games_played' in existing_columns:
            print("   迁移 games_played -> total_games...")
            cursor.execute("""
                UPDATE user_stats 
                SET total_games = games_played 
                WHERE total_games IS NULL OR total_games = 0
            """)
        
        # === 创建 elo_replenish_logs 表 ===
        print("\n📝 检查 elo_replenish_logs 表...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS elo_replenish_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                before_elo INTEGER NOT NULL,
                after_elo INTEGER DEFAULT 1000,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        """)
        print("   ✅ elo_replenish_logs 表已就绪")
        
        # === 更新 game_records 表 ===
        print("\n🎮 检查 game_records 表...")
        game_record_cols = get_table_columns(cursor, 'game_records')
        
        if 'game_type' not in game_record_cols:
            print("   添加列: game_type")
            cursor.execute("ALTER TABLE game_records ADD COLUMN game_type VARCHAR(20) DEFAULT 'normal'")
        
        # === 创建 game_players 表 ===
        print("\n👥 检查 game_players 表...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS game_players (
                id INTEGER PRIMARY KEY,
                game_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                final_score INTEGER DEFAULT 0,
                elo_change INTEGER DEFAULT 0,
                is_winner BOOLEAN DEFAULT 0,
                is_self_draw BOOLEAN DEFAULT 0,
                is_discard_loss BOOLEAN DEFAULT 0,
                is_qingyise BOOLEAN DEFAULT 0,
                is_qidui BOOLEAN DEFAULT 0,
                gang_count INTEGER DEFAULT 0,
                FOREIGN KEY (game_id) REFERENCES game_records(id),
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        """)
        print("   ✅ game_players 表已就绪")
        
        # 提交更改
        conn.commit()
        print("\n✅ 数据库迁移完成!")
        
        # 打印统计信息
        cursor.execute("SELECT COUNT(*) FROM users")
        user_count = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM user_stats")
        stats_count = cursor.fetchone()[0]
        
        print(f"\n📊 数据库统计:")
        print(f"   用户数: {user_count}")
        print(f"   统计记录数: {stats_count}")
        
    except Exception as e:
        conn.rollback()
        print(f"\n❌ 迁移失败: {e}")
        print(f"   请从备份恢复: {BACKUP_PATH}")
        raise
    finally:
        conn.close()


if __name__ == '__main__':
    print("=" * 50)
    print("四川麻将 - 数据库迁移工具")
    print("=" * 50)
    migrate()
