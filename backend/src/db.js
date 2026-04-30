const mysql = require("mysql2/promise");

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required. Copy .env.example to .env and configure MySQL.");
}

const pool = mysql.createPool(connectionString);

async function query(sql, params) {
  const [rows, fields] = await pool.query(sql, params);
  return { rows, fields };
}

async function connect() {
  const connection = await pool.getConnection();

  return {
    query: async (sql, params) => {
      const [rows, fields] = await connection.query(sql, params);
      return { rows, fields };
    },
    release: () => connection.release()
  };
}

module.exports = {
  query,
  pool: {
    connect,
    end: () => pool.end()
  }
};
