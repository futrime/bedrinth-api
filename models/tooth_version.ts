import {DataTypes, Sequelize} from 'sequelize';

export function createToothVersionModel(sequelize: Sequelize) {
  return sequelize.define('ToothVersion', {
    toothRepoPath: {
      type: DataTypes.STRING,
      allowNull: false,
      primaryKey: true,
    },
    toothRepoOwner: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    toothRepoName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    version: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
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
    avartarUrl: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    source: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  });
}
