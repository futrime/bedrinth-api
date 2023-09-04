'use strict'

import * as express from 'express';

import {getToothController} from '../controllers/get_tooth_controller.js';


export const router = express.Router();

router.get('/:tooth/:version', getToothController);
