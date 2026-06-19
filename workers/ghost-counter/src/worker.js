const GHOSTS_ENDPOINT = "/api/ghosts-online";

function jsonResponse(body, init = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...(init.headers || {}),
    },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname !== GHOSTS_ENDPOINT) {
      return jsonResponse({ error: "Not found" }, { status: 404 });
    }

    if ((request.headers.get("Upgrade") || "").toLowerCase() !== "websocket") {
      return jsonResponse(
        {
          error: "WebSocket upgrade required",
          endpoint: GHOSTS_ENDPOINT,
        },
        {
          status: 426,
          headers: {
            Upgrade: "websocket",
          },
        },
      );
    }

    const id = env.GHOST_COUNTER.idFromName("global");
    return env.GHOST_COUNTER.get(id).fetch(request);
  },
};

export class GhostCounter {
  constructor() {
    this.sockets = new Set();
  }

  async fetch(request) {
    if ((request.headers.get("Upgrade") || "").toLowerCase() !== "websocket") {
      return jsonResponse(
        {
          error: "WebSocket upgrade required",
          endpoint: GHOSTS_ENDPOINT,
        },
        {
          status: 426,
          headers: {
            Upgrade: "websocket",
          },
        },
      );
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    this.addSocket(server);

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  addSocket(socket) {
    socket.accept();
    this.sockets.add(socket);
    this.broadcastCount();

    const removeSocket = () => {
      if (!this.sockets.delete(socket)) return;
      this.broadcastCount();
    };

    socket.addEventListener("close", removeSocket);
    socket.addEventListener("error", removeSocket);
  }

  broadcastCount() {
    const message = JSON.stringify({ count: this.sockets.size });
    let removedClosedSocket = false;

    for (const socket of this.sockets) {
      try {
        socket.send(message);
      } catch (error) {
        this.sockets.delete(socket);
        removedClosedSocket = true;
      }
    }

    if (removedClosedSocket) {
      this.broadcastCount();
    }
  }
}
