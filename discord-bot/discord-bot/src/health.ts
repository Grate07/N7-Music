import express from "express";
import type { Server } from "node:http";

export const startHealthServer = (port: number, isReady: () => boolean): Server => {
  const app = express();

  app.get("/", (_request, response) => {
    response.status(200).send("N7 Music is running.");
  });

  app.get("/health", (_request, response) => {
    const ready = isReady();
    response.status(ready ? 200 : 503).json({
      status: ready ? "ok" : "starting",
      service: "n7-music",
    });
  });

  return app.listen(port, "0.0.0.0", () => {
    console.info(`Health server listening on port ${port}`);
  });
};