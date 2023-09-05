'use strict'

import 'dotenv/config';

import {consola} from 'consola';
import cors from 'cors';
import express from 'express';
import morgan from 'morgan';
import process from 'process';

import {router as routerSearchTeeth} from './routes/search/teeth.js';
import {router as routerTeeth} from './routes/teeth.js';


// Apply default configuration if not set.
process.env.LISTEN_PORT = process.env.LISTEN_PORT || 11400;
process.env.LOG_LEVEL = process.env.LOG_LEVEL || 3;

// Configure logging.
consola.level = process.env.LOG_LEVEL;

// Start API server.
const app = express();

app.use(morgan('tiny'));
app.use(cors());
app.use(express.urlencoded({extended: false}));

app.use('/search/teeth', routerSearchTeeth);
app.use('/teeth', routerTeeth);

// Set default route.
app.use((_, res) => {
  res.status(404).send({
    code: 404,
    message: 'Not found.',
  });
});

app.listen(process.env.LISTEN_PORT, () => {
  consola.info(`Server is listening on port ${process.env.LISTEN_PORT}`);
});
