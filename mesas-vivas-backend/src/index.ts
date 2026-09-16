import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import authRouter from "./routes/auth";
import tablesRouter from "./routes/tables";
import waitingListRouter from "./routes/waitingList";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// En desarrollo permitimos cualquier origen — en producción esto se
// restringe al dominio real del frontend.
app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/auth", authRouter);
app.use("/tables", tablesRouter);
app.use("/waiting-list", waitingListRouter);

app.listen(port, () => {
  console.log(`Mesas Vivas backend escuchando en http://localhost:${port}`);
});