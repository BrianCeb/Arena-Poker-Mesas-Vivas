import { Server } from "socket.io";

let io: Server | null = null;

export function setIO(instance: Server) {
  io = instance;
}

export function broadcastTablesChanged() {
  io?.emit("tables:changed");
}