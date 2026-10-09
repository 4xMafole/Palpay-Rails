import express from "express";
import cors from "cors";
import { env } from "./config/env.js";
import { missionsRouter } from "./routes/missions.js";
import { requestsRouter } from "./routes/requests.js";
import { deviceTokensRouter } from "./routes/deviceTokens.js";
import { demoRouter } from "./routes/demo.js";

const app = express();

// Render (and most PaaS) sit behind a reverse proxy — without this, req.ip
// always resolves to the proxy's address, making per-IP rate limiting useless.
app.set("trust proxy", 1);

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
    res.json({ status: "ok", service: "palpay-rail-server", env: env.NODE_ENV });
});

app.use("/missions", missionsRouter);
app.use("/requests", requestsRouter);
app.use("/device-tokens", deviceTokensRouter);
app.use("/demo", demoRouter);

// Added in a later phase: app.use("/audit", auditRouter);

app.listen(env.PORT, () => {
    console.log(`Palpay Rail server listening on port ${env.PORT}`);
});
