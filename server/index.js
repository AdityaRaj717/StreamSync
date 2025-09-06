import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { v4 as uuidv4 } from "uuid";
import express from "express";
import https from "https";
import { Server } from "socket.io";

import homeRouter from "./routes/homeRoute.js";

dotenv.config();
const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Https setup
const options = {
  key: fs.readFileSync(path.join(__dirname, "certs", "cert.key")),
  cert: fs.readFileSync(path.join(__dirname, "certs", "cert.crt")),
};

const server = https.createServer(options, app);
const io = new Server(server, {
  cors: {
    origin: "https://localhost:5173",
    methods: ["GET", "POST"],
  },
});

const PORT = process.env.PORT || 3000;

const rooms = {};

io.on("connection", (socket) => {
  console.log(`A new user has connected ${socket.id}`);

  socket.on("create-room", (callback) => {
    const roomId = uuidv4();
    socket.join(roomId);
    rooms[roomId] = {
      users: {
        [socket.id]: { id: socket.id, status: "available" },
      },
    };
    callback(roomId);
    io.to(roomId).emit("update-users", Object.values(rooms[roomId].users));
  });

  socket.on("join-room", (roomId, callback) => {
    if (rooms[roomId]) {
      socket.join(roomId);
      rooms[roomId].users[socket.id] = { id: socket.id, status: "available" };
      io.to(roomId).emit("update-users", Object.values(rooms[roomId].users));
      callback(true);
    } else {
      callback(false);
    }
  });

  socket.on("disconnecting", () => {
    const roomId = Array.from(socket.rooms).find((r) => r !== socket.id);
    if (roomId && rooms[roomId]) {
      delete rooms[roomId].users[socket.id];
      io.to(roomId).emit("update-users", Object.values(rooms[roomId].users));

      if (Object.keys(rooms[roomId].users).length === 0) {
        delete rooms[roomId];
      }
    }
  });

  socket.on("disconnect", () => {
    console.log(`User disconnected ${socket.id}`);
  });
});

// All the routes
app.use("/", homeRouter);

server.listen(PORT, () => console.log(`Server is listening on PORT: ${PORT}`));
