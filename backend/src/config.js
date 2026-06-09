'use strict';

const path = require('path');

// Hardcoded user baked into the app (no auth for this iteration).
const CURRENT_USER = {
  id: 1,
  name: 'Juan Loaiza',
  email: 'juan.loaiza@y.uno',
  role: 'seller',
  avatar: 'JL',
};

module.exports = {
  PORT: process.env.PORT || 3000,
  // Single SQLite file. Lives under /data so it can be mounted as a Docker volume.
  DB_PATH: process.env.DB_PATH || path.join(__dirname, '..', 'data', 'marketplace.db'),
  CURRENT_USER,
};
