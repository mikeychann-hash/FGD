import express from "express";
import cors from "cors";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.join(__dirname, "data", "fused_knowledge.json");
const DEFAULT_FUSION_DATA = {
  skills: {},
  dialogues: {},
  outcomes: [],
  metadata: {
    version: "2.0.0",
    lastMerge: null,
    mergeCount: 0,
    sources: []
  }
};

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "dashboard.html"));
});

app.get("/data/fused_knowledge.json", async (req, res) => {
  try {
    const data = await fs.readFile(DATA_PATH, "utf-8");
    res.type("application/json").send(data);
  } catch (err) {
    if (err.code !== "ENOENT") {
      console.warn("Unable to read fusion data", err);
    }
    res.json(DEFAULT_FUSION_DATA);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ AICraft control panel active at http://localhost:${PORT}`);
});
