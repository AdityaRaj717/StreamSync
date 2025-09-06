import React, { useRef, useState, useEffect, useMemo } from "react";
import { io } from "socket.io-client";

const VideoPage = () => {
  const [remoteStream, setRemoteStream] = useState(null);
  const remoteVideoRef = useRef(null);
  const peerConnectionRef = useRef(null); // To hold the RTCPeerConnection instance
  const socket = useMemo(() => io("https://localhost:3000"), []);
  const [roomId, setRoomId] = useState("");
  const [joinRoomId, setJoinRoomId] = useState("");
  const [users, setUsers] = useState([]);
  const [localStream, setLocalStream] = useState(null);
  const localVideoRef = useRef(null);
  const [incomingCall, setIncomingCall] = useState(null);

  useEffect(() => {
    socket.on("update-users", (users) => {
      const otherUsers = users.filter((user) => user.id !== socket.id);
      setUsers(otherUsers);
    });

    socket.on("incoming-call", (data) => {
      console.log("Receiving incoming call from", data.from);
      setIncomingCall({
        from: data.from,
        offer: data.offer,
      });
    });

    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }

    socket.on("call-finalized", async (data) => {
      console.log("Call finalized with answer from", data.from);
      if (peerConnectionRef.current) {
        // Set the remote description for the original caller
        await peerConnectionRef.current.setRemoteDescription(data.answer);
      }
    });

    socket.on("ice-candidate", (data) => {
      if (peerConnectionRef.current) {
        console.log("Receiving ICE candidate");
        peerConnectionRef.current.addIceCandidate(data.candidate);
      }
    });

    return () => {
      socket.off("update-users");
      socket.off("incoming-call"); // Cleanup the new listener
      socket.off("call-finalized");
      socket.off("ice-candidate");
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

  function setupPeerConnection(targetId) {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
      ],
    });

    // Event handler for when an ICE candidate is generated
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log("Sending ICE candidate");
        socket.emit("ice-candidate", {
          target: targetId,
          candidate: event.candidate,
        });
      }
    };

    // Event handler for when the remote stream is added
    pc.ontrack = (event) => {
      console.log("Received remote track");
      setRemoteStream(new MediaStream([event.track]));
    };

    // Add local stream tracks to the connection
    localStream.getTracks().forEach((track) => {
      pc.addTrack(track, localStream);
    });

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
        if (success) {
          setRoomId(joinRoomId);
        } else {
          alert("Room not found.");
        }
      });
    }
  }

  async function handleCallUser(targetId) {
    console.log(`Calling user: ${targetId}`);
    // Use our new setup function
    setupPeerConnection(targetId);

    const offer = await peerConnectionRef.current.createOffer();
    await peerConnectionRef.current.setLocalDescription(offer);

    socket.emit("call-user", {
      target: targetId,
      offer: offer,
    });
  }

  async function handleAnswerCall() {
    if (!incomingCall) return;
    console.log("Answering call from", incomingCall.from);

    // Use our new setup function
    setupPeerConnection(incomingCall.from);

    await peerConnectionRef.current.setRemoteDescription(incomingCall.offer);

    const answer = await peerConnectionRef.current.createAnswer();
    await peerConnectionRef.current.setLocalDescription(answer);

    socket.emit("call-accepted", {
      to: incomingCall.from,
      answer: answer,
    });

    setIncomingCall(null);
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
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="w-full max-w-lg border-2 rounded mb-4 bg-black"
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

        {incomingCall && (
          <div className="absolute top-5 left-1/2 -translate-x-1/2 bg-gray-700 text-white p-4 rounded shadow-lg">
            <p>{incomingCall.from.substring(0, 5)}... is calling you.</p>
            <button
              onClick={handleAnswerCall}
              className="bg-green-500 p-2 rounded mt-2"
            >
              Answer
            </button>
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
              <button
                onClick={() => handleCallUser(user.id)}
                className="bg-green-500 text-white p-1 rounded"
              >
                Call
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default VideoPage;
