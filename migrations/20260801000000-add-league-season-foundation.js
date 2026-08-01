"use strict";

async function hasTable(queryInterface, tableName) {
  return (await queryInterface.showAllTables()).includes(tableName);
}

async function addColumnUnlessPresent(
  queryInterface,
  tableName,
  columnName,
  definition
) {
  const table = await queryInterface.describeTable(tableName);
  if (!table[columnName]) {
    await queryInterface.addColumn(tableName, columnName, definition);
  }
}

module.exports = {
  async up(queryInterface, Sequelize) {
    if (!(await hasTable(queryInterface, "league_season"))) {
      await queryInterface.createTable("league_season", {
        id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          autoIncrement: true,
          primaryKey: true,
        },
        year: { type: Sequelize.INTEGER, allowNull: false, unique: true },
        state: {
          type: Sequelize.ENUM("SETUP", "ACTIVE", "COMPLETE", "ROLLED_OVER"),
          allowNull: false,
        },
        current_week: { type: Sequelize.INTEGER, allowNull: false },
        state_version: {
          type: Sequelize.INTEGER.UNSIGNED,
          allowNull: false,
          defaultValue: 0,
        },
        open_slot: { type: Sequelize.TINYINT, allowNull: true, unique: true },
        created_at: { type: Sequelize.DATE, allowNull: false },
        updated_at: { type: Sequelize.DATE, allowNull: false },
      });
    }

    await addColumnUnlessPresent(queryInterface, "track", "league_season_id", {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: "league_season", key: "id" },
    });
    await addColumnUnlessPresent(queryInterface, "track", "state_version", {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
    });

    if (!(await hasTable(queryInterface, "pick"))) {
      await queryInterface.createTable("pick", {
        id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          autoIncrement: true,
          primaryKey: true,
        },
        track_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: "track", key: "id" },
          onDelete: "CASCADE",
        },
        league_season_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: "league_season", key: "id" },
        },
        week: { type: Sequelize.INTEGER, allowNull: false },
        team_name: { type: Sequelize.STRING, allowNull: false },
        origin: {
          type: Sequelize.ENUM(
            "USER_SUBMISSION",
            "AUTOMATIC_SELECTION",
            "SHARED_ADMIN_REPAIR",
            "LEGACY_BACKFILL"
          ),
          allowNull: false,
        },
        outcome: {
          type: Sequelize.ENUM(
            "PENDING",
            "PREDICTION_CORRECT",
            "WRONG_PICK"
          ),
          allowNull: false,
          defaultValue: "PENDING",
        },
        committed_at: { type: Sequelize.DATE, allowNull: false },
        state_version: {
          type: Sequelize.INTEGER.UNSIGNED,
          allowNull: false,
          defaultValue: 0,
        },
      });
      await queryInterface.addIndex(
        "pick",
        ["track_id", "league_season_id", "week"],
        { unique: true, name: "pick_track_season_week_unique" }
      );
      await queryInterface.addIndex(
        "pick",
        ["track_id", "league_season_id", "team_name"],
        { unique: true, name: "pick_track_season_team_unique" }
      );
    }

    await addColumnUnlessPresent(
      queryInterface,
      "track",
      "eliminated_by_pick_id",
      {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "pick", key: "id" },
        onDelete: "SET NULL",
      }
    );

    if (!(await hasTable(queryInterface, "schedule_snapshot"))) {
      await queryInterface.createTable("schedule_snapshot", {
        id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          autoIncrement: true,
          primaryKey: true,
        },
        league_season_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: "league_season", key: "id" },
        },
        week: { type: Sequelize.INTEGER, allowNull: false },
        provider: { type: Sequelize.STRING, allowNull: false },
        content_hash: { type: Sequelize.STRING(64), allowNull: false },
        normalized_schedule: { type: Sequelize.JSON, allowNull: false },
        fetched_at: { type: Sequelize.DATE, allowNull: false },
        created_at: { type: Sequelize.DATE, allowNull: false },
      });
      await queryInterface.addIndex(
        "schedule_snapshot",
        ["league_season_id", "week", "provider", "content_hash"],
        { unique: true, name: "schedule_snapshot_version_unique" }
      );
    }

    if (!(await hasTable(queryInterface, "league_week_operation"))) {
      await queryInterface.createTable("league_week_operation", {
        id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          autoIncrement: true,
          primaryKey: true,
        },
        league_season_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: "league_season", key: "id" },
        },
        week: { type: Sequelize.INTEGER, allowNull: false },
        phase: {
          type: Sequelize.ENUM("START_SEASON", "AUTO_PICK", "CLOSE_WEEK"),
          allowNull: false,
        },
        mode: { type: Sequelize.STRING, allowNull: false },
        schedule_hash: { type: Sequelize.STRING(64), allowNull: true },
        summary: { type: Sequelize.JSON, allowNull: false },
        completed_at: { type: Sequelize.DATE, allowNull: false },
      });
      await queryInterface.addIndex(
        "league_week_operation",
        ["league_season_id", "week", "phase"],
        { unique: true, name: "league_week_operation_phase_unique" }
      );
    }
  },

  async down() {
    throw new Error("League Season foundation migration is forward-only");
  },
};
