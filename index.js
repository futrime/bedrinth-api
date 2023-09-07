'use strict'

import 'dotenv/config';

import {consola} from 'consola';
import cors from 'cors';
import express from 'express';
import morgan from 'morgan';
import process from 'process';
import {Sequelize} from 'sequelize';

import {router as routerSearchTeeth} from './routes/search/teeth.js';
import {router as routerTeeth} from './routes/teeth.js';
import createToothModel from './models/tooth.js';
import {GitHubBot} from './lib/github_bot.js';

try {
  // Apply default configuration if not set.
  process.env.GITHUB_BOT_EXPIRE = process.env.GITHUB_BOT_EXPIRE || '600';
  process.env.GITHUB_BOT_INTERVAL = process.env.GITHUB_BOT_INTERVAL || '60';
  process.env.GITHUB_BOT_TOKEN = process.env.GITHUB_BOT_TOKEN || undefined;
  process.env.LISTEN_PORT = process.env.LISTEN_PORT || '11400';
  process.env.LOG_LEVEL = process.env.LOG_LEVEL || '3';
  process.env.POSTGRES_HOST = process.env.POSTGRES_HOST || 'postgres';
  process.env.POSTGRES_PORT = process.env.POSTGRES_PORT || '5432';
  process.env.POSTGRES_USER = process.env.POSTGRES_USER || 'postgres';
  process.env.POSTGRES_PASSWORD = process.env.POSTGRES_PASSWORD || 'postgres';
  process.env.POSTGRES_DATABASE = process.env.POSTGRES_DATABASE || 'postgres';

  // Configure logging.
  consola.level = Number(process.env.LOG_LEVEL);

  // Instantiate database connection.
  const sequelize = new Sequelize(
      process.env.POSTGRES_DATABASE, process.env.POSTGRES_USER,
      process.env.POSTGRES_PASSWORD, {
        host: process.env.POSTGRES_HOST,
        port: Number(process.env.POSTGRES_PORT),
        dialect: 'postgres',
        logging: false,
      });

  try {
    await sequelize.authenticate();
  } catch (err) {
    throw new Error(`Failed to connect to database: ${err.message}`);
  }

  const toothModel = createToothModel(sequelize);
  await Promise.all([
    toothModel.sync(),
  ])

  // Start API server.
  const app = express();

  app.use(morgan('tiny'));
  app.use(cors());
  app.use(express.urlencoded({extended: false}));

  app.use((req, _, next) => {
    req.context = {
      toothModel: createToothModel(sequelize),
    };
    next();
  });

  app.use('/search/teeth', routerSearchTeeth);
  app.use('/teeth', routerTeeth);

  app.use((_, res) => {
    res.status(404).send({
      code: 404,
      message: 'Not found.',
    });
  });  // Set default route.

  app.listen(Number(process.env.LISTEN_PORT), () => {
    consola.info(`Server is listening on port ${process.env.LISTEN_PORT}`);
  });

  // Start GitHub bot.
  const bot = new GitHubBot(
      toothModel, Number(process.env.GITHUB_BOT_INTERVAL),
      Number(process.env.GITHUB_BOT_EXPIRE), process.env.GITHUB_BOT_TOKEN);
  await bot.start();

} catch (err) {
  consola.error(err);
}
