from __future__ import annotations

import json
from typing import Dict, Set

from flask import Flask, jsonify
from flask_sock import Sock

app = Flask(__name__)
app.config["JSON_AS_ASCII"] = False
sock = Sock(app)

rooms: Dict[str, Set] = {}
conn_rooms: Dict[object, str] = {}


def _broadcast(room_id: str, payload: str) -> None:
    connections = rooms.get(room_id, set())
    if not connections:
        return
    dead = []
    for ws in list(connections):
        try:
            ws.send(payload)
        except Exception:
            dead.append(ws)
    for ws in dead:
        connections.discard(ws)
    if not connections:
        rooms.pop(room_id, None)


@app.get("/health")
def health():
    return jsonify({"status": "ok"})


@sock.route("/ws")
def ws_handler(ws):
    while True:
        data = ws.receive()
        if data is None:
            break

        try:
            message = json.loads(data)
        except json.JSONDecodeError:
            continue

        room_id = message.get("roomId")
        if not room_id:
            continue

        rooms.setdefault(room_id, set()).add(ws)
        conn_rooms[ws] = room_id

        _broadcast(room_id, json.dumps(message))

    room_id = conn_rooms.pop(ws, None)
    if room_id and room_id in rooms:
        rooms[room_id].discard(ws)
        if not rooms[room_id]:
            rooms.pop(room_id, None)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=6001)
