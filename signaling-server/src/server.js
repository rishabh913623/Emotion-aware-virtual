import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";

import authRoutes from "./routes/authRoutes.js";
import roomRoutes from "./routes/roomRoutes.js";
import { registerSocketHandlers } from "./socket/registerSocketHandlers.js";

dotenv.config();

const app = express();
const server = http.createServer(app);
const allowedOrigins = (process.env.CORS_ORIGIN || "http://localhost:5173,http://localhost:5174")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true
  })
);
app.use(express.json({ limit: "5mb" }));

app.get("/health", (_, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRoutes);
app.use("/api", roomRoutes);

app.use((error, _req, res, _next) => {
  res.status(500).json({ error: "Server error", details: error.message });
});

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"]
  }
});

registerSocketHandlers(io);

const port = Number(process.env.PORT || 4000);
server.listen(port, () => {
  console.log("Allowed CORS origins:", allowedOrigins);
  console.log(`Signaling server listening on http://localhost:${port}`);
});
