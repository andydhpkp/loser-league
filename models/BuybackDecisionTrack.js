const { Model, DataTypes } = require("sequelize");
const sequelize = require("../config/connection");

class BuybackDecisionTrack extends Model {}
BuybackDecisionTrack.init({
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  buyback_decision_id: { type: DataTypes.INTEGER, allowNull: false },
  track_id: { type: DataTypes.INTEGER, allowNull: false },
  week_one_pick_id: { type: DataTypes.INTEGER, allowNull: false },
  resolution: { type: DataTypes.ENUM("PENDING", "FULFILLED", "UNFULFILLED"), allowNull: false },
  track_reactivation_id: { type: DataTypes.INTEGER, allowNull: true },
}, { sequelize, freezeTableName: true, underscored: true, modelName: "buyback_decision_track", updatedAt: false });
module.exports = BuybackDecisionTrack;
