const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/connection');

// create Team model
class Team extends Model {}

Team.init(
    {
        id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            primaryKey: true,
            autoIncrement: true
        },
        team_name: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        team_logo: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        team_record: {
            //type: DataTypes.ARRAY(DataTypes.INTEGER),
            type: DataTypes.STRING,
            allowNull: true,
            get() {
                return this.getDataValue('team_record').split(',');
            },
            set(val) {
                this.setDataValue('team_record',val.join(','));
            }
        },
    },
    {
        sequelize,
        timestamps: false,
        freezeTableName: true,
        underscored: true,
        modelName: 'team'
    }
)

module.exports = Team;