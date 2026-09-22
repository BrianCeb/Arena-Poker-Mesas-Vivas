import dns from "node:dns";
dns.setDefaultResultOrder("ipv4first");

import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";
import { createServer } from "http";
import { Server } from "socket.io";
import authRouter from "./routes/auth";
import tablesRouter from "./routes/tables";
import waitingListRouter from "./routes/waitingList";
import usersRouter from "./routes/users";
import tournamentsRouter from "./routes/tournaments";
import auditLogsRouter from "./routes/auditLogs";
import { setIO } from "./lib/realtime";

dotenv.config();
const app = express();
const port = process.env.PORT || 3000;

// En producción corremos detrás de un reverse proxy (nginx). Sin esto,
// Express ve siempre la IP del proxy (localhost) en vez de la IP real
// del visitante — rompe el rate limiting por IP (authLimiter/readLimiter)
// y el campo "ip" que se guarda en el login para auditoría. El "1" le
// dice que confíe en un solo salto de proxy (el nginx local), no en
// cualquier IP que venga en el header X-Forwarded-For.
app.set("trust proxy", 1);

// Orígenes permitidos para llamar a esta API (CORS). En desarrollo cae
// solo al puerto por defecto de Vite; en producción, definir
// FRONTEND_ORIGIN con el dominio real (con https://). Admite varios
// orígenes separados por coma si hiciera falta (ej. con y sin "www").
const allowedOrigins = (process.env.FRONTEND_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({ origin: allowedOrigins }));
app.use(express.json());
app.use((_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

// Sirve las imágenes de flyers/estructuras que suben los admins.
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});
app.use("/auth", authRouter);
app.use("/tables", tablesRouter);
app.use("/waiting-list", waitingListRouter);
app.use("/users", usersRouter);
app.use("/tournaments", tournamentsRouter);
app.use("/audit-logs", auditLogsRouter);

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: allowedOrigins } });
setIO(io);

httpServer.listen(port, () => {
  console.log(`Mesas Vivas backend escuchando en http://localhost:${port}`);
});