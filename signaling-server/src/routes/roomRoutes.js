import express from "express";
import { v4 as uuidv4 } from "uuid";

import { query } from "../config/db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = express.Router();

router.post("/rooms", requireAuth, requireRole("instructor"), async (req, res) => {
  try {
    const roomId = uuidv4().slice(0, 8);
    const result = await query(
      `INSERT INTO rooms (id, instructor_id)
       VALUES ($1, $2)
       RETURNING id, instructor_id, created_at`,
      [roomId, req.user.id]
    );

    return res.status(201).json({ room: result.rows[0] });
  } catch (error) {
    return res.status(500).json({ error: "Failed to create room", details: error.message });
  }
});

router.get("/rooms/:roomId", requireAuth, async (req, res) => {
  try {
    const { roomId } = req.params;
    const room = await query("SELECT id, instructor_id, created_at FROM rooms WHERE id = $1", [roomId]);
    if (room.rowCount === 0) {
      return res.status(404).json({ error: "Room not found" });
    }

    return res.json({ room: room.rows[0] });
  } catch (error) {
    return res.status(500).json({ error: "Failed to fetch room", details: error.message });
  }
});

export default router;
