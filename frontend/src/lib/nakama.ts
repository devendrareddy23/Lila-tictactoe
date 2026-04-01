import { Client, Session, Socket } from "@heroiclabs/nakama-js";

const client = new Client("supersecretlilakey", "127.0.0.1", "7350", false);

let socket: Socket | null = null;
let session: Session | null = null;

export async function loginWithDevice(username: string) {
  const deviceId = "device-" + Math.random().toString(36).substring(2, 15);
  session = await client.authenticateDevice(deviceId, true, username);
  return session;
}

export async function connectSocket() {
  if (!session) {
    throw new Error("No session. Login first.");
  }

  if (socket) {
    return socket;
  }

  socket = client.createSocket(false, false);
  await socket.connect(session, true);
  return socket;
}

export async function createAuthoritativeMatch() {
  if (!session) {
    throw new Error("No session. Login first.");
  }

  const response = await client.rpc(session, "create_match");
  const data = JSON.parse(response.payload);
  return data.matchId as string;
}

export async function joinAuthoritativeMatch(matchId: string) {
  const activeSocket = await connectSocket();
  return activeSocket.joinMatch(matchId);
}

export async function sendMove(row: number, col: number) {
  if (!socket) {
    throw new Error("Socket not connected.");
  }

  await socket.sendMatchState(2, { row, col });
}

export function getSocket() {
  if (!socket) {
    throw new Error("Socket not connected.");
  }

  return socket;
}
