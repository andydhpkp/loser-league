const { Model, DataTypes } = require("sequelize");
const sequelize = require("../config/connection");

class TrackReactivation extends Model {}

TrackReactivation.init({
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  track_id: { type: DataTypes.INTEGER, allowNull: false },
  league_season_id: { type: DataTypes.INTEGER, allowNull: false },
  waived_pick_id: { type: DataTypes.INTEGER, allowNull: false, unique: true },
  admin_audit_operation_id: { type: DataTypes.INTEGER, allowNull: false, unique: true },
}, {
  sequelize,
  freezeTableName: true,
  underscored: true,
  modelName: "track_reactivation",
  updatedAt: false,
});

module.exports = TrackReactivation;
