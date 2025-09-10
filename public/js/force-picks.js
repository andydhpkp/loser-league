/**
 * Auto Pick Scheduler - Handles automatic pick selection for tracks
 * Only runs once per week after Thursday 6:20 PM Utah time
 * Includes multiple guard layers to prevent successive executions
 */

class AutoPickScheduler {
  constructor() {
    this.UTAH_TIMEZONE = "America/Denver";
    this.DEADLINE_DAY = 4; // Thursday
    this.DEADLINE_HOUR = 18; // 6 PM
    this.DEADLINE_MINUTE = 20; // 20 minutes
    this.STORAGE_KEY = "lastAutoPickExecution";
    this.SEASON_START = new Date("2025-09-04T18:20:00-06:00");

    // Guard properties
    this.EXECUTION_LOCK_KEY = "autoPickInProgress";
    this.MIN_EXECUTION_INTERVAL = 60 * 60 * 1000; // 1 hour minimum between calls
  }

  /**
   * Get current time in Utah timezone
   */
  getCurrentUtahTime() {
    return new Date().toLocaleString("en-US", { timeZone: this.UTAH_TIMEZONE });
  }

  /**
   * Get the current week's Thursday deadline in Utah time
   */
  getThisWeekDeadline() {
    const now = new Date(this.getCurrentUtahTime());
    const currentDay = now.getDay();

    let daysUntilThursday = this.DEADLINE_DAY - currentDay;

    if (daysUntilThursday < 0) {
      daysUntilThursday += 7;
    } else if (daysUntilThursday === 0) {
      const currentHour = now.getHours();
      if (currentHour >= 0) {
        daysUntilThursday = 0;
      } else {
        daysUntilThursday = 7;
      }
    }

    const deadline = new Date(now);
    deadline.setDate(now.getDate() + daysUntilThursday);
    deadline.setHours(this.DEADLINE_HOUR, this.DEADLINE_MINUTE, 0, 0);

    return deadline;
  }

  /**
   * Check if we're in the valid execution window
   * Valid window: ONLY Thursday 6:20 PM to Thursday 11:59 PM each week
   */
  isInValidExecutionWindow() {
    const now = new Date(this.getCurrentUtahTime());

    if (now < this.SEASON_START) {
      return false;
    }

    const currentDay = now.getDay();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    if (currentDay !== this.DEADLINE_DAY) {
      return false;
    }

    if (currentHour < this.DEADLINE_HOUR) {
      return false;
    }

    if (
      currentHour === this.DEADLINE_HOUR &&
      currentMinute < this.DEADLINE_MINUTE
    ) {
      return false;
    }

    return true;
  }

  /**
   * Check if auto-pick has already been executed for this week's Thursday
   */
  hasExecutedThisWeek() {
    const lastExecution = localStorage.getItem(this.STORAGE_KEY);
    if (!lastExecution) {
      return false;
    }

    const lastExecutionDate = new Date(lastExecution);
    const thisWeekDeadline = this.getThisWeekDeadline();

    return lastExecutionDate >= thisWeekDeadline;
  }

  /**
   * Mark that auto-pick has been executed
   */
  markAsExecuted() {
    const now = new Date(this.getCurrentUtahTime());
    localStorage.setItem(this.STORAGE_KEY, now.toISOString());
  }

  /**
   * Check if auto-pick is currently locked/running
   */
  isExecutionLocked() {
    const lockTime = localStorage.getItem(this.EXECUTION_LOCK_KEY);
    if (!lockTime) return false;

    const now = Date.now();
    const lockTimestamp = parseInt(lockTime);

    // If lock is older than 30 minutes, consider it stale and remove it
    if (now - lockTimestamp > 30 * 60 * 1000) {
      localStorage.removeItem(this.EXECUTION_LOCK_KEY);
      return false;
    }

    return true;
  }

  /**
   * Set execution lock
   */
  setExecutionLock() {
    localStorage.setItem(this.EXECUTION_LOCK_KEY, Date.now().toString());
  }

  /**
   * Release execution lock
   */
  releaseExecutionLock() {
    localStorage.removeItem(this.EXECUTION_LOCK_KEY);
  }

  /**
   * Check if minimum time has passed since last execution
   */
  hasMinimumTimePassed() {
    const lastExecution = localStorage.getItem(this.STORAGE_KEY);
    if (!lastExecution) return true;

    const now = Date.now();
    const lastExecutionTime = new Date(lastExecution).getTime();

    return now - lastExecutionTime >= this.MIN_EXECUTION_INTERVAL;
  }

  /**
   * Call the auto-pick API endpoint
   */
  async callAutoPickAPI() {
    try {
      console.log("Calling auto-pick API...");

      const response = await fetch("/api/tracks/force-picks/all-alive", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (response.status === 404) {
        const result = await response.json();
        console.log("Auto-pick checked: No picks needed -", result.message);

        this.markAsExecuted();

        return {
          success: true,
          message: result.message,
          picksNeeded: false,
          tracksProcessed: 0,
        };
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log("Auto-pick completed successfully:", result);

      this.markAsExecuted();

      return {
        success: true,
        message: result.message,
        picksNeeded: true,
        tracksProcessed: result.successCount || 0,
        details: result,
      };
    } catch (error) {
      console.error("Error calling auto-pick API:", error);
      throw error;
    }
  }

  /**
   * Enhanced execution check with multiple guards
   */
  async checkAndExecuteAutoPick() {
    try {
      console.log("Checking auto-pick conditions with guards...");

      // GUARD 1: Check if execution is locked
      if (this.isExecutionLocked()) {
        console.log("Auto-pick execution is locked (another instance running)");
        return {
          executed: false,
          reason: "Execution locked - another instance running",
        };
      }

      // GUARD 2: Check minimum time interval
      if (!this.hasMinimumTimePassed()) {
        console.log("Minimum time interval not met (1 hour required)");
        return { executed: false, reason: "Minimum time interval not met" };
      }

      // GUARD 3: Check if we're in a valid execution window
      if (!this.isInValidExecutionWindow()) {
        const debugInfo = this.getDebugInfo();
        console.log("Not in valid execution window", {
          currentTime: debugInfo.currentUtahTime,
          reason: "Must be Thursday 6:20 PM - 11:59 PM Utah time",
        });
        return { executed: false, reason: "Outside execution window" };
      }

      // GUARD 4: Check if we've already executed this week
      if (this.hasExecutedThisWeek()) {
        console.log("Auto-pick already executed this week");
        return { executed: false, reason: "Already executed this week" };
      }

      console.log("All guards passed! Executing auto-pick...");

      // GUARD 5: Set execution lock before starting
      this.setExecutionLock();

      try {
        // Execute the auto-pick
        const result = await this.callAutoPickAPI();

        return {
          executed: true,
          result: result,
          executionTime: new Date().toISOString(),
        };
      } finally {
        // GUARD 6: Always release lock when done
        this.releaseExecutionLock();
      }
    } catch (error) {
      // GUARD 7: Release lock on error
      this.releaseExecutionLock();
      console.error("Error in auto-pick execution:", error);
      return {
        executed: false,
        reason: "Execution failed",
        error: error.message,
      };
    }
  }

  /**
   * Get debug information about current state
   */
  getDebugInfo() {
    const now = new Date(this.getCurrentUtahTime());
    const thisWeekDeadline = this.getThisWeekDeadline();
    const lastExecution = localStorage.getItem(this.STORAGE_KEY);

    return {
      currentUtahTime: now.toISOString(),
      currentDay: now.getDay(),
      currentHour: now.getHours(),
      currentMinute: now.getMinutes(),
      seasonStart: this.SEASON_START.toISOString(),
      isBeforeSeasonStart: now < this.SEASON_START,
      thisWeekDeadline: thisWeekDeadline.toISOString(),
      lastExecution: lastExecution,
      isThursday: now.getDay() === this.DEADLINE_DAY,
      isAfterDeadlineTime:
        now.getHours() > this.DEADLINE_HOUR ||
        (now.getHours() === this.DEADLINE_HOUR &&
          now.getMinutes() >= this.DEADLINE_MINUTE),
      isBeforeMidnight: now.getHours() < 24,
      isInValidWindow: this.isInValidExecutionWindow(),
      hasExecutedThisWeek: this.hasExecutedThisWeek(),
      canExecute:
        this.isInValidExecutionWindow() && !this.hasExecutedThisWeek(),
      isExecutionLocked: this.isExecutionLocked(),
      hasMinimumTimePassed: this.hasMinimumTimePassed(),
    };
  }

  /**
   * Helper method to test if a specific date/time would be in valid window
   */
  wouldBeValidAt(testDate) {
    const originalGetCurrentUtahTime = this.getCurrentUtahTime;

    this.getCurrentUtahTime = () =>
      testDate.toLocaleString("en-US", { timeZone: this.UTAH_TIMEZONE });

    const result = this.isInValidExecutionWindow();

    this.getCurrentUtahTime = originalGetCurrentUtahTime;

    return result;
  }
}

// Create global instance
const autoPickScheduler = new AutoPickScheduler();

// Prevent multiple initializations on the same page
let autoPickInitialized = false;

/**
 * Function to call on page load - checks and potentially executes auto-pick
 */
async function initializeAutoPickCheck() {
  // GUARD: Prevent multiple initializations
  if (autoPickInitialized) {
    console.log("Auto-pick already initialized, skipping...");
    return { executed: false, reason: "Already initialized" };
  }

  autoPickInitialized = true;
  console.log("Initializing auto-pick check...");

  // Add debug info to console
  const debugInfo = autoPickScheduler.getDebugInfo();
  console.log("Auto-pick debug info:", debugInfo);

  try {
    const result = await autoPickScheduler.checkAndExecuteAutoPick();

    if (result.executed) {
      console.log("Auto-pick executed successfully!", result);

      if (typeof showNotification === "function") {
        showNotification(
          "Auto-picks have been made for users without current picks!",
          "success"
        );
      }
    } else {
      console.log("Auto-pick not executed:", result.reason);
    }

    return result;
  } catch (error) {
    console.error("Failed to initialize auto-pick:", error);
    return {
      executed: false,
      reason: "Initialization failed",
      error: error.message,
    };
  }
}

/**
 * Manual trigger function for testing/admin use with confirmation
 */
async function manuallyTriggerAutoPickWithConfirmation() {
  const confirmed = confirm(
    "Are you sure you want to manually trigger auto-pick? This will bypass time checks but still respect other safety guards."
  );

  if (!confirmed) {
    console.log("Manual auto-pick cancelled by user");
    return;
  }

  // Check for execution lock even in manual mode
  if (autoPickScheduler.isExecutionLocked()) {
    alert("Auto-pick is currently running. Please wait and try again.");
    return;
  }

  console.log("Manually triggering auto-pick (bypassing time checks)...");

  try {
    autoPickScheduler.setExecutionLock();
    const result = await autoPickScheduler.callAutoPickAPI();
    console.log("Manual auto-pick completed:", result);
    return result;
  } catch (error) {
    console.error("Manual auto-pick failed:", error);
    throw error;
  } finally {
    autoPickScheduler.releaseExecutionLock();
  }
}

/**
 * Simple manual trigger function (original version)
 */
async function manuallyTriggerAutoPick() {
  console.log("Manually triggering auto-pick (bypassing time checks)...");

  try {
    const result = await autoPickScheduler.callAutoPickAPI();
    console.log("Manual auto-pick completed:", result);
    return result;
  } catch (error) {
    console.error("Manual auto-pick failed:", error);
    throw error;
  }
}

/**
 * Testing helper function - check if auto-pick would run at different times
 */
function testAutoPickTiming() {
  const tests = [
    {
      name: "Before season start",
      date: new Date("2025-09-01T10:00:00-06:00"),
    },
    { name: "Week 1 Monday", date: new Date("2025-09-01T10:00:00-06:00") },
    {
      name: "First Thursday 6:00 PM (before deadline)",
      date: new Date("2025-09-04T18:00:00-06:00"),
    },
    {
      name: "First Thursday 6:20 PM (at deadline)",
      date: new Date("2025-09-04T18:20:00-06:00"),
    },
    {
      name: "First Thursday 6:30 PM",
      date: new Date("2025-09-04T18:30:00-06:00"),
    },
    {
      name: "First Thursday 11:59 PM",
      date: new Date("2025-09-04T23:59:00-06:00"),
    },
    {
      name: "Week 1 Friday 12:01 AM",
      date: new Date("2025-09-05T00:01:00-06:00"),
    },
    { name: "Week 1 Friday noon", date: new Date("2025-09-05T12:00:00-06:00") },
    {
      name: "Week 2 Monday after MNF",
      date: new Date("2025-09-08T10:00:00-06:00"),
    },
    { name: "Week 2 Wednesday", date: new Date("2025-09-10T15:00:00-06:00") },
    {
      name: "Week 2 Thursday 6:00 PM (before deadline)",
      date: new Date("2025-09-11T18:00:00-06:00"),
    },
    {
      name: "Week 2 Thursday 6:20 PM (at deadline)",
      date: new Date("2025-09-11T18:20:00-06:00"),
    },
    {
      name: "Week 2 Thursday 10:00 PM",
      date: new Date("2025-09-11T22:00:00-06:00"),
    },
  ];

  console.log("Testing auto-pick timing:");
  tests.forEach((test) => {
    const wouldRun = autoPickScheduler.wouldBeValidAt(test.date);
    console.log(`${test.name}: ${wouldRun ? "WOULD RUN" : "would not run"}`);
  });
}

// Export for use in other files
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    AutoPickScheduler,
    autoPickScheduler,
    initializeAutoPickCheck,
    manuallyTriggerAutoPick,
    manuallyTriggerAutoPickWithConfirmation,
    testAutoPickTiming,
  };
}

// Usage example:
// Call this function when your app loads (e.g., in your main.js or app initialization)
// initializeAutoPickCheck();

// For debugging, you can check the current state anytime:
// console.log(autoPickScheduler.getDebugInfo());

// For testing timing logic:
// testAutoPickTiming();
