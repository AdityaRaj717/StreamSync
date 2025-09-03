import express from "express";
import dotenv from "dotenv";
import http from "http";
import { Server } from "socket.io";

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

io.on("connection", (socket) => {
  console.log("A new user has connected");
});

app.get("/", (req, res) => {
  res.send("<h1>Hello world</h1>");
});

app.listen(PORT, () => console.log(`Server is listening on PORT: ${PORT}`));
