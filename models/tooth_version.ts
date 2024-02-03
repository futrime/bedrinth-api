import {DataTypes, InferAttributes, InferCreationAttributes, Model, Sequelize} from 'sequelize';

export class ToothVersionModel extends Model<
    InferAttributes<ToothVersionModel>,
    InferCreationAttributes<ToothVersionModel>> {
  declare repoOwner: string;
  declare repoName: string;
  declare version: string;
  declare isLatest: boolean;
  declare releasedAt: Date;

  declare name: string;
  declare description: string;
  declare author: string;
  declare tags: string[];
  declare avatarUrl: string|null;

  declare repoCreatedAt: Date;
  declare starCount: number;

  declare updatedAt: Date;
}

export function createToothVersionModel(sequelize: Sequelize):
    typeof ToothVersionModel {
  return ToothVersionModel.init(
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
        isLatest: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
        },
        releasedAt: {
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
        avatarUrl: {
          type: DataTypes.STRING,
        },
        repoCreatedAt: {
          type: DataTypes.DATE,
          allowNull: false,
        },
        starCount: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
        updatedAt: {
          // For LRU cache.
          type: DataTypes.DATE,
          allowNull: false,
        },
      },
      {
        sequelize,
        modelName: 'ToothVersion',
        indexes: [
          {
            unique: true,
            fields: ['repoOwner', 'repoName', 'version'],
          },
        ]
      },
  );
}
