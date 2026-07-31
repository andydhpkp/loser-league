const express = require("express");

const { ValidationError } = require("../lib/errors");
const { createEspnClient } = require("./espn-client");

const INTEGER_PATTERN = /^[1-9]\d*$/;

function parseScheduleQuery(query, currentYear = new Date().getUTCFullYear()) {
  const { year, week } = query;
  const validStrings =
    typeof year === "string" &&
    typeof week === "string" &&
    INTEGER_PATTERN.test(year) &&
    INTEGER_PATTERN.test(week);
  const parsedYear = validStrings ? Number(year) : NaN;
  const parsedWeek = validStrings ? Number(week) : NaN;

  if (
    !Number.isSafeInteger(parsedYear) ||
    parsedYear < 2000 ||
    parsedYear > currentYear + 1 ||
    !Number.isSafeInteger(parsedWeek) ||
    parsedWeek < 1 ||
    parsedWeek > 22
  ) {
    throw new ValidationError(
      "A valid NFL season year and week are required"
    );
  }

  return { year: parsedYear, week: parsedWeek };
}

function createNflRouter({ fetchImpl = global.fetch } = {}) {
  const router = express.Router();
  const espnClient = createEspnClient({ fetchImpl });

  router.get("/teams", async (_req, res, next) => {
    try {
      res.json(await espnClient.fetchTeams());
    } catch (error) {
      next(error);
    }
  });

  router.get("/schedule", async (req, res, next) => {
    try {
      const schedule = parseScheduleQuery(req.query);
      res.json(await espnClient.fetchSchedule(schedule));
    } catch (error) {
      next(error);
    }
  });

  return router;
}

module.exports = { createNflRouter, parseScheduleQuery };
