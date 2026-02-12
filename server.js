import express from "express";
import fetch from "node-fetch";

const app = express();
const PORT = process.env.PORT || 3000;

// ROUTE API
app.get("/players", async (req, res) => {
  try {
    const response = await fetch("http://45.138.200.204:30120/players.json");
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Errore nel recupero dati" });
  }
});

// ROUTE PAGINA PRINCIPALE
app.get("/", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>FiveM Players</title>
      <style>
        body {
          font-family: Arial;
          background: #f4f6f9;
          text-align: center;
          padding: 40px;
        }
        table {
          margin: auto;
          border-collapse: collapse;
          background: white;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        th, td {
          padding: 12px 18px;
          border-bottom: 1px solid #ddd;
        }
        th {
          background: #1976D2;
          color: white;
        }
        tr:hover {
          background: #f1f1f1;
        }
      </style>
    </head>
    <body>
      <h1>Giocatori Online</h1>
      <table id="players">
        <thead>
          <tr>
            <th>#</th>
            <th>Nome</th>
            <th>Ping</th>
          </tr>
        </thead>
        <tbody></tbody>
      </table>

      <script>
        async function loadPlayers() {
          const res = await fetch("/players");
          const players = await res.json();
          const tbody = document.querySelector("tbody");
          tbody.innerHTML = "";

          players.forEach((p, i) => {
            tbody.innerHTML += \`
              <tr>
                <td>\${i+1}</td>
                <td>\${p.name}</td>
                <td>\${p.ping}</td>
              </tr>
            \`;
          });
        }

        loadPlayers();
        setInterval(loadPlayers, 10000);
      </script>
    </body>
    </html>
  `);
});

app.listen(PORT, () => {
  console.log("Server avviato");
});
