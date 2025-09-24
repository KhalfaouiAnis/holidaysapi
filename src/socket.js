// server.ts (ElysiaJS backend)
import { Elysia } from "elysia";

const app = new Elysia();

app.ws("/ws", {
  open(ws) {
    console.log("WebSocket connection opened");
    // Send a welcome event when a client connects
    ws.send(
      JSON.stringify({
        event: "welcome",
        data: { message: "Welcome to the WebSocket server!" },
      })
    );
  },
  message(ws, message) {
    console.log("Received message:", message);
    try {
      const parsed = JSON.parse(message);
      // Example: Handle a client message and respond with a specific event
      if (parsed.type === "send_message") {
        ws.send(
          JSON.stringify({
            event: "new_message",
            data: { text: parsed.text, timestamp: new Date().toISOString() },
          })
        );
      }
    } catch (e) {
      ws.send(
        JSON.stringify({
          event: "error",
          data: { message: "Invalid JSON format" },
        })
      );
    }
  },
  close(ws) {
    console.log("WebSocket connection closed");
    // Optionally broadcast a disconnect event to other clients
    ws.publish(
      "all",
      JSON.stringify({
        event: "user_disconnected",
        data: { message: "A user has disconnected" },
      })
    );
  },
});

app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
