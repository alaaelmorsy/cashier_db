/**
 * Fix old supplier credit invoices that were incorrectly changed to 'cash' payment method
 * when they were fully paid via payment vouchers.
 * 
 * This script restores the payment_method to 'credit' for reporting purposes,
 * so the Supplier Statement report shows the correct deferred invoices total.
 * 
 * Usage: node fix-old-credit-invoices.js
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixOldCreditInvoices() {
  console.log('🔧 Starting fix for old credit invoices...\n');

  // Create connection
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'pos_db'
  });

  try {
    // Step 1: Find invoices that have payments but were changed to 'cash'
    // These should be 'credit' invoices based on payment history
    const [invoicesToFix] = await connection.query(`
      SELECT DISTINCT 
        pi.id,
        pi.invoice_no,
        pi.payment_method,
        pi.grand_total,
        pi.amount_paid,
        pi.amount_due,
        pi.supplier_id,
        s.name as supplier_name
      FROM purchase_invoices pi
      INNER JOIN purchase_payments pp ON pi.id = pp.purchase_id
      LEFT JOIN suppliers s ON pi.supplier_id = s.id
      WHERE pi.doc_type = 'invoice'
        AND pi.payment_method = 'cash'
        AND pi.amount_paid > 0
      ORDER BY pi.id DESC
    `);

    console.log(`📊 Found ${invoicesToFix.length} invoices that may need fixing\n`);

    if (invoicesToFix.length === 0) {
      console.log('✅ No invoices need fixing!');
      return;
    }

    // Show preview
    console.log('📋 Invoices to fix:');
    console.log('─'.repeat(100));
    console.log('%-10s | %-20s | %-25s | %-12s | %-12s | %-10s', 
      'ID', 'Invoice No', 'Supplier', 'Grand Total', 'Amount Paid', 'Current Method');
    console.log('─'.repeat(100));

    invoicesToFix.forEach(inv => {
      console.log('%-10s | %-20s | %-25s | %-12s | %-12s | %-10s',
        inv.id,
        inv.invoice_no,
        (inv.supplier_name || 'N/A').substring(0, 25),
        Number(inv.grand_total).toFixed(2),
        Number(inv.amount_paid).toFixed(2),
        inv.payment_method
      );
    });
    console.log('─'.repeat(100));
    console.log('');

    // Ask for confirmation
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const answer = await new Promise(resolve => {
      rl.question('❓ Do you want to fix these invoices? (yes/no): ', resolve);
    });
    rl.close();

    if (answer.toLowerCase() !== 'yes') {
      console.log('❌ Operation cancelled.');
      return;
    }

    // Step 2: Update the invoices
    let fixedCount = 0;
    for (const inv of invoicesToFix) {
      await connection.query(
        'UPDATE purchase_invoices SET payment_method = ? WHERE id = ?',
        ['credit', inv.id]
      );
      fixedCount++;
      console.log(`✅ Fixed invoice ${inv.invoice_no} (ID: ${inv.id})`);
    }

    console.log('\n' + '='.repeat(100));
    console.log(`🎉 Successfully fixed ${fixedCount} invoices!`);
    console.log('='.repeat(100));
    console.log('\n📝 Summary:');
    console.log(`   - ${fixedCount} invoices changed from 'cash' to 'credit'`);
    console.log('   - Supplier Statement report will now show correct deferred totals');
    console.log('   - Payment vouchers still track the actual payments');
    console.log('');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

// Run the fix
fixOldCreditInvoices().catch(console.error);
