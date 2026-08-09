'use strict';

const { app } = require('electron');
const { AppRuntime } = require('./modules/app-runtime.module');

const runtime = new AppRuntime(app);
runtime.initialize();
runtime.registerIpc();
runtime.manageLifecycle();
