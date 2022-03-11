const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/connection');

// create Pick model
class Pick extends Model {}

Pick.init(
    {
        id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            primaryKey: true,
            autoIncrement: true
        },
        picked_team: {
            type: DataTypes.STRING,
            allowNull: false
        },
        track_id: {
            type: DataTypes.STRING,
            allowNull: false,
            references: {
                model: 'track',
                key: 'id'
            }
        },
/*         user_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'user',
                key: 'id'
            }
        }, */
    },
    {
        sequelize,
        timestamps: false,
        freezeTableName: true,
        underscored: true,
        modelName: 'pick'
    }
)

module.exports = Pick;