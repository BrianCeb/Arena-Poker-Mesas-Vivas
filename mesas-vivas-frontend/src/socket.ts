import { io } from "socket.io-client";

export const socket = io("http://localhost:3000", {
  autoConnect: true,
});

// Logs temporales de diagnóstico — los sacamos una vez que confirmemos
// que el tiempo real funciona bien.
socket.on("connect", () => console.log("[socket] conectado, id:", socket.id));
socket.on("disconnect", (reason) => console.log("[socket] desconectado:", reason));
socket.on("connect_error", (err) => console.log("[socket] error de conexión:", err.message));
