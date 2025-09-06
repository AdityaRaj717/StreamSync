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
    origin: ["https://localhost:5173", process.env.VITE_SERVER_URL],
    methods: ["GET", "POST"],
  },
});

const PORT = process.env.PORT || 3000;

const rooms = {};

// Helper function to find a user's room and data
function findRoomAndUser(socketId) {
  for (const roomId in rooms) {
    if (rooms[roomId].users[socketId]) {
      return { roomId, user: rooms[roomId].users[socketId] };
    }
  }
  return { roomId: null, user: null };
}

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

  socket.on("call-user", (data) => {
    const { roomId, user: targetUser } = findRoomAndUser(data.target);

    // Check if the target user is available before sending the call
    if (targetUser && targetUser.status === "available") {
      io.to(data.target).emit("incoming-call", {
        from: socket.id,
        offer: data.offer,
      });
    } else {
      // Notify the caller that the user is unavailable
      socket.emit("user-unavailable", { targetId: data.target });
    }
  });

  socket.on("call-accepted", (data) => {
    const { roomId } = findRoomAndUser(socket.id);
    if (roomId) {
      const callerId = data.to;
      const calleeId = socket.id;

      // Update status for both users
      if (rooms[roomId].users[callerId])
        rooms[roomId].users[callerId].status = "in-call";
      if (rooms[roomId].users[calleeId])
        rooms[roomId].users[calleeId].status = "in-call";

      // Relay the answer
      io.to(callerId).emit("call-finalized", {
        from: calleeId,
        answer: data.answer,
      });

      // Broadcast the updated user list with new statuses
      io.to(roomId).emit("update-users", Object.values(rooms[roomId].users));
    }
  });

  socket.on("hang-up", (data) => {
    const { roomId } = findRoomAndUser(socket.id);
    if (roomId) {
      const user1Id = socket.id;
      const user2Id = data.to;

      // Update status for both users back to available
      if (rooms[roomId].users[user1Id])
        rooms[roomId].users[user1Id].status = "available";
      if (rooms[roomId].users[user2Id])
        rooms[roomId].users[user2Id].status = "available";

      // Notify the other user that the call has ended
      io.to(user2Id).emit("call-ended");

      // Broadcast the updated user list
      io.to(roomId).emit("update-users", Object.values(rooms[roomId].users));
    }
  });

  socket.on("ice-candidate", (data) => {
    // Relay ICE candidates
    io.to(data.target).emit("ice-candidate", {
      from: socket.id,
      candidate: data.candidate,
    });
  });
});

// All the routes
app.use("/", homeRouter);

server.listen(PORT, () => console.log(`Server is listening on PORT: ${PORT}`));
