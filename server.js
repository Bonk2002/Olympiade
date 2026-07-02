import express from "express";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;
const distPath = path.join(__dirname, "dist");
const indexPath = path.join(distPath, "index.html");

let tournamentState = null;

app.use(express.json({ limit: "2mb" }));

app.get("/api/tournament-state", (request, response) => {
  response.json({ state: tournamentState });
});

app.post("/api/tournament-state", (request, response) => {
  tournamentState = Object.prototype.hasOwnProperty.call(request.body ?? {}, "state")
    ? request.body.state
    : null;

  response.json({ state: tournamentState });
});

app.delete("/api/tournament-state", (request, response) => {
  tournamentState = null;
  response.json({ state: null });
});

app.use(express.static(distPath));

app.get(/^\/(?!api).*/, (request, response) => {
  response.sendFile(indexPath);
});

app.listen(port, () => {
  console.log(`Tournament app listening on port ${port}`);
});
