const WebSocket = require("ws");

const wss = new WebSocket.Server({ port: 8080 });

const clients = new Map(); // Store client connections by peerId
const activeCalls = new Map(); // Store active calls with a unique callId

wss.on("connection", (ws) => {
  ws.on("message", (message) => {
    const data = JSON.parse(message);

    if (data.type === "register") {
      // Register the client by peerId
      clients.set(data.peerId, ws);
      ws.peerId = data.peerId;

      // Send the current active calls list to the newly connected peer
      ws.send(
        JSON.stringify({
          type: "activeCalls",
          activeCalls: Array.from(activeCalls.values()),
        })
      );
    } else if (data.type === "call") {
      // Add a new call to the active calls list
      const callId = `${data.from}-${Date.now()}`; // Unique callId
      activeCalls.set(callId, { callId, from: data.from });

      // Broadcast updated active calls to all peers
      broadcastActiveCalls();
    } else if (data.type === "joinCall") {
      // Notify the creator of the call that someone joined
      const call = activeCalls.get(data.callId);
      if (call) {
        const creatorPeer = clients.get(call.from);
        if (creatorPeer) {
          creatorPeer.send(
            JSON.stringify({
              type: "joinCall",
              from: data.from,
            })
          );
        }
      }
    } else if (data.type === "endCall") {
      const callId = data.callId;
      if (activeCalls.has(callId)) {
        activeCalls.delete(callId);
        // Notify all peers about the call ending
        broadcastToAll({ type: "callEnded", callId });
        broadcastActiveCalls();
      }
    }
  });

  ws.on("close", () => {
    clients.delete(ws.peerId);
  });

  const broadcastToAll = (message) => {
    for (const [, client] of clients) {
      client.send(JSON.stringify(message));
    }
  };

  const broadcastActiveCalls = () => {
    const callsList = Array.from(activeCalls.values());
    for (const [, client] of clients) {
      client.send(
        JSON.stringify({ type: "activeCalls", activeCalls: callsList })
      );
    }
  };
});

console.log("WebSocket server running on ws://localhost:8080");
