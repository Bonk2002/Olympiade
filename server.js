import express from "express";
import { Buffer } from "node:buffer";
import crypto from "node:crypto";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;
const distPath = path.join(__dirname, "dist");
const indexPath = path.join(distPath, "index.html");

const DEFAULT_ROOM = "default";
const rooms = new Map();

function normalizeRoomSlug(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 32)
    .replace(/-$/g, "");
}

function roomName(value) {
  const room = normalizeRoomSlug(value);
  return room.length >= 2 ? room : "";
}

function getRoom(room, create = false) {
  const normalizedRoom = roomName(room);
  if (!normalizedRoom) return null;

  if (!rooms.has(normalizedRoom) && create) {
    rooms.set(normalizedRoom, {
      state: null,
      updatedAt: null,
      passwordHash: "",
      passwordSalt: "",
      hostKey: "",
    });
  }

  return rooms.get(normalizedRoom) ?? null;
}

function hostKeyFromRequest(request) {
  return String(request.get("x-host-key") || request.body?.hostKey || "").trim();
}

function createHostKey() {
  return crypto.randomBytes(24).toString("hex");
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto
    .createHash("sha256")
    .update(`${salt}:${password}`)
    .digest("hex");

  return { hash, salt };
}

function passwordMatches(password, record) {
  if (!record?.passwordHash || !record?.passwordSalt) return false;
  const { hash } = hashPassword(password, record.passwordSalt);
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(record.passwordHash));
}

function claimRoomHost(request, response, room) {
  const normalizedRoom = roomName(room);
  if (!normalizedRoom) {
    response.status(400).json({ error: "Invalid room." });
    return;
  }

  const password = String(request.body?.password ?? "");
  if (!password.trim()) {
    response.status(400).json({ error: "Host password required." });
    return;
  }

  const record = getRoom(normalizedRoom, true);

  if (!record.passwordHash) {
    const { hash, salt } = hashPassword(password);
    record.passwordHash = hash;
    record.passwordSalt = salt;
    record.hostKey = createHostKey();
    record.updatedAt = record.updatedAt ?? Date.now();

    response.json({ room: normalizedRoom, hostKey: record.hostKey });
    return;
  }

  if (!passwordMatches(password, record)) {
    response.status(403).json({ error: "Wrong host password." });
    return;
  }

  if (!record.hostKey) {
    record.hostKey = createHostKey();
  }

  response.json({ room: normalizedRoom, hostKey: record.hostKey });
}

function authorizeRoomWrite(request, response, room, requireHostKey) {
  const normalizedRoom = roomName(room);
  if (!normalizedRoom) {
    response.status(400).json({ error: "Invalid room." });
    return null;
  }

  const record = getRoom(normalizedRoom, !requireHostKey);
  if (!requireHostKey) return { room: normalizedRoom, record };

  if (!record?.passwordHash || !record.hostKey) {
    response.status(403).json({ error: "Host access has not been claimed." });
    return null;
  }

  const hostKey = hostKeyFromRequest(request);
  if (!hostKey) {
    response.status(403).json({ error: "Host key required." });
    return null;
  }

  if (record.hostKey !== hostKey) {
    response.status(403).json({ error: "Room is controlled by another host." });
    return null;
  }

  return { room: normalizedRoom, record };
}

function readRoomState(request, response, room) {
  const normalizedRoom = roomName(room);
  if (!normalizedRoom) {
    response.status(400).json({ error: "Invalid room." });
    return;
  }

  const record = getRoom(normalizedRoom);
  response.json({
    room: normalizedRoom,
    state: record?.state ?? null,
    updatedAt: record?.updatedAt ?? null,
  });
}

function writeRoomState(request, response, room, requireHostKey = true) {
  const authorized = authorizeRoomWrite(request, response, room, requireHostKey);
  if (!authorized) return;

  authorized.record.state = Object.prototype.hasOwnProperty.call(request.body ?? {}, "state")
    ? request.body.state
    : null;
  authorized.record.updatedAt = Date.now();

  response.json({
    room: authorized.room,
    state: authorized.record.state,
    updatedAt: authorized.record.updatedAt,
  });
}

function deleteRoomState(request, response, room, requireHostKey = true) {
  const authorized = authorizeRoomWrite(request, response, room, requireHostKey);
  if (!authorized) return;

  authorized.record.state = null;
  authorized.record.updatedAt = Date.now();

  response.json({
    room: authorized.room,
    state: null,
    updatedAt: authorized.record.updatedAt,
  });
}

function readRoomMeta(request, response, room) {
  const normalizedRoom = roomName(room);
  if (!normalizedRoom) {
    response.status(400).json({ error: "Invalid room." });
    return;
  }

  const record = getRoom(normalizedRoom);
  response.json({
    room: normalizedRoom,
    exists: Boolean(record),
    hasState: Boolean(record?.state),
    hostProtected: Boolean(record?.passwordHash),
    updatedAt: record?.updatedAt ?? null,
  });
}

app.use(express.json({ limit: "2mb" }));

app.get("/api/tournament-state", (request, response) => {
  readRoomState(request, response, DEFAULT_ROOM);
});

app.post("/api/tournament-state", (request, response) => {
  writeRoomState(request, response, DEFAULT_ROOM, false);
});

app.delete("/api/tournament-state", (request, response) => {
  deleteRoomState(request, response, DEFAULT_ROOM, false);
});

app.get("/api/rooms/:room/state", (request, response) => {
  readRoomState(request, response, request.params.room);
});

app.post("/api/rooms/:room/state", (request, response) => {
  writeRoomState(request, response, request.params.room);
});

app.delete("/api/rooms/:room/state", (request, response) => {
  deleteRoomState(request, response, request.params.room);
});

app.post("/api/rooms/:room/claim-host", (request, response) => {
  claimRoomHost(request, response, request.params.room);
});

app.get("/api/rooms/:room/meta", (request, response) => {
  readRoomMeta(request, response, request.params.room);
});

app.use(express.static(distPath));

app.get(/^\/(?!api).*/, (request, response) => {
  response.sendFile(indexPath);
});

app.listen(port, () => {
  console.log(`Tournament app listening on port ${port}`);
});
