const { Model, DataTypes } = require("sequelize"); const sequelize = require("../config/connection");
class EmailOptOutToken extends Model {}
EmailOptOutToken.init({ id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true }, user_id: { type: DataTypes.INTEGER, allowNull: false }, token_digest: { type: DataTypes.CHAR(64), allowNull: false, unique: true }, key_version: { type: DataTypes.STRING(32), allowNull: false }, security_version: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false }, expires_at: { type: DataTypes.DATE, allowNull: false }, used_at: { type: DataTypes.DATE, allowNull: true } }, { sequelize, freezeTableName: true, underscored: true, modelName: "email_opt_out_token" });
module.exports = EmailOptOutToken;
