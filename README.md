# Lila Tic-Tac-Toe (Nakama Multiplayer)

This is a real-time multiplayer Tic-Tac-Toe game built using:

- React (Frontend)
- Nakama (Authoritative Multiplayer Server)
- Docker (Nakama + PostgreSQL)

## Features

- Create and join matches using Match ID
- Two-player multiplayer (X and O)
- Server-authoritative game logic
- Turn validation on server
- Real-time synchronization via WebSockets
- Winner and draw detection

## How to Run

### 1. Start Nakama
cd nakama
docker compose up

### 2. Start Frontend
cd frontend
npm install
npm run dev -- --host 127.0.0.1

## How to Play

1. Open two browser tabs
2. Player 1 → Connect → Create Match
3. Copy match ID
4. Player 2 → Connect → Paste ID → Join
5. Play game

## Architecture

- Clients send moves
- Server validates turn and board state
- Server broadcasts updated state to all players

This ensures authoritative multiplayer behavior.

