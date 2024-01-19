import {DataTypes, Sequelize} from 'sequelize';

export function createToothVersionModel(sequelize: Sequelize) {
  return sequelize.define(
      'ToothVersion',
      {
        repoOwner: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        repoName: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        version: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        releasedAt: {
          type: DataTypes.DATE,
          allowNull: false,
        },
        isLatest: {
          type: DataTypes.BOOLEAN,
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
        avatarUrl: {
          type: DataTypes.STRING,
        },
        source: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        updatedAt: {
          // For LRU cache.
          type: DataTypes.DATE,
          allowNull: false,
        },
      },
      {
        indexes: [
          {
            unique: true,
            fields: ['repoOwner', 'repoName', 'version'],
          },
        ]
      },
  );
}
