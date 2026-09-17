import { Server } from "socket.io";

let io: Server | null = null;

export function setIO(instance: Server) {
  io = instance;
}

// Un solo evento genérico a propósito: el socket nunca manda datos, solo
// avisa "algo cambió" — el cliente sigue pidiendo los datos reales por
// HTTP con su propio token. Esto evita tener que replicar la lógica de
// permisos/autorización dentro del socket.
export function broadcastTablesChanged() {
  console.log("[socket] emitiendo tables:changed a", io?.engine.clientsCount ?? 0, "clientes conectados");
  io?.emit("tables:changed");
}
