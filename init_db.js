const { Pool } = require('pg');
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,  // will be 'postgres' because it's the service name
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});
(async () => {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS originals (
        id SERIAL PRIMARY KEY,
        keyword TEXT,
        src TEXT,
        creative TEXT,
        hash_method INTEGER,
        timestamp_field TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `);
    //index is created to manage loads when reading many records in a table
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS originals_unique_idx
ON originals (keyword, src, creative)`);
    console.log('Table created!');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    client.release();
  }
})();