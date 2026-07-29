const router = require("express").Router();
const { Track, User } = require("../../../models/my-index");
const { Op, Sequelize } = require("sequelize");
const { logger } = require("../../../server/lib/logger");
const sequelize = require("../../../config/connection");

const forcePickExecutions = new Map(); // trackId -> timestamp
const FORCE_PICK_COOLDOWN = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
const GLOBAL_FORCE_PICK_LOCK = { isRunning: false, lastExecution: null };

router.put("/force-picks/all-alive", async (req, res) => {
  let transaction;
  try {
    // GUARD 1: Check if force-pick is already running globally
    if (GLOBAL_FORCE_PICK_LOCK.isRunning) {
      return res.status(429).json({
        error: "Force-pick is already in progress. Please wait.",
        lastExecution: GLOBAL_FORCE_PICK_LOCK.lastExecution,
      });
    }

    // GUARD 2: Check if force-pick was executed recently (within 1 hour)
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    if (
      GLOBAL_FORCE_PICK_LOCK.lastExecution &&
      now - GLOBAL_FORCE_PICK_LOCK.lastExecution < oneHour
    ) {
      return res.status(429).json({
        error:
          "Force-pick executed too recently. Must wait at least 1 hour between executions.",
        lastExecution: new Date(
          GLOBAL_FORCE_PICK_LOCK.lastExecution
        ).toISOString(),
        timeUntilNext: new Date(
          GLOBAL_FORCE_PICK_LOCK.lastExecution + oneHour
        ).toISOString(),
      });
    }

    // GUARD 3: Set global lock
    GLOBAL_FORCE_PICK_LOCK.isRunning = true;
    logger.info("force_pick_lock_acquired");
    transaction = await sequelize.transaction();

    // Find all alive tracks without current picks
    const tracksNeedingPicks = await Track.findAll({
      where: {
        wrong_pick: null,
        [Op.or]: [{ current_pick: null }, { current_pick: "" }],
      },
      include: [
        {
          model: User,
          attributes: ["id", "first_name", "last_name", "username", "email"],
        },
      ],
      transaction,
    });

    if (!tracksNeedingPicks || tracksNeedingPicks.length === 0) {
      // Release lock before returning
      GLOBAL_FORCE_PICK_LOCK.isRunning = false;
      GLOBAL_FORCE_PICK_LOCK.lastExecution = now;
      await transaction.commit();

      return res.status(404).json({
        message: "No alive tracks without current picks found",
      });
    }

    const updatedTracks = [];
    const errors = [];

    // Process each track that needs a pick
    for (const track of tracksNeedingPicks) {
      try {
        // GUARD 4: Check individual track cooldown
        const lastPickTime = forcePickExecutions.get(track.id);
        if (lastPickTime && now - lastPickTime < FORCE_PICK_COOLDOWN) {
          errors.push({
            trackId: track.id,
            userId: track.user_id,
            username: track.User ? track.User.username : "Unknown",
            error: "Track was force-picked too recently (24hr cooldown)",
          });
          continue;
        }

        // Get available picks for this track
        let availablePicks = track.available_picks;
        let usedPicks = track.used_picks;

        // Check if there are available picks
        if (!availablePicks || availablePicks.length === 0) {
          errors.push({
            trackId: track.id,
            userId: track.user_id,
            username: track.User ? track.User.username : "Unknown",
            error: "No available picks remaining",
          });
          continue;
        }

        // Select a random pick from available picks
        const randomIndex = Math.floor(Math.random() * availablePicks.length);
        const selectedPick = availablePicks[randomIndex];

        // Remove the selected pick from available picks
        availablePicks.splice(randomIndex, 1);

        // Add the selected pick to used picks
        usedPicks.push(selectedPick);

        // Update the track with the new pick
        track.available_picks = availablePicks;
        track.used_picks = usedPicks;
        track.current_pick = selectedPick;

        // Save the updated track
        await track.save({ transaction });

        // GUARD 5: Record this execution for the track
        forcePickExecutions.set(track.id, now);

        updatedTracks.push({
          trackId: track.id,
          userId: track.user_id,
          username: track.User ? track.User.username : "Unknown",
          selectedPick: selectedPick,
          remainingAvailable: availablePicks.length,
        });

        logger.debug("force_pick_assigned", {
          trackId: track.id,
          selectedPick,
        });
      } catch (error) {
        errors.push({
          trackId: track.id,
          userId: track.user_id,
          username: track.User ? track.User.username : "Unknown",
          error: error.message,
        });
      }
    }

    // GUARD 6: Update global execution time and release lock
    GLOBAL_FORCE_PICK_LOCK.lastExecution = now;
    GLOBAL_FORCE_PICK_LOCK.isRunning = false;
    await transaction.commit();
    logger.info("force_pick_completed", {
      processedTracks: updatedTracks.length,
      failedTracks: errors.length,
    });

    // Prepare response
    const response = {
      message: `Auto-pick completed for ${updatedTracks.length} tracks`,
      updatedTracks: updatedTracks,
      totalProcessed: tracksNeedingPicks.length,
      successCount: updatedTracks.length,
      errorCount: errors.length,
      executionTime: new Date(now).toISOString(),
    };

    if (errors.length > 0) {
      response.errors = errors;
    }

    res.json(response);
  } catch (error) {
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }
    // GUARD 7: Always release lock on error
    GLOBAL_FORCE_PICK_LOCK.isRunning = false;
    logger.error("force_pick_failed", { errorType: error.name });

    res.status(500).json({
      error: "INTERNAL_ERROR",
      message: "An unexpected error occurred",
    });
  }
});

// Route to reset all tracks to a specific number of picks

module.exports = router;
