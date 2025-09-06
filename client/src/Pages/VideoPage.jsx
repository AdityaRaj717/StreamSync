import React, { useRef, useState, useEffect, useMemo } from "react";
import { io } from "socket.io-client";

const VideoPage = () => {
  const socket = useMemo(() => io("https://localhost:3000"), []);
  const [roomId, setRoomId] = useState("");
  const [joinRoomId, setJoinRoomId] = useState("");
  const [users, setUsers] = useState([]);
  const [localStream, setLocalStream] = useState(null);
  const localVideoRef = useRef(null);

  useEffect(() => {
    socket.on("update-users", (users) => {
      const otherUsers = users.filter((user) => user.id !== socket.id);
      setUsers(otherUsers);
    });

    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }

    return () => {
      socket.off("update-users");
    };
  }, [socket, localStream]);

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      setLocalStream(stream);
    } catch (error) {
      console.error("Error accessing media devices.", error);
    }
  }

  function handleCreateRoom() {
    socket.emit("create-room", (newRoomId) => {
      setRoomId(newRoomId);
      alert(`You have created a new room. ID: ${newRoomId}`);
    });
  }

  function handleJoinRoom() {
    if (joinRoomId) {
      socket.emit("join-room", joinRoomId, (success) => {
        if (success) {
          setRoomId(joinRoomId);
        } else {
          alert("Room not found.");
        }
      });
    }
  }

  return (
    <div className="flex h-screen">
      <div className="w-3/4 flex flex-col items-center justify-center p-4">
        <h1 className="text-2xl font-bold mb-4">StreamSync</h1>
        {roomId && <p className="mb-4">Room ID: {roomId}</p>}
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          className="w-full max-w-lg border-2 rounded mb-4"
        />

        {!localStream && (
          <button
            onClick={startCamera}
            className="border-2 p-2 rounded cursor-pointer bg-blue-500 text-white mb-4"
          >
            Start Camera
          </button>
        )}

        {!roomId && (
          <div className="flex flex-col gap-4">
            <button onClick={handleCreateRoom} className="border-2 p-2 rounded">
              Create Room
            </button>
            <div className="flex gap-2">
              <input
                type="text"
                value={joinRoomId}
                onChange={(e) => setJoinRoomId(e.target.value)}
                placeholder="Enter Room ID"
                className="border-2 p-2 rounded"
              />
              <button onClick={handleJoinRoom} className="border-2 p-2 rounded">
                Join Room
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="w-1/4 bg-gray-100 p-4 border-l-2">
        <h2 className="text-xl font-semibold mb-4">Users in Room</h2>
        <ul>
          {users.map((user) => (
            <li
              key={user.id}
              className="p-2 border-b flex justify-between items-center"
            >
              <span>{user.id.substring(0, 5)}...</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default VideoPage;
