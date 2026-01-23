

# Sichuan Mahjong UI

A high-fidelity web implementation of Sichuan Mahjong (Bloody Battle) with Dingque mechanics, fluid animations, and a Python backend for real-time multiplayer support.

## 项目简介

本项目实现了四川麻将（血战到底）前端界面，支持定缺、实时分数提示、玩家头像、牌面动画等功能。后端基于 Flask + WebSocket，支持多人在线对局。

## 主要特性

- 四川麻将血战到底玩法
- 定缺操作面板
- 玩家头像与分数提示
- 牌面与吃碰杠胡动画
- 前后端分离，WebSocket 实时通信

## 技术栈

- 前端：React 19, TypeScript, Vite
- 后端：Python, Flask, flask_sock

## 快速开始

### 前置条件

- Node.js (建议 18+)
- Python 3.8+

### 安装与运行

1. 安装前端依赖：
   ```bash
   npm install
   ```
2. 创建 Python 虚拟环境并安装后端依赖：
   ```bash
   python -m venv venv
   source venv/bin/activate
   pip install -r backend/requirements.txt
   ```
3. 启动后端服务（WebSocket 服务器）：
   ```bash
   python backend/app.py
   ```
4. 启动前端开发服务器：
   ```bash
   npm run dev
   ```

前端默认运行在 http://localhost:5173 ，后端接口在 http://localhost:5000。

## 目录结构

- App.tsx, index.tsx, types.ts, constants.ts: 前端主入口与类型定义
- components/: React 组件（定缺、玩家头像、牌面等）
- services/: 游戏逻辑与服务
- backend/: Python 后端服务

## License

MIT
