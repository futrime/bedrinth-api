'user strict'

import{DataTypes} from 'sequelize';


/**
 * Create the Tooth model.
 * @param {import('sequelize').Sequelize} sequelize The Sequelize instance.
 * @return {import('sequelize').Model} The Tooth model.
 */
export default (sequelize) => sequelize.define('Tooth', {
  toothRepoPath: {
    type: DataTypes.STRING,
    allowNull: false,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  description: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  author: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  tags: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    allowNull: false,
  },
  versions: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    allowNull: false,
  }
})
