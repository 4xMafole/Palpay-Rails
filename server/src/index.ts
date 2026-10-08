import express from "express";
import cors from "cors";
import { env } from "./config/env.js";
import { missionsRouter } from "./routes/missions.js";
import { requestsRouter } from "./routes/requests.js";
import { deviceTokensRouter } from "./routes/deviceTokens.js";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
    res.json({ status: "ok", service: "palpay-rail-server", env: env.NODE_ENV });
});

app.use("/missions", missionsRouter);
app.use("/requests", requestsRouter);
app.use("/device-tokens", deviceTokensRouter);

// Added in a later phase: app.use("/audit", auditRouter);

app.listen(env.PORT, () => {
    console.log(`Palpay Rail server listening on port ${env.PORT}`);
});
