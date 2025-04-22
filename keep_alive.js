import express from "express";

export function keep_alive() {
  const server = express();

  server.get("/", (req, res) => {
    res.send("🟢 Alive");
  });

  server.listen(3000, () => {
    console.log("Keep-alive server running.");
  });
}
