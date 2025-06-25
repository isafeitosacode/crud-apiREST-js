// db/knex.js
const knex = require('knex');
const configuration = require('../knexfile');

// Detecta o ambiente. No Render será 'production'. No seu PC, 'development'.
const environment = process.env.NODE_ENV || 'development';

const connection = knex(configuration[environment]);

module.exports = connection;