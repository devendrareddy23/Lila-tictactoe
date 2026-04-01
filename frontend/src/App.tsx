import { useEffect, useState } from "react";
import * as Nakama from "@heroiclabs/nakama-js";
import "./App.css";

type Cell = "" | "X" | "O";

type GameState = {
  board: Cell[];
  turn: "X" | "O";
  winner: "" | "X" | "O" | "draw";
};

const client = new Nakama.Client("supersecretlilakey", "127.0.0.1", "7350", false);

function emptyBoard(): Cell[] {
  return ["", "", "", "", "", "", "", "", ""];
}

export default function App() {
  const [nickname, setNickname] = useState("");
  const [status, setStatus] = useState("Disconnected");
  const [errorText, setErrorText] = useState("");
  const [session, setSession] = useState<Nakama.Session | null>(null);
  const [socket, setSocket] = useState<Nakama.Socket | null>(null);

  const [matchIdInput, setMatchIdInput] = useState("");
  const [currentMatchId, setCurrentMatchId] = useState("");
  const [mySymbol, setMySymbol] = useState<"" | "X" | "O">("");
  const [playerCount, setPlayerCount] = useState(0);

  const [gameState, setGameState] = useState<GameState>({
    board: emptyBoard(),
    turn: "X",
    winner: "",
  });

  useEffect(() => {
    return () => {
      if (socket) {
        socket.disconnect(false);
      }
    };
  }, [socket]);

  function resetMatchUi() {
    setCurrentMatchId("");
    setMatchIdInput("");
    setMySymbol("");
    setPlayerCount(0);
    setGameState({
      board: emptyBoard(),
      turn: "X",
      winner: "",
    });
  }

  function formatError(error: any) {
    if (!error) return "Unknown error";
    if (typeof error === "string") return error;
    if (error.message) return error.message;
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }

  async function connectUser() {
    try {
      setErrorText("");
      setStatus("Connecting...");

      const cleanName = nickname.trim() || "Guest";
      const deviceId = "dev-" + cleanName + "-" + Date.now();

      const newSession = await client.authenticateDevice(deviceId, true, cleanName);
      const newSocket = client.createSocket();
      await newSocket.connect(newSession, true);

      newSocket.onmatchdata = (message: any) => {
        try {
          const decoded = new TextDecoder().decode(message.data);
          const payload = JSON.parse(decoded);

          if (payload.type === "state") {
            setGameState({
              board: payload.board || emptyBoard(),
              turn: payload.turn || "X",
              winner: payload.winner || "",
            });

            if (payload.players && newSession.user_id) {
              const assigned = payload.players[newSession.user_id];
              if (assigned === "X" || assigned === "O") {
                setMySymbol(assigned);
              } else {
                setMySymbol("");
              }
              setPlayerCount(Object.keys(payload.players).length);
            }
          }
        } catch (err) {
          console.error("Failed to parse match data", err);
        }
      };

      newSocket.onmatchpresence = (event: any) => {
        console.log("Presence event:", event);
      };

      setSession(newSession);
      setSocket(newSocket);
      setStatus("Connected");
      resetMatchUi();
    } catch (error) {
      console.error("CONNECT ERROR:", error);
      setErrorText(formatError(error));
      setStatus("Connection failed");
    }
  }

  async function createMatch() {
    if (!socket) {
      alert("Connect first");
      return;
    }

    try {
      setErrorText("");
      setStatus("Creating match...");
      resetMatchUi();

      const rpc = await socket.rpc("create_match");
      const response = JSON.parse(rpc.payload || "{}");
      const matchId = response.matchId;

      if (!matchId) {
        throw new Error("No matchId returned from create_match RPC");
      }

      await socket.joinMatch(matchId);

      setCurrentMatchId(matchId);
      setMatchIdInput(matchId);
      setStatus("Match created and joined");
    } catch (error) {
      console.error("CREATE MATCH ERROR:", error);
      setErrorText(formatError(error));
      setStatus("Failed to create match");
    }
  }

  async function joinMatch() {
    if (!socket) {
      alert("Connect first");
      return;
    }

    if (!matchIdInput.trim()) {
      alert("Enter match ID");
      return;
    }

    try {
      setErrorText("");
      setStatus("Joining match...");
      resetMatchUi();

      const match = await socket.joinMatch(matchIdInput.trim());

      setCurrentMatchId(match.match_id);
      setMatchIdInput(match.match_id);
      setStatus("Joined match");
    } catch (error) {
      console.error("JOIN MATCH ERROR:", error);
      setErrorText(formatError(error));
      setStatus("Failed to join match");
    }
  }

  async function sendMove(index: number) {
    if (!socket || !currentMatchId) return;
    if (!mySymbol) return;
    if (playerCount < 2) return;
    if (gameState.winner) return;
    if (gameState.board[index] !== "") return;
    if (gameState.turn !== mySymbol) return;

    try {
      setErrorText("");
      const payload = new TextEncoder().encode(JSON.stringify({ index }));
      await socket.sendMatchState(currentMatchId, 1, payload);
    } catch (error) {
      console.error("SEND MOVE ERROR:", error);
      setErrorText(formatError(error));
    }
  }

  function leaveMatch() {
    resetMatchUi();
    setStatus("Connected");
  }

  async function disconnectUser() {
    try {
      if (socket) {
        await socket.disconnect(false);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setSocket(null);
      setSession(null);
      resetMatchUi();
      setStatus("Disconnected");
      setErrorText("");
    }
  }

  function bannerText() {
    if (!currentMatchId) return "Create or join a match to start";
    if (gameState.winner === "draw") return "Game ended in a draw";
    if (gameState.winner === "X" || gameState.winner === "O") return "Winner: " + gameState.winner;
    if (!mySymbol) return "Join a match to get your symbol";
    if (playerCount < 2) return "Waiting for second player...";
    if (gameState.turn === mySymbol) return "Your turn";
    return "Opponent's turn";
  }

  return (
    <div className="app">
      <div className="card">
        <h1>Lila Tic-Tac-Toe</h1>
        <p className="subtitle">Authoritative Nakama Multiplayer</p>

        <div className="section">
          <label>Nickname</label>
          <input
            type="text"
            placeholder="Enter nickname"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
          />

          <button onClick={connectUser} disabled={!!socket}>
            {socket ? "Connected" : "Connect"}
          </button>

          {socket && (
            <button className="secondary-btn" onClick={disconnectUser}>
              Disconnect
            </button>
          )}

          <p className="status">Status: {status}</p>
          <p className="status">Session: {session ? "Created" : "Not created"}</p>

          {errorText && (
            <div className="error-box">
              <strong>Exact Error</strong>
              <pre>{errorText}</pre>
            </div>
          )}
        </div>

        <div className="section">
          <button onClick={createMatch} disabled={!socket}>
            Create Match
          </button>
        </div>

        <div className="section">
          <input
            type="text"
            placeholder="Paste match ID"
            value={matchIdInput}
            onChange={(e) => setMatchIdInput(e.target.value)}
          />
          <button onClick={joinMatch} disabled={!socket}>
            Join Match
          </button>
        </div>

        {currentMatchId && (
          <div className="section">
            <button className="secondary-btn" onClick={leaveMatch}>
              Leave Match
            </button>
          </div>
        )}

        <div className="section info">
          <p><strong>Match ID:</strong> {currentMatchId || "Not joined yet"}</p>
          <p><strong>Your Symbol:</strong> {mySymbol || "-"}</p>
          <p><strong>Players:</strong> {playerCount}</p>
          <p><strong>Current Turn:</strong> {gameState.turn}</p>
          <p><strong>Winner:</strong> {gameState.winner || "-"}</p>
        </div>

        <div className="banner">{bannerText()}</div>

        <div className="board">
          {gameState.board.map((cell, index) => (
            <button
              key={index}
              className="cell"
              onClick={() => sendMove(index)}
              disabled={
                !socket ||
                !currentMatchId ||
                !mySymbol ||
                playerCount < 2 ||
                !!gameState.winner ||
                gameState.board[index] !== "" ||
                gameState.turn !== mySymbol
              }
            >
              {cell}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
