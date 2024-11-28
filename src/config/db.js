const { Client } = require('pg');
require('dotenv').config();

const db = new Client({
    user: process.env.PG_USER,
    host: process.env.PG_HOST,
    database: process.env.PG_DATABASE,
    password: process.env.PG_PASSWORD,
    port: process.env.PG_PORT,
});

db.connect()
    .then(() => console.log('Подключение к базе данных установлено'))
    .catch((err) => console.error('Ошибка подключения к базе данных:', err));

module.exports = db;



