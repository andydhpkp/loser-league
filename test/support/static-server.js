const path = require("node:path");
const express = require("express");

const app = express();
app.use(express.static(path.join(__dirname, "../../public")));

app.listen(4173, "127.0.0.1", () => {
  console.log("Static smoke server listening on 4173");
});
