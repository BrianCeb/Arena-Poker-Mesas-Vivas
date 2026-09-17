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
import { setIO } from "./lib/realtime";

dotenv.config();
const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
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

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });
setIO(io);

httpServer.listen(port, () => {
  console.log(`Mesas Vivas backend escuchando en http://localhost:${port}`);
});