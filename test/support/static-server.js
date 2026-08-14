const path = require("node:path");
const express = require("express");
const { createPublicEmailReminderRouter } = require("../../server/user/email-reminder-routes");

const app = express();
app.use("/reminders/email", createPublicEmailReminderRouter({ service: { consumeVerification: async () => ({ success: true }), optOut: async () => ({ state: "USER_DISABLED" }) } }));
app.use(express.static(path.join(__dirname, "../../public")));

app.listen(4173, "127.0.0.1", () => {
  console.log("Static smoke server listening on 4173");
});
