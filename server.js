import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const port = process.env.PORT || 3000;
const distPath = path.join(__dirname, "dist");

app.use(express.static(distPath));

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", app: "phoneflip" });
});

app.get("*", (req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

app.listen(port, () => {
  console.log(`PhoneFlip Node server is running at http://localhost:${port}`);
});
