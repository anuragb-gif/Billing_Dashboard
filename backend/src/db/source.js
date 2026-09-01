const sql = require('mssql');
require('dotenv').config();

const config = {
  server: process.env.SQL_SERVER,
  database: process.env.SQL_DATABASE,
  user: process.env.SQL_USER,
  password: process.env.SQL_PASSWORD,
  port: Number(process.env.SQL_PORT || 1433),
  options: {
    encrypt: (process.env.SQL_ENCRYPT || 'true') === 'true',
    trustServerCertificate: (process.env.SQL_TRUST_SERVER_CERT || 'true') === 'true',
  },
  // These are large reporting queries and the nightly run competes with other
  // 2 AM jobs on the SQL Server, so give each query plenty of room.
  requestTimeout: Number(process.env.SQL_REQUEST_TIMEOUT_MS || 25 * 60 * 1000), // 25 min
  pool: { max: 5, min: 0, idleTimeoutMillis: 30000 },
};

let poolPromise;

function getPool() {
  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool(config)
      .connect()
      .catch((err) => {
        poolPromise = null; // allow retry on next call instead of caching a dead connection
        throw err;
      });
  }
  return poolPromise;
}

async function runQuery(queryText) {
  const pool = await getPool();
  const result = await pool.request().query(queryText);
  return result.recordset;
}

module.exports = { getPool, runQuery, sql };
