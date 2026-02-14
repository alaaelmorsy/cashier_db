// Database Adapter - MySQL connection wrapper
const dbModule = require('./connection');
const DB_NAME = dbModule.DB_NAME;

// Universal query interface
class DBAdapter {
  constructor() {
    this.dbType = 'mysql';
  }

  // Get connection (MySQL pool)
  async getConnection() {
    const pool = await dbModule.getPool();
    const conn = await pool.getConnection();
    await conn.query(`USE \`${DB_NAME}\``);
    return conn;
  }

  // Execute query with automatic connection management
  async query(sql, params = []) {
    const conn = await this.getConnection();
    try {
      const result = await conn.query(sql, params);
      return result;
    } finally {
      conn.release();
    }
  }

  // Execute multiple queries in a transaction
  async transaction(callback) {
    const conn = await this.getConnection();
    try {
      await conn.beginTransaction();
      const result = await callback(conn);
      await conn.commit();
      return result;
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  // Get database name
  getDatabaseName() {
    return DB_NAME;
  }

  // Check if column exists
  async columnExists(tableName, columnName) {
    try {
      const [[row]] = await this.query(
        `SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
        [DB_NAME, tableName, columnName]
      );
      return row.count > 0;
    } catch (err) {
      console.error('columnExists error:', err);
      return false;
    }
  }

  // Check if table exists
  async tableExists(tableName) {
    try {
      const [rows] = await this.query(
        `SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.TABLES 
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
        [DB_NAME, tableName]
      );
      return rows && rows[0] && rows[0].count > 0;
    } catch (err) {
      console.error('tableExists error:', err);
      return false;
    }
  }

  // Get last insert ID
  async getLastInsertId(conn) {
    const [[row]] = await conn.query('SELECT LAST_INSERT_ID() as id');
    return row.id;
  }

  // Close connection (for app shutdown)
  async close() {
    // MySQL pool will be closed by the app
  }
}

// Singleton instance
const dbAdapter = new DBAdapter();

module.exports = {
  dbAdapter,
  DB_NAME
};
