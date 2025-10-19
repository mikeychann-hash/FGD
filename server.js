import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("🧠 AICraft Web Control Server running...");
});

const PORT = 3000;
app.listen(PORT, () => console.log(`✅ AICraft control panel active at http://localhost:${PORT}`));
