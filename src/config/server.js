import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import { ROOT_DIR } from "./constants.js";

/**
 * Creates and configures the Express app, HTTP server, and Socket.IO server
 * @returns {{ app: Express, httpServer: http.Server, io: Server }}
 */
export function createAppServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  // Configure middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.static(ROOT_DIR));

  return { app, httpServer, io };
}
