# 四川麻将积分系统设计文档

## 概述

这是一套为局域网娱乐型麻将设计的长期积分系统，特点是**不容易被刷分**、**多维度展示**、**支持补分机制**。

## 核心规则

### 1. ELO 积分系统
- 初始分：1000
- K 因子：32（每局变化幅度）
- 胜者获得 +32/胜者数，败者扣除 -32/败者数

### 2. 补分机制 ⭐

当积分 <= 0 时，可以申请补分：

| 规则 | 说明 |
|------|------|
| 触发条件 | `elo_score <= 0` |
| 补分目标 | 恢复到 1000 |
| 冷却时间 | 24 小时 |
| 记录 | 补分次数永久记录 |

**为什么不自动补分？**
- 避免无成本刷分
- 补分次数是"耻辱标记"，会影响排名

### 3. 排行榜设计

#### 🏆 竞技榜（主榜）
```
排序规则：
1. elo_score DESC
2. total_games DESC  
3. replenish_count ASC  ← 补分多的排后面

准入条件：total_games >= 10
```

#### 🔥 肝帝榜
```
排序规则：total_games DESC
```

#### 🀄 牌型榜
- 清一色王
- 七对狂魔
- 自摸王
- 杠神
- 放炮之王 😈

#### 😅 娱乐榜
- 最大负分
- 最高连败
- 补分大户

## 数据结构

### user_stats 表
```sql
CREATE TABLE user_stats (
    user_id              INTEGER PRIMARY KEY,
    
    -- ELO 积分
    elo_score            INTEGER DEFAULT 1000,
    max_elo              INTEGER DEFAULT 1000,
    min_elo              INTEGER DEFAULT 1000,

    -- 对局统计
    total_games          INTEGER DEFAULT 0,
    wins                 INTEGER DEFAULT 0,

    -- 行为统计
    self_draw_count      INTEGER DEFAULT 0,   -- 自摸
    discard_loss_count   INTEGER DEFAULT 0,   -- 放炮

    -- 四川麻将特色
    qingyise_count       INTEGER DEFAULT 0,   -- 清一色
    qidui_count          INTEGER DEFAULT 0,   -- 七对
    gang_count           INTEGER DEFAULT 0,   -- 杠

    -- 连胜连败
    current_streak       INTEGER DEFAULT 0,   -- 当前连胜(+)/连败(-)
    max_winning_streak   INTEGER DEFAULT 0,
    max_losing_streak    INTEGER DEFAULT 0,

    -- 补分
    replenish_count      INTEGER DEFAULT 0,
    last_replenish_at    DATETIME,

    updated_at           DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### elo_replenish_logs 表
```sql
CREATE TABLE elo_replenish_logs (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER,
    before_elo INTEGER,
    after_elo  INTEGER,
    at         DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### game_players 表
```sql
CREATE TABLE game_players (
    id              INTEGER PRIMARY KEY,
    game_id         INTEGER,
    user_id         INTEGER,
    final_score     INTEGER,
    elo_change      INTEGER,
    is_winner       BOOLEAN,
    is_self_draw    BOOLEAN,
    is_discard_loss BOOLEAN,
    is_qingyise     BOOLEAN,
    is_qidui        BOOLEAN,
    gang_count      INTEGER,
    FOREIGN KEY (game_id) REFERENCES game_records(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

## API 接口

### 排行榜
- `GET /api/leaderboard` - 竞技榜（主榜）
- `GET /api/leaderboard/games` - 肝帝榜
- `GET /api/leaderboard/special` - 牌型榜
- `GET /api/leaderboard/fun` - 娱乐榜

### 用户相关
- `GET /api/user/<user_id>/stats` - 获取用户完整统计
- `GET /api/user/<user_id>/can-replenish` - 检查是否可以补分
- `POST /api/user/<user_id>/replenish` - 执行补分

### 对局结算
```
POST /api/game/settle
Content-Type: application/json

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
```

## UI 展示

### 排行榜行信息
```
玩家名 | ELO | 胜率 | 对局数 | 补分 | 自摸 | 放炮
```

### 用户个人资料
- ELO 分数（当前/最高/最低）
- 对局统计（总数/胜场/胜率）
- 连胜连败记录
- 四川麻将特色统计（自摸/放炮/清一色/七对/杠）
- 补分按钮（带冷却提示）

## 数据库迁移

如果从旧版本升级，运行：

```bash
cd backend
source venv/bin/activate
python migrate_db.py
```

迁移脚本会：
1. 自动备份数据库
2. 添加新字段
3. 迁移旧数据（rank_score → elo_score, games_played → total_games）
4. 创建新表

## 防刷分设计

1. **主榜最低局数限制** - total_games >= 10 才进主榜
2. **补分次数可见** - UI 直接显示「补分 x 次」
3. **补分冷却** - 24 小时最多补一次
4. **多榜分离** - 竞技榜和娱乐榜分开

## 文件结构

```
backend/
├── app.py           # Flask 应用和 API 路由
├── models.py        # 数据库模型
├── migrate_db.py    # 数据库迁移脚本
└── instance/
    └── mahjong.db   # SQLite 数据库

components/
├── Leaderboard.tsx  # 多 Tab 排行榜组件
└── UserProfile.tsx  # 用户个人资料组件
```

## 未来扩展

- [ ] 赛季系统（每月/每季重置）
- [ ] 成就系统（基于行为数据）
- [ ] 对局回放
- [ ] 详细对局历史
