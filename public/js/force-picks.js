/**
 * Auto Pick Scheduler - Handles automatic pick selection for tracks
 * Only runs once per week after Thursday 6:20 PM Utah time
 */

class AutoPickScheduler {
  constructor() {
    this.UTAH_TIMEZONE = "America/Denver"; // Utah is in Mountain Time
    this.DEADLINE_DAY = 4; // Thursday (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
    this.DEADLINE_HOUR = 18; // 6 PM (24-hour format)
    this.DEADLINE_MINUTE = 20; // 20 minutes
    this.STORAGE_KEY = "lastAutoPickExecution";
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

    // Calculate days until Thursday (or if it's Thursday, use today)
    let daysUntilThursday = this.DEADLINE_DAY - currentDay;
    if (daysUntilThursday < 0) {
      daysUntilThursday += 7; // Next week's Thursday
    }

    const deadline = new Date(now);
    deadline.setDate(now.getDate() + daysUntilThursday);
    deadline.setHours(this.DEADLINE_HOUR, this.DEADLINE_MINUTE, 0, 0);

    return deadline;
  }

  /**
   * Get the previous week's Thursday deadline
   */
  getLastWeekDeadline() {
    const thisWeekDeadline = this.getThisWeekDeadline();
    const lastWeekDeadline = new Date(thisWeekDeadline);
    lastWeekDeadline.setDate(thisWeekDeadline.getDate() - 7);
    return lastWeekDeadline;
  }

  /**
   * Check if we're in the valid execution window
   * Valid window: After Thursday 6:20 PM until next Thursday 6:20 PM
   */
  isInValidExecutionWindow() {
    const now = new Date(this.getCurrentUtahTime());
    const thisWeekDeadline = this.getThisWeekDeadline();
    const lastWeekDeadline = this.getLastWeekDeadline();

    // If current time is after this week's deadline, we're in next week's window
    if (now >= thisWeekDeadline) {
      return true;
    }

    // If current time is after last week's deadline but before this week's deadline
    if (now >= lastWeekDeadline) {
      return true;
    }

    return false;
  }

  /**
   * Check if auto-pick has already been executed for this week
   */
  hasExecutedThisWeek() {
    const lastExecution = localStorage.getItem(this.STORAGE_KEY);
    if (!lastExecution) {
      return false;
    }

    const lastExecutionDate = new Date(lastExecution);
    const lastWeekDeadline = this.getLastWeekDeadline();

    // If last execution was after the most recent deadline, we've already executed
    return lastExecutionDate >= lastWeekDeadline;
  }

  /**
   * Mark that auto-pick has been executed
   */
  markAsExecuted() {
    const now = new Date(this.getCurrentUtahTime());
    localStorage.setItem(this.STORAGE_KEY, now.toISOString());
  }

  /**
   * Call the auto-pick API endpoint
   */
  /**
   * Call the auto-pick API endpoint - Updated to handle 404 as success
   */
  async callAutoPickAPI() {
    try {
      console.log("🎯 Calling auto-pick API...");

      const response = await fetch("/api/tracks/auto-pick-missing", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
      });

      // Handle 404 as "no work needed" rather than error
      if (response.status === 404) {
        const result = await response.json();
        console.log("✅ Auto-pick checked: No picks needed -", result.message);

        // Mark as executed since we successfully checked
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
      console.log("✅ Auto-pick completed successfully:", result);

      // Mark as executed after successful API call
      this.markAsExecuted();

      return {
        success: true,
        message: result.message,
        picksNeeded: true,
        tracksProcessed: result.successCount || 0,
        details: result,
      };
    } catch (error) {
      console.error("❌ Error calling auto-pick API:", error);
      throw error;
    }
  }

  /**
   * Main function to check and potentially execute auto-pick
   */
  async checkAndExecuteAutoPick() {
    try {
      console.log("🔍 Checking auto-pick conditions...");

      // Check if we're in a valid execution window
      if (!this.isInValidExecutionWindow()) {
        console.log(
          "⏰ Not in valid execution window (before Thursday 6:20 PM Utah time)"
        );
        return { executed: false, reason: "Outside execution window" };
      }

      // Check if we've already executed this week
      if (this.hasExecutedThisWeek()) {
        console.log("✅ Auto-pick already executed this week");
        return { executed: false, reason: "Already executed this week" };
      }

      console.log("🚀 Conditions met! Executing auto-pick...");

      // Execute the auto-pick
      const result = await this.callAutoPickAPI();

      return {
        executed: true,
        result: result,
        executionTime: new Date(this.getCurrentUtahTime()).toISOString(),
      };
    } catch (error) {
      console.error("💥 Error in auto-pick execution:", error);
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
    const lastWeekDeadline = this.getLastWeekDeadline();
    const lastExecution = localStorage.getItem(this.STORAGE_KEY);

    return {
      currentUtahTime: now.toISOString(),
      thisWeekDeadline: thisWeekDeadline.toISOString(),
      lastWeekDeadline: lastWeekDeadline.toISOString(),
      lastExecution: lastExecution,
      isInValidWindow: this.isInValidExecutionWindow(),
      hasExecutedThisWeek: this.hasExecutedThisWeek(),
      canExecute:
        this.isInValidExecutionWindow() && !this.hasExecutedThisWeek(),
    };
  }
}

// Create global instance
const autoPickScheduler = new AutoPickScheduler();

/**
 * Function to call on page load - checks and potentially executes auto-pick
 */
async function initializeAutoPickCheck() {
  console.log("🔄 Initializing auto-pick check...");

  // Add debug info to console
  console.log("📊 Auto-pick debug info:", autoPickScheduler.getDebugInfo());

  try {
    const result = await autoPickScheduler.checkAndExecuteAutoPick();

    if (result.executed) {
      console.log("🎉 Auto-pick executed successfully!", result);

      // Optionally show user notification
      if (typeof showNotification === "function") {
        showNotification(
          "Auto-picks have been made for users without current picks!",
          "success"
        );
      }
    } else {
      console.log("ℹ️ Auto-pick not executed:", result.reason);
    }

    return result;
  } catch (error) {
    console.error("💀 Failed to initialize auto-pick:", error);
    return {
      executed: false,
      reason: "Initialization failed",
      error: error.message,
    };
  }
}

/**
 * Manual trigger function for testing/admin use
 */
async function manuallyTriggerAutoPick() {
  console.log("🔧 Manually triggering auto-pick (bypassing time checks)...");

  try {
    const result = await autoPickScheduler.callAutoPickAPI();
    console.log("✅ Manual auto-pick completed:", result);
    return result;
  } catch (error) {
    console.error("❌ Manual auto-pick failed:", error);
    throw error;
  }
}

// Export for use in other files
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    AutoPickScheduler,
    autoPickScheduler,
    initializeAutoPickCheck,
    manuallyTriggerAutoPick,
  };
}

// Usage example:
// Call this function when your app loads (e.g., in your main.js or app initialization)
// initializeAutoPickCheck();

// For debugging, you can check the current state anytime:
// console.log(autoPickScheduler.getDebugInfo());
