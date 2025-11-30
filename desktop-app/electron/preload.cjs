const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("desktop", {
  env: process.env.NODE_ENV,
});
