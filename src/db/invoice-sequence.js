const { dbAdapter } = require('./db-adapter');

// Initialize invoice_sequence table
async function initInvoiceSequence() {

  const conn = await dbAdapter.getConnection();
  try {
    console.log('Initializing invoice_sequence table...');

    // Create invoice_sequence table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS invoice_sequence (
        id INT PRIMARY KEY DEFAULT 1,
        current_number INT NOT NULL DEFAULT 0,
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CHECK (id = 1)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Insert initial row if not exists
    const [rows] = await conn.query('SELECT COUNT(*) as count FROM invoice_sequence');
    if (rows[0].count === 0) {
      // Get the highest invoice number from sales table
      const [salesRows] = await conn.query('SELECT IFNULL(MAX(id), 0) as max_id FROM sales');
      const maxId = salesRows[0].max_id || 0;
      
      await conn.query('INSERT INTO invoice_sequence (id, current_number) VALUES (1, ?)', [maxId]);
      console.log(`✓ Invoice sequence initialized with start number: ${maxId + 1}`);
    } else {
      console.log('✓ Invoice sequence table already exists');
    }

    // Create reserved_numbers table to track allocated numbers
    await conn.query(`
      CREATE TABLE IF NOT EXISTS reserved_invoice_numbers (
        invoice_number INT PRIMARY KEY,
        device_id VARCHAR(64) NOT NULL,
        reserved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        used TINYINT DEFAULT 0,
        INDEX idx_device (device_id),
        INDEX idx_reserved_at (reserved_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    console.log('✓ Reserved invoice numbers table ready');

  } finally {
    conn.release();
  }
}

// Get next invoice number (atomically) — optimized: 2 round trips instead of 6
async function getNextInvoiceNumber(deviceId) {

  const conn = await dbAdapter.getConnection();
  try {
    // RT 1: Atomic increment using LAST_INSERT_ID trick — no transaction needed,
    //        InnoDB row-lock on the UPDATE serializes concurrent calls automatically.
    await conn.query(
      'UPDATE invoice_sequence SET current_number = LAST_INSERT_ID(current_number + 1) WHERE id = 1'
    );

    // RT 2: Capture the number and reserve it in one multi-statement round trip
    const [results] = await conn.query(
      'SET @inv_num = LAST_INSERT_ID(); ' +
      'INSERT INTO reserved_invoice_numbers (invoice_number, device_id) VALUES (@inv_num, ?); ' +
      'SELECT @inv_num AS new_number;',
      [deviceId]
    );
    const invoiceNumber = results[2][0].new_number;

    console.log(`✓ Reserved invoice number ${invoiceNumber} for device ${deviceId}`);
    return invoiceNumber;

  } catch (err) {
    throw err;
  } finally {
    conn.release();
  }
}

// Mark invoice number as used
async function markInvoiceNumberUsed(invoiceNumber, deviceId) {

  const conn = await dbAdapter.getConnection();
  try {
    await conn.query(
      'UPDATE reserved_invoice_numbers SET used = 1 WHERE invoice_number = ? AND device_id = ?',
      [invoiceNumber, deviceId]
    );
  } finally {
    conn.release();
  }
}

// Get current sequence number (read-only)
async function getCurrentSequenceNumber() {
  const conn = await dbAdapter.getConnection();
  try {
    const [rows] = await conn.query('SELECT current_number FROM invoice_sequence WHERE id = 1');
    return rows[0]?.current_number || 0;
  } finally {
    conn.release();
  }
}

// Clean old unused reservations (older than 1 hour)
async function cleanOldReservations() {
  if (IS_BRANCH) return;

  const conn = await dbAdapter.getConnection();
  try {
    const [result] = await conn.query(
      'DELETE FROM reserved_invoice_numbers WHERE used = 0 AND reserved_at < DATE_SUB(NOW(), INTERVAL 1 HOUR)'
    );
    
    if (result.affectedRows > 0) {
      console.log(`✓ Cleaned ${result.affectedRows} old invoice reservations`);
    }
  } finally {
    conn.release();
  }
}

module.exports = {
  initInvoiceSequence,
  getNextInvoiceNumber,
  markInvoiceNumberUsed,
  getCurrentSequenceNumber,
  cleanOldReservations
};
