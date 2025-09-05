const express = require("express");
const cors = require("cors");
const routes = require("../controllers");
const sequelize = require("../config/connection.js");
const path = require("path");
const session = require("express-session");
const SequelizeStore = require("connect-session-sequelize")(session.Store);

const sess = {
  secret: "Super secret secret",
  cookie: {
    secure: false,
  },
  resave: false,
  saveUninitialized: true,
  store: new SequelizeStore({
    db: sequelize,
  }),
};

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "../public")));
app.use(session(sess));

// Your API endpoint
const fetch = require("node-fetch");

// Replace your existing /api/proxy/nfl-2025 endpoint with this:
app.get("/api/proxy/nfl-2025", async (req, res) => {
  try {
    console.log("Fetching NFL data directly from fixturedownload.com...");

    const response = await fetch(
      "https://fixturedownload.com/feed/json/nfl-2025",
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; LoserLeague/1.0)",
          Accept: "application/json",
          Referer: "https://loser-league.herokuapp.com",
        },
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log("Successfully fetched NFL data");
    res.json(data);
  } catch (err) {
    console.error("Failed to fetch NFL data:", err.message);
    res.status(500).json({
      error: "Failed to fetch NFL data",
      message: err.message,
    });
  }
});

// Turn on routes
https: app.use(routes);

// Turn on connection to db and server
sequelize.sync({ force: false }).then(() => {
  app.listen(PORT, () => console.log(`Now listening on port ${PORT}`));
});
