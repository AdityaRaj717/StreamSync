import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import express from "express";
import https from "https";
import { Server } from "socket.io";

dotenv.config();
const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

io.on("connection", (socket) => {
  console.log(`A new user has connected ${socket.id}`);
});

app.get("/", (req, res) => {
  res.send("<h1>Hello world</h1>");
});

server.listen(PORT, () => console.log(`Server is listening on PORT: ${PORT}`));
