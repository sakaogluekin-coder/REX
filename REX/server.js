const http = require("http");
const fs = require("fs");
const path = require("path");

const KEY = process.env.API_KEY;
const PORT = process.env.PORT || 3000;
const TTL = (+process.env.CACHE_SECONDS || 60) * 1000;
const cache = new Map();

if (!KEY) {
  console.error("API_KEY ortam degiskeni gerekli");
  process.exit(1);
}

async function fixtures(date) {
  const hit = cache.get(date);
  if (hit && Date.now() - hit.t < TTL) return hit.d;
  const url = "https://v3.football.api-sports.io/fixtures?date=" + date + "&timezone=Europe/Istanbul";
  const r = await fetch(url, { headers: { "x-apisports-key": KEY } });
  if (!r.ok) throw new Error("API " + r.status);
  const j = await r.json();
  const d = (j.response || []).map(f => ({
    id: f.fixture.id,
    t: f.fixture.date,
    s: f.fixture.status.short,
    min: f.fixture.status.elapsed,
    lg: f.league.name,
    ct: f.league.country,
    lgId: f.league.id,
    h: f.teams.home.name,
    a: f.teams.away.name,
    hl: f.teams.home.logo,
    al: f.teams.away.logo,
    hs: f.goals.home,
    as: f.goals.away
  }));
  cache.set(date, { t: Date.now(), d: d });
  return d;
}

http.createServer(async (req, res) => {
  const u = new URL(req.url, "http://x");
  if (u.pathname === "/api/fixtures") {
    const date = u.searchParams.get("date") || "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      res.writeHead(400);
      return res.end("bad date");
    }
    try {
      const d = await fixtures(date);
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(d));
    } catch (e) {
      console.error("Hata:", e.message);
      const old = cache.get(date);
      res.writeHead(old ? 200 : 502, { "content-type": "application/json" });
      res.end(JSON.stringify(old ? old.d : { error: e.message }));
    }
    return;
  }
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(fs.readFileSync(path.join(__dirname, "index.html")));
}).listen(PORT, () => console.log("SkorTakip http://localhost:" + PORT));