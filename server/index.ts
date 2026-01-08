
const server = Bun.serve({
  port: 3001,
  fetch(req, server) {
    // Upgrade the request to a WebSocket
    if (server.upgrade(req)) {
      return; // Bun automatically handles the 101 Switching Protocols response
    }
    return new Response("Upgrade failed", { status: 500 });
  },
  websocket: {
    open(ws) {
      console.log("Client connected");
      ws.send("Welcome to 3615 La Baule Server");
    },
    message(ws, message) {
      console.log(`Received message: ${message}`);
      ws.send(`Echo: ${message}`);
    },
    close(ws, code, message) {
      console.log("Client disconnected");
    },
    drain(ws) {
      // The socket is ready to receive more data
    },
  },
});

console.log(`Listening on localhost:${server.port}`);
