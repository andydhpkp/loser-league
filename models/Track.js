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
            type: DataTypes.TEXT,
            allowNull: false,
            get() {
                return this.getDataValue('available_picks').split(';');
            },
            set(val) {
                this.setDataValue('available_picks',val.join(';'));
            },
        },
        //figure out how to make sure available != used 
        used_picks: {
            type: DataTypes.TEXT,
            allowNull: true,
            get() {
                return this.getDataValue('used_picks').split(';');
            },
            set(val) {
                this.setDataValue('used_picks',val.join(';'));
            }
        },
        current_pick: {
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