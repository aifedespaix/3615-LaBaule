"use client";

import { useEffect, useState } from "react";

export default function GameClient() {
  const [status, setStatus] = useState("Disconnected");

  useEffect(() => {
    const ws = new WebSocket("ws://localhost:3001");

    ws.onopen = () => {
      console.log("Connected");
      setStatus("Connected");
      ws.send("Hello from Client");
    };

    ws.onmessage = (event) => {
      console.log("Message from server:", event.data);
    };

    ws.onclose = () => {
      console.log("Disconnected");
      setStatus("Disconnected");
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
      setStatus("Error");
    };

    return () => {
      ws.close();
    };
  }, []);

  return (
    <div className="fixed bottom-4 right-4 p-4 bg-black/80 text-green-500 font-mono border border-green-500 rounded">
      Status: {status}
    </div>
  );
}
