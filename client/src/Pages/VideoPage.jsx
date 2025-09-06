import React from "react";
import { useRef, useState, useEffect } from "react";

const VideoPage = () => {
  const [stream, setStream] = useState(null);
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  async function enableVideoAudio() {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });
    setStream(stream);
  }

  return (
    <div className="h-[90vh] flex flex-col gap-5 items-center justify-center">
      <h1 className="border-2 p-5">StreamSync</h1>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-96 h-96 border-2"
      />
      <button
        onClick={enableVideoAudio}
        className="border-2 p-2 w-2xs cursor-pointer"
      >
        Start Camera
      </button>
    </div>
  );
};

export default VideoPage;
