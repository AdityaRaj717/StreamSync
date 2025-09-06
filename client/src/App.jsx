import { useEffect } from "react";
import { io } from "socket.io-client";

function App() {
  // Connects to the signalling server
  useEffect(() => {
    const socket = io("https://localhost:3000/");
    socket.on("connect", () => {
      console.log(socket.id);
    });
  }, []);

  return <></>;
}

export default App;
