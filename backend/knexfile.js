// knexfile.js
require('dotenv').config();

module.exports = {
  // Configuração para rodar no seu PC
  development: {
    client: 'pg', // Usando PostgreSQL
    connection: {
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_DATABASE
    },
    migrations: {
      tableName: 'knex_migrations'
    }
  },

  // Configuração que o RENDER usará
  production: {
    client: 'pg', // Usando PostgreSQL
    connection: {
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false } // Exigência do Render
    },
    migrations: {
      tableName: 'knex_migrations'
    }
  }
};