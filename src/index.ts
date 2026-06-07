import express from "express";
import { getSystemStatus } from "./config/system";

const app = express();

app.get("/api/health", async (_req, res) => {
  const status = await getSystemStatus();
  res.json(status);
});
