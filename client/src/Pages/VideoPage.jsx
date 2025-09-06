import React, { useRef, useState, useEffect } from "react";
import { io } from "socket.io-client";

// Import the shadcn components you added
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// const socket = io(import.meta.env.VITE_SERVER_URL || "https://localhost:3000");
const socket = io("https://10.233.154.149:5173/");

const VideoPage = () => {
  const [roomId, setRoomId] = useState("");
  const [joinRoomId, setJoinRoomId] = useState("");
  const [users, setUsers] = useState([]);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [incomingCall, setIncomingCall] = useState(null);
  const [callPartner, setCallPartner] = useState(null);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnectionRef = useRef(null);

  // --- SOCKET EVENT LISTENERS ---
  useEffect(() => {
    socket.on("connect", () => {
      console.log("✅ Socket connected!", socket.id);
    });

    socket.on("connect_error", (err) => {
      console.error("❌ Socket connection error:", err.message);
    });
    socket.on("update-users", (users) => {
      setUsers(users.filter((user) => user.id !== socket.id));
    });

    socket.on("incoming-call", (data) =>
      setIncomingCall({ from: data.from, offer: data.offer })
    );

    socket.on("call-finalized", async (data) => {
      if (peerConnectionRef.current)
        await peerConnectionRef.current.setRemoteDescription(data.answer);
    });

    socket.on("ice-candidate", (data) => {
      if (peerConnectionRef.current)
        peerConnectionRef.current.addIceCandidate(data.candidate);
    });

    socket.on("call-ended", () => {
      if (peerConnectionRef.current) peerConnectionRef.current.close();
      peerConnectionRef.current = null;
      setRemoteStream(null);
      setCallPartner(null);
    });

    socket.on("user-unavailable", ({ targetId }) =>
      alert(`User ${targetId.substring(0, 5)}... is in another call.`)
    );

    return () => {
      socket.off("connect");
      socket.off("connect_error");
      socket.off("update-users");
      socket.off("incoming-call");
      socket.off("call-finalized");
      socket.off("ice-candidate");
      socket.off("call-ended");
      socket.off("user-unavailable");
    };
  }, []);

  // --- MEDIA STREAM EFFECTS ---
  useEffect(() => {
    if (localVideoRef.current && localStream)
      localVideoRef.current.srcObject = localStream;
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream)
      remoteVideoRef.current.srcObject = remoteStream;
  }, [remoteStream]);

  // --- CORE WEBTRC & APP LOGIC ---
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

  function setupPeerConnection(targetId) {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });
    pc.onicecandidate = (event) => {
      if (event.candidate)
        socket.emit("ice-candidate", {
          target: targetId,
          candidate: event.candidate,
        });
    };
    pc.ontrack = (event) => setRemoteStream(new MediaStream([event.track]));
    localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));
    peerConnectionRef.current = pc;
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
        if (success) setRoomId(joinRoomId);
        else alert("Room not found.");
      });
    }
  }

  async function handleCallUser(targetId) {
    setupPeerConnection(targetId);
    const offer = await peerConnectionRef.current.createOffer();
    await peerConnectionRef.current.setLocalDescription(offer);
    socket.emit("call-user", { target: targetId, offer: offer });
    setCallPartner(targetId);
  }

  async function handleAnswerCall() {
    if (!incomingCall) return;
    setupPeerConnection(incomingCall.from);
    await peerConnectionRef.current.setRemoteDescription(incomingCall.offer);
    const answer = await peerConnectionRef.current.createAnswer();
    await peerConnectionRef.current.setLocalDescription(answer);
    socket.emit("call-accepted", { to: incomingCall.from, answer: answer });
    setCallPartner(incomingCall.from);
    setIncomingCall(null);
  }

  function handleHangUp() {
    if (peerConnectionRef.current) peerConnectionRef.current.close();
    socket.emit("hang-up", { to: callPartner });
    peerConnectionRef.current = null;
    setRemoteStream(null);
    setCallPartner(null);
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <div className="w-3/4 flex flex-col items-center justify-center p-6">
        <h1 className="text-4xl font-bold mb-4">StreamSync</h1>
        {roomId && <p className="text-gray-500 mb-4">Room ID: {roomId}</p>}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-5xl">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full border-2 rounded-lg bg-black"
          />
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full border-2 rounded-lg bg-black"
          />
        </div>

        <div className="mt-6 space-x-4">
          {!localStream && <Button onClick={startCamera}>Start Camera</Button>}
          {remoteStream && (
            <Button variant="destructive" onClick={handleHangUp}>
              Hang Up
            </Button>
          )}
        </div>

        {!roomId && (
          <Card className="w-full max-w-sm mt-8">
            <CardHeader>
              <CardTitle>Join a Room</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <Button onClick={handleCreateRoom} variant="outline">
                Create New Room
              </Button>
              <div className="flex items-center gap-2">
                <Input
                  type="text"
                  value={joinRoomId}
                  onChange={(e) => setJoinRoomId(e.target.value)}
                  placeholder="Enter Room ID"
                />
                <Button onClick={handleJoinRoom}>Join Room</Button>
              </div>
            </CardContent>
          </Card>
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
              <span>
                {user.id.substring(0, 5)}... ({user.status})
              </span>
              <Button
                onClick={() => handleCallUser(user.id)}
                size="sm"
                disabled={user.status === "in-call"}
              >
                Call
              </Button>
            </li>
          ))}
        </ul>
      </div>

      {incomingCall && (
        <Card className="absolute top-5 left-1/2 -translate-x-1/2 shadow-lg animate-pulse">
          <CardHeader>
            <CardTitle>Incoming Call</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            <p>{incomingCall.from.substring(0, 5)}... is calling.</p>
            <Button onClick={handleAnswerCall}>Answer</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default VideoPage;
