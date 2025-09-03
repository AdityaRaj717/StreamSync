import { useEffect } from "react";
import { io } from "socket.io-client";
import adapter from "webrtc-adapter";

function App() {
  useEffect(() => {
    const socket = io("https://localhost:3000/");
    socket.on("connect", () => {
      console.log(socket.id);
    });
  }, []);

  function enableVideoAudio() {
    const stream = navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: true,
    });
  }

  return (
    <>
      <button onClick={enableVideoAudio}>Enable Stream</button>
    </>
  );
}

export default App;
