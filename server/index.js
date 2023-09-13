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

app.get("/api/proxy/nfl-2023", async (req, res) => {
  try {
    const response = await fetch(
      "https://fixturedownload.com/feed/json/nfl-2023",
      {
        headers: {
          "Content-Type": "application/json",
          Origin: "https://loser-league.herokuapp.com",
          "X-Requested-With": "XMLHttpRequest",
          // ... any other headers you need
        },
      }
    );

    if (!response.ok) {
      throw new Error("Network response was not ok");
    }

    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch data" });
  }
});

// Turn on routes
https: app.use(routes);

// Turn on connection to db and server
sequelize.sync({ force: false }).then(() => {
  app.listen(PORT, () => console.log(`Now listening on port ${PORT}`));
});
