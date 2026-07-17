import express from "express";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { createRoomApiApp } from "./roomApi.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;
const distPath = path.join(__dirname, "dist");
const indexPath = path.join(distPath, "index.html");

app.use(createRoomApiApp());
app.use(express.static(distPath));

app.get(/^\/(?!api).*/, (request, response) => {
  response.sendFile(indexPath);
});

app.listen(port, () => {
  console.log(`Tournament app listening on port ${port}`);
});
