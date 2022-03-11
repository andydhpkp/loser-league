const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/connection');

// create Track model
class Track extends Model {}

Track.init(
    {
        id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            primaryKey: true,
            autoIncrement: true
        },
        available_picks: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        //figure out how to make sure available != used
        used_picks: {
            type: DataTypes.STRING,
            allowNull: true
        },
        user_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'user',
                key: 'id'
            }
        },
    },
    {
        sequelize,
        timestamps: false,
        freezeTableName: true,
        underscored: true,
        modelName: 'track'
    }
)

module.exports = Track;