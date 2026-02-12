import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(cors());

app.get("/players", async (req, res) => {
  try {
    const response = await fetch("http://45.138.200.204:30120/players.json");
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "Errore nel recupero dati" });
  }
});

app.listen(process.env.PORT || 3000, () => {
  console.log("Proxy attivo");
});
