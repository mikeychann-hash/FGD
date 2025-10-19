import WebSocket from "ws";

export class PeerLink {
  constructor(url) {
    this.url = url;
    this.connect();
  }

  connect() {
    this.ws = new WebSocket(this.url);
    this.ws.on("open", () => console.log(`🔗 Connected to peer ${this.url}`));
    this.ws.on("error", (err) => console.error(`PeerLink error: ${err.message}`));
    this.ws.on("close", () => {
      console.log(`⚠️ Disconnected from ${this.url}, retrying...`);
      setTimeout(() => this.connect(), 5000);
    });
  }

  send(obj) {
    if (this.ws.readyState === WebSocket.OPEN)
      this.ws.send(JSON.stringify(obj));
  }
}
