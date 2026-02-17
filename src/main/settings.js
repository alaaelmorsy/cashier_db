// App Settings IPC: read/save settings like company info, VAT, pricing mode, location, payment methods, currency
const { ipcMain } = require('electron');
const { dbAdapter, DB_NAME } = require('../db/db-adapter');

function registerSettingsIPC(){
  async function ensureTable(conn){
    // Base table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS app_settings (
        id INT PRIMARY KEY,
        company_name VARCHAR(255) NULL,
        company_site VARCHAR(255) NULL,
        mobile VARCHAR(50) NULL,
        email VARCHAR(255) NULL,
        logo_path VARCHAR(512) NULL,
        vat_percent DECIMAL(5,2) NOT NULL DEFAULT 15.00,
        prices_include_vat TINYINT NOT NULL DEFAULT 1,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Add new columns if missing (progressive schema upgrade)
    const missing = async (name) => {
      return !(await dbAdapter.columnExists('app_settings', name));
    };
    // Cost includes VAT setting
    if(await missing('cost_includes_vat')){
      await conn.query("ALTER TABLE app_settings ADD COLUMN cost_includes_vat TINYINT NOT NULL DEFAULT 1 AFTER prices_include_vat");
    }
    // Tobacco fee settings
    if(await missing('tobacco_fee_percent')){
      await conn.query("ALTER TABLE app_settings ADD COLUMN tobacco_fee_percent DECIMAL(6,2) NULL AFTER cost_includes_vat");
    }
    if(await missing('tobacco_min_invoice_sub')){
      await conn.query("ALTER TABLE app_settings ADD COLUMN tobacco_min_invoice_sub DECIMAL(12,2) NULL AFTER tobacco_fee_percent");
    }
    if(await missing('tobacco_min_fee_amount')){
      await conn.query("ALTER TABLE app_settings ADD COLUMN tobacco_min_fee_amount DECIMAL(12,2) NULL AFTER tobacco_min_invoice_sub");
    }
    if(await missing('company_location')){
      await conn.query('ALTER TABLE app_settings ADD COLUMN company_location VARCHAR(255) NULL AFTER company_site');
    }
    if(await missing('payment_methods')){
      await conn.query('ALTER TABLE app_settings ADD COLUMN payment_methods TEXT NULL AFTER email');
    }
    if(await missing('currency_code')){
      await conn.query("ALTER TABLE app_settings ADD COLUMN currency_code VARCHAR(8) NULL DEFAULT 'SAR' AFTER payment_methods");
    }
    if(await missing('currency_symbol')){
      await conn.query("ALTER TABLE app_settings ADD COLUMN currency_symbol VARCHAR(8) NULL DEFAULT '﷼' AFTER currency_code");
    }
    if(await missing('currency_symbol_position')){
      await conn.query("ALTER TABLE app_settings ADD COLUMN currency_symbol_position ENUM('before','after') NOT NULL DEFAULT 'after' AFTER currency_symbol");
    }
    // App locale column (resilient to races and MySQL versions)
    if(await missing('app_locale')){
      try{
        await conn.query("ALTER TABLE app_settings ADD COLUMN app_locale VARCHAR(5) NOT NULL DEFAULT 'ar' AFTER currency_symbol_position");
      }catch(_){ /* ignore if already exists */ }
    }
    // Print margins (right/left) in millimeters
    if(await missing('print_margin_right_mm')){
      await conn.query("ALTER TABLE app_settings ADD COLUMN print_margin_right_mm DECIMAL(6,2) NULL AFTER print_copies");
    }
    if(await missing('print_margin_left_mm')){
      await conn.query("ALTER TABLE app_settings ADD COLUMN print_margin_left_mm DECIMAL(6,2) NULL AFTER print_margin_right_mm");
    }
    // Ensure legal name column exists
    if(await missing('seller_legal_name')){
      await conn.query("ALTER TABLE app_settings ADD COLUMN seller_legal_name VARCHAR(255) NULL AFTER email");
    }
    if(await missing('seller_vat_number')){
      await conn.query("ALTER TABLE app_settings ADD COLUMN seller_vat_number VARCHAR(32) NULL AFTER seller_legal_name");
    }
    // English fields for A4
    if(await missing('seller_legal_name_en')){
      await conn.query("ALTER TABLE app_settings ADD COLUMN seller_legal_name_en VARCHAR(255) NULL AFTER seller_legal_name");
    }
    if(await missing('company_location_en')){
      await conn.query("ALTER TABLE app_settings ADD COLUMN company_location_en VARCHAR(255) NULL AFTER company_location");
    }
    // New fields: commercial register and national number
    if(await missing('commercial_register')){
      await conn.query("ALTER TABLE app_settings ADD COLUMN commercial_register VARCHAR(64) NULL AFTER seller_vat_number");
    }
    if(await missing('national_number')){
      await conn.query("ALTER TABLE app_settings ADD COLUMN national_number VARCHAR(64) NULL AFTER commercial_register");
    }
    if(await missing('show_email_in_invoice')){
      await conn.query("ALTER TABLE app_settings ADD COLUMN show_email_in_invoice TINYINT NOT NULL DEFAULT 1 AFTER email");
    }
    // Drop legacy company_name column if exists
    if(await dbAdapter.columnExists('app_settings', 'company_name')){
      try{ await conn.query("ALTER TABLE app_settings DROP COLUMN company_name"); }catch(_){ }
    }
    if(await missing('default_print_format')){
      await conn.query("ALTER TABLE app_settings ADD COLUMN default_print_format ENUM('thermal','a4') NOT NULL DEFAULT 'thermal' AFTER currency_symbol_position");
    }
    if(await missing('print_copies')){
      await conn.query("ALTER TABLE app_settings ADD COLUMN print_copies INT NOT NULL DEFAULT 1 AFTER default_print_format");
    }
    // keep print_two_copies for backward compat (will be ignored on save)
    if(await missing('print_two_copies')){
      await conn.query("ALTER TABLE app_settings ADD COLUMN print_two_copies TINYINT NOT NULL DEFAULT 0 AFTER print_copies");
    }
    if(await missing('print_show_change')){
      await conn.query("ALTER TABLE app_settings ADD COLUMN print_show_change TINYINT NOT NULL DEFAULT 1 AFTER print_two_copies");
    }
    if(await missing('show_barcode_in_a4')){
      await conn.query("ALTER TABLE app_settings ADD COLUMN show_barcode_in_a4 TINYINT NOT NULL DEFAULT 0 AFTER print_show_change");
    }
    if(await missing('unit_price_label')){
      await conn.query("ALTER TABLE app_settings ADD COLUMN unit_price_label VARCHAR(64) NULL DEFAULT 'سعر القطعة' AFTER show_barcode_in_a4");
    }
    if(await missing('quantity_label')){
      await conn.query("ALTER TABLE app_settings ADD COLUMN quantity_label VARCHAR(64) NULL DEFAULT 'عدد' AFTER unit_price_label");
    }
    // WhatsApp on print options
    if(await missing('whatsapp_on_print')){
      await conn.query("ALTER TABLE app_settings ADD COLUMN whatsapp_on_print TINYINT NOT NULL DEFAULT 0 AFTER print_show_change");
    }
    if(await missing('whatsapp_auto_connect')){
      await conn.query("ALTER TABLE app_settings ADD COLUMN whatsapp_auto_connect TINYINT NOT NULL DEFAULT 0 AFTER whatsapp_on_print");
    }
    if(await missing('whatsapp_message')){
      await conn.query("ALTER TABLE app_settings ADD COLUMN whatsapp_message TEXT NULL AFTER whatsapp_auto_connect");
    }
    if(await missing('default_payment_method')){
      await conn.query("ALTER TABLE app_settings ADD COLUMN default_payment_method VARCHAR(32) NULL AFTER payment_methods");
    }
    if(await missing('op_price_manual')){
      await conn.query("ALTER TABLE app_settings ADD COLUMN op_price_manual TINYINT NOT NULL DEFAULT 0 AFTER print_show_change");
    }
    if(await missing('allow_sell_zero_stock')){
      await conn.query("ALTER TABLE app_settings ADD COLUMN allow_sell_zero_stock TINYINT NOT NULL DEFAULT 0 AFTER op_price_manual");
    }
    if(await missing('allow_negative_inventory')){
      await conn.query("ALTER TABLE app_settings ADD COLUMN allow_negative_inventory TINYINT NOT NULL DEFAULT 0 AFTER allow_sell_zero_stock");
    }
    if(await missing('cart_separate_duplicate_lines')){
      await conn.query("ALTER TABLE app_settings ADD COLUMN cart_separate_duplicate_lines TINYINT NOT NULL DEFAULT 0 AFTER allow_negative_inventory");
    }
    // Low stock alert threshold (units in products.stock)
    if(await missing('low_stock_threshold')){
      await conn.query("ALTER TABLE app_settings ADD COLUMN low_stock_threshold INT NOT NULL DEFAULT 5 AFTER allow_negative_inventory");
    }
    // Toggle: show/hide low-stock alerts in Sales UI
    if(await missing('show_low_stock_alerts')){
      await conn.query("ALTER TABLE app_settings ADD COLUMN show_low_stock_alerts TINYINT NOT NULL DEFAULT 1 AFTER low_stock_threshold");
    }
    // New: Weight mode toggle (amount -> weight)
    if(await missing('weight_mode_enabled')){
      await conn.query("ALTER TABLE app_settings ADD COLUMN weight_mode_enabled TINYINT NOT NULL DEFAULT 0 AFTER show_low_stock_alerts");
    }
    // Electronic scale settings
    if(await missing('electronic_scale_enabled')){
      await conn.query("ALTER TABLE app_settings ADD COLUMN electronic_scale_enabled TINYINT NOT NULL DEFAULT 0 AFTER weight_mode_enabled");
    }
    if(await missing('electronic_scale_type')){
      await conn.query("ALTER TABLE app_settings ADD COLUMN electronic_scale_type ENUM('weight','price') NOT NULL DEFAULT 'weight' AFTER electronic_scale_enabled");
    }
    // Low stock email settings
    if(await missing('low_stock_email_enabled')){
      await conn.query("ALTER TABLE app_settings ADD COLUMN low_stock_email_enabled TINYINT NOT NULL DEFAULT 0 AFTER low_stock_threshold");
    }
    if(await missing('low_stock_email_per_item')){
      await conn.query("ALTER TABLE app_settings ADD COLUMN low_stock_email_per_item TINYINT NOT NULL DEFAULT 1 AFTER low_stock_email_enabled");
    }
    if(await missing('low_stock_email_cooldown_hours')){
      await conn.query("ALTER TABLE app_settings ADD COLUMN low_stock_email_cooldown_hours INT NOT NULL DEFAULT 24 AFTER low_stock_email_per_item");
    }
    if(await missing('silent_print')){
      await conn.query("ALTER TABLE app_settings ADD COLUMN silent_print TINYINT NOT NULL DEFAULT 0 AFTER print_two_copies");
    }
    // Logo stored in DB (BLOB) similar to products; keep legacy path for backward compat
    if(await missing('logo_blob')){
      await conn.query("ALTER TABLE app_settings ADD COLUMN logo_blob LONGBLOB NULL AFTER logo_path");
    }
    if(await missing('logo_mime')){
      await conn.query("ALTER TABLE app_settings ADD COLUMN logo_mime VARCHAR(64) NULL AFTER logo_blob");
    }
    if(await missing('logo_width_px')){
      await conn.query("ALTER TABLE app_settings ADD COLUMN logo_width_px SMALLINT UNSIGNED NULL AFTER logo_path");
    }
    if(await missing('logo_height_px')){
      await conn.query("ALTER TABLE app_settings ADD COLUMN logo_height_px SMALLINT UNSIGNED NULL AFTER logo_width_px");
    }
    // Default product image stored in DB (BLOB + MIME)
    if(await missing('default_product_img_blob')){
      await conn.query("ALTER TABLE app_settings ADD COLUMN default_product_img_blob LONGBLOB NULL AFTER logo_mime");
    }
    if(await missing('default_product_img_mime')){
      await conn.query("ALTER TABLE app_settings ADD COLUMN default_product_img_mime VARCHAR(64) NULL AFTER default_product_img_blob");
    }
    if(await missing('invoice_footer_note')){
      await conn.query("ALTER TABLE app_settings ADD COLUMN invoice_footer_note TEXT NULL AFTER email");
    }
    if(await missing('hide_product_images')){
      await conn.query("ALTER TABLE app_settings ADD COLUMN hide_product_images TINYINT NOT NULL DEFAULT 0 AFTER default_payment_method");
    }
    // اسم الفرع
    if(await missing('branch_name')){
      await conn.query("ALTER TABLE app_settings ADD COLUMN branch_name VARCHAR(255) NULL AFTER company_location_en");
    }
    if(await missing('closing_hour')){
      await conn.query("ALTER TABLE app_settings ADD COLUMN closing_hour TIME NULL AFTER hide_product_images");
    }
    if(await missing('zatca_enabled')){
      await conn.query("ALTER TABLE app_settings ADD COLUMN zatca_enabled TINYINT NOT NULL DEFAULT 0 AFTER closing_hour");
    }
    // UI toggle for WhatsApp controls (show/hide via SQL query)
    if(await missing('show_whatsapp_controls')){
      await conn.query("ALTER TABLE app_settings ADD COLUMN show_whatsapp_controls TINYINT NOT NULL DEFAULT 1 AFTER zatca_enabled");
    }
    // UI toggle for Quotation button (show/hide in sales screen)
    if(await missing('show_quotation_button')){
      await conn.query("ALTER TABLE app_settings ADD COLUMN show_quotation_button TINYINT NOT NULL DEFAULT 1 AFTER show_whatsapp_controls");
    }
    // UI toggle for selling units in products screen (show/hide units section)
    if(await missing('show_selling_units')){
      await conn.query("ALTER TABLE app_settings ADD COLUMN show_selling_units TINYINT NOT NULL DEFAULT 1 AFTER show_quotation_button");
    }
    // UI toggle for employee selector in sales screen (show/hide employee dropdown for each item)
    if(await missing('show_employee_selector')){
      await conn.query("ALTER TABLE app_settings ADD COLUMN show_employee_selector TINYINT NOT NULL DEFAULT 1 AFTER show_selling_units");
    }
    // UI toggle for appointments screen (show/hide appointments card in main screen)
    if(await missing('show_appointments')){
      await conn.query("ALTER TABLE app_settings ADD COLUMN show_appointments TINYINT NOT NULL DEFAULT 0 AFTER show_employee_selector");
    }
    // UI toggle for shifts screens (show/hide shifts card and pages)
    if(await missing('show_shifts')){
      await conn.query("ALTER TABLE app_settings ADD COLUMN show_shifts TINYINT NOT NULL DEFAULT 0 AFTER show_appointments");
    }
    // Recovery unlock flag
    if(await missing('recovery_unlocked')){
      await conn.query("ALTER TABLE app_settings ADD COLUMN recovery_unlocked TINYINT NOT NULL DEFAULT 0 AFTER closing_hour");
    }
    // Daily email report settings (scheduler)
    if(await missing('daily_email_enabled')){
      await conn.query("ALTER TABLE app_settings ADD COLUMN daily_email_enabled TINYINT NOT NULL DEFAULT 0 AFTER recovery_unlocked");
    }
    if(await missing('daily_email_time')){
      await conn.query("ALTER TABLE app_settings ADD COLUMN daily_email_time TIME NULL AFTER daily_email_enabled");
    }
    // Daily DB backup scheduler settings
    if(await missing('db_backup_enabled')){
      await conn.query("ALTER TABLE app_settings ADD COLUMN db_backup_enabled TINYINT NOT NULL DEFAULT 0 AFTER daily_email_time");
    }
    if(await missing('db_backup_time')){
      await conn.query("ALTER TABLE app_settings ADD COLUMN db_backup_time TIME NULL AFTER db_backup_enabled");
    }
    if(await missing('db_backup_local_enabled')){
      await conn.query("ALTER TABLE app_settings ADD COLUMN db_backup_local_enabled TINYINT NOT NULL DEFAULT 0 AFTER db_backup_time");
    }
    if(await missing('db_backup_local_time')){
      await conn.query("ALTER TABLE app_settings ADD COLUMN db_backup_local_time TIME NULL AFTER db_backup_local_enabled");
    }
    if(await missing('db_backup_local_path')){
      await conn.query("ALTER TABLE app_settings ADD COLUMN db_backup_local_path VARCHAR(512) NULL AFTER db_backup_local_time");
    }
    if(await missing('smtp_host')){
      await conn.query("ALTER TABLE app_settings ADD COLUMN smtp_host VARCHAR(128) NULL AFTER db_backup_time");
    }
    if(await missing('smtp_port')){
      await conn.query("ALTER TABLE app_settings ADD COLUMN smtp_port SMALLINT NULL AFTER smtp_host");
    }
    if(await missing('smtp_secure')){
      await conn.query("ALTER TABLE app_settings ADD COLUMN smtp_secure TINYINT NULL AFTER smtp_port");
    }
    if(await missing('smtp_user')){
      await conn.query("ALTER TABLE app_settings ADD COLUMN smtp_user VARCHAR(255) NULL AFTER smtp_secure");
    }
    if(await missing('smtp_pass')){
      await conn.query("ALTER TABLE app_settings ADD COLUMN smtp_pass VARCHAR(255) NULL AFTER smtp_user");
    }
    if(await missing('daily_email_last_sent')){
      await conn.query("ALTER TABLE app_settings ADD COLUMN daily_email_last_sent DATE NULL AFTER smtp_pass");
    }
    // Show/hide connection modal flag
    if(await missing('show_conn_modal')){
      await conn.query("ALTER TABLE app_settings ADD COLUMN show_conn_modal TINYINT NOT NULL DEFAULT 0 AFTER recovery_unlocked");
    }
    // Support contract end date (for login screen info)
      if(await missing('support_end_date')){
        await conn.query("ALTER TABLE app_settings ADD COLUMN support_end_date DATE NULL AFTER daily_email_last_sent");
      }
    // Activation columns: allow locking to motherboard serial or MAC(Ethernet)
    if(await missing('activation_hw_id')){
      await conn.query("ALTER TABLE app_settings ADD COLUMN activation_hw_id VARCHAR(128) NULL AFTER support_end_date");
    }
    if(await missing('activation_hw_type')){
      await conn.query("ALTER TABLE app_settings ADD COLUMN activation_hw_type ENUM('baseboard','mac','disk') NULL AFTER activation_hw_id");
    }
    if(await missing('require_payment_before_print')){
      await conn.query("ALTER TABLE app_settings ADD COLUMN require_payment_before_print TINYINT NOT NULL DEFAULT 0 AFTER activation_hw_type");
    }
    if(await missing('require_customer_before_print')){
      await conn.query("ALTER TABLE app_settings ADD COLUMN require_customer_before_print TINYINT NOT NULL DEFAULT 0 AFTER require_payment_before_print");
    }
    if(await missing('require_phone_min_10')){
      await conn.query("ALTER TABLE app_settings ADD COLUMN require_phone_min_10 TINYINT NOT NULL DEFAULT 0 AFTER require_customer_before_print");
    }
    // Show/hide trial notice on login screen
    if(await missing('show_trial_notice')){
      await conn.query("ALTER TABLE app_settings ADD COLUMN show_trial_notice TINYINT NOT NULL DEFAULT 0 AFTER require_phone_min_10");
    }
    // Show/hide type hide button in types management screen
    if(await missing('show_hide_type_button')){
      await conn.query("ALTER TABLE app_settings ADD COLUMN show_hide_type_button TINYINT NOT NULL DEFAULT 1 AFTER show_trial_notice");
    }
    // Customer Display settings
    if(await missing('customer_display_enabled')){
      await conn.query("ALTER TABLE app_settings ADD COLUMN customer_display_enabled TINYINT NOT NULL DEFAULT 0 AFTER show_hide_type_button");
    }
    if(await missing('customer_display_simulator')){
      await conn.query("ALTER TABLE app_settings ADD COLUMN customer_display_simulator TINYINT NOT NULL DEFAULT 0 AFTER customer_display_enabled");
    }
    if(await missing('customer_display_port')){
      await conn.query("ALTER TABLE app_settings ADD COLUMN customer_display_port VARCHAR(16) NULL AFTER customer_display_simulator");
    }
    if(await missing('customer_display_baud_rate')){
      await conn.query("ALTER TABLE app_settings ADD COLUMN customer_display_baud_rate INT NOT NULL DEFAULT 9600 AFTER customer_display_port");
    }
    if(await missing('customer_display_columns')){
      await conn.query("ALTER TABLE app_settings ADD COLUMN customer_display_columns TINYINT NOT NULL DEFAULT 20 AFTER customer_display_baud_rate");
    }
    if(await missing('customer_display_rows')){
      await conn.query("ALTER TABLE app_settings ADD COLUMN customer_display_rows TINYINT NOT NULL DEFAULT 2 AFTER customer_display_columns");
    }
    if(await missing('customer_display_protocol')){
      await conn.query("ALTER TABLE app_settings ADD COLUMN customer_display_protocol ENUM('escpos','aedex','cd5220','generic') NOT NULL DEFAULT 'escpos' AFTER customer_display_rows");
    }
    if(await missing('customer_display_encoding')){
      await conn.query("ALTER TABLE app_settings ADD COLUMN customer_display_encoding VARCHAR(16) NOT NULL DEFAULT 'windows-1256' AFTER customer_display_protocol");
    }
    if(await missing('customer_display_brightness')){
      await conn.query("ALTER TABLE app_settings ADD COLUMN customer_display_brightness TINYINT NOT NULL DEFAULT 100 AFTER customer_display_encoding");
    }
    if(await missing('customer_display_welcome_msg')){
      await conn.query("ALTER TABLE app_settings ADD COLUMN customer_display_welcome_msg VARCHAR(128) NULL DEFAULT 'مرحباً بك' AFTER customer_display_brightness");
    }
    if(await missing('customer_display_thankyou_msg')){
      await conn.query("ALTER TABLE app_settings ADD COLUMN customer_display_thankyou_msg VARCHAR(128) NULL DEFAULT 'شكراً لزيارتك' AFTER customer_display_welcome_msg");
    }
    if(await missing('appointment_reminder_minutes')){
      await conn.query("ALTER TABLE app_settings ADD COLUMN appointment_reminder_minutes INT NOT NULL DEFAULT 15 AFTER customer_display_thankyou_msg");
    }
    if(await missing('app_theme')){
      await conn.query("ALTER TABLE app_settings ADD COLUMN app_theme ENUM('light','gray','dark','auto') NOT NULL DEFAULT 'light' AFTER appointment_reminder_minutes");
    }
    // Barcode label printing settings
    if(await missing('barcode_printer_device_name')){
      await conn.query("ALTER TABLE app_settings ADD COLUMN barcode_printer_device_name VARCHAR(255) NULL AFTER app_theme");
    }
    if(await missing('barcode_paper_width_mm')){
      await conn.query("ALTER TABLE app_settings ADD COLUMN barcode_paper_width_mm DECIMAL(6,2) NULL AFTER barcode_printer_device_name");
    }
    if(await missing('barcode_paper_height_mm')){
      await conn.query("ALTER TABLE app_settings ADD COLUMN barcode_paper_height_mm DECIMAL(6,2) NULL AFTER barcode_paper_width_mm");
    }
    if(await missing('barcode_show_shop_name')){
      await conn.query("ALTER TABLE app_settings ADD COLUMN barcode_show_shop_name TINYINT NOT NULL DEFAULT 1 AFTER barcode_paper_height_mm");
    }
    if(await missing('barcode_show_product_name')){
      await conn.query("ALTER TABLE app_settings ADD COLUMN barcode_show_product_name TINYINT NOT NULL DEFAULT 1 AFTER barcode_show_shop_name");
    }
    if(await missing('barcode_show_price')){
      await conn.query("ALTER TABLE app_settings ADD COLUMN barcode_show_price TINYINT NOT NULL DEFAULT 1 AFTER barcode_show_product_name");
    }
    if(await missing('barcode_show_barcode_text')){
      await conn.query("ALTER TABLE app_settings ADD COLUMN barcode_show_barcode_text TINYINT NOT NULL DEFAULT 1 AFTER barcode_show_price");
    }
    if(await missing('barcode_font_size_shop')){
      await conn.query("ALTER TABLE app_settings ADD COLUMN barcode_font_size_shop TINYINT NOT NULL DEFAULT 12 AFTER barcode_show_barcode_text");
    }
    if(await missing('barcode_font_size_product')){
      await conn.query("ALTER TABLE app_settings ADD COLUMN barcode_font_size_product TINYINT NOT NULL DEFAULT 12 AFTER barcode_font_size_shop");
    }
    if(await missing('barcode_font_size_price')){
      await conn.query("ALTER TABLE app_settings ADD COLUMN barcode_font_size_price TINYINT NOT NULL DEFAULT 12 AFTER barcode_font_size_product");
    }
    if(await missing('barcode_font_size_barcode_text')){
      await conn.query("ALTER TABLE app_settings ADD COLUMN barcode_font_size_barcode_text TINYINT NOT NULL DEFAULT 10 AFTER barcode_font_size_price");
    }
    // Barcode height and label offset settings
    if(await missing('barcode_height_px')){
      await conn.query("ALTER TABLE app_settings ADD COLUMN barcode_height_px TINYINT NOT NULL DEFAULT 40 AFTER barcode_font_size_barcode_text");
    }
    if(await missing('barcode_label_offset_right_mm')){
      await conn.query("ALTER TABLE app_settings ADD COLUMN barcode_label_offset_right_mm DECIMAL(6,2) NOT NULL DEFAULT 0 AFTER barcode_height_px");
    }
    if(await missing('barcode_label_offset_left_mm')){
      await conn.query("ALTER TABLE app_settings ADD COLUMN barcode_label_offset_left_mm DECIMAL(6,2) NOT NULL DEFAULT 0 AFTER barcode_label_offset_right_mm");
    }
    if(await missing('barcode_label_offset_top_mm')){
      await conn.query("ALTER TABLE app_settings ADD COLUMN barcode_label_offset_top_mm DECIMAL(6,2) NOT NULL DEFAULT 0 AFTER barcode_label_offset_left_mm");
    }
    if(await missing('barcode_label_offset_bottom_mm')){
      await conn.query("ALTER TABLE app_settings ADD COLUMN barcode_label_offset_bottom_mm DECIMAL(6,2) NOT NULL DEFAULT 0 AFTER barcode_label_offset_top_mm");
    }
    // Expand app_theme ENUM to include 'gray' for existing installations
    try {
      await conn.query("ALTER TABLE app_settings MODIFY COLUMN app_theme ENUM('light','gray','dark','auto') NOT NULL DEFAULT 'light'");
    } catch(_) {
      // Column might not exist yet or already has correct values
    }
  }

  async function ensureSingleton(conn){
    const [rows] = await conn.query('SELECT id FROM app_settings WHERE id=1');
    if(rows.length === 0){
      await conn.query(
        "INSERT INTO app_settings (id, vat_percent, prices_include_vat, currency_code, currency_symbol, currency_symbol_position) VALUES (1, 15.00, 1, 'SAR', '﷼', 'after')"
      );
    }
  }

  // Fetch settings (without binary logo blob to keep payload light)
  ipcMain.handle('settings:get', async () => {
    try{
      const conn = await dbAdapter.getConnection();
      try{
        await ensureTable(conn);
        await ensureSingleton(conn);
        const [rows] = await conn.query('SELECT * FROM app_settings WHERE id=1 LIMIT 1');
        const item = rows[0] || {};
        // English fields passthrough defaults
        item.seller_legal_name_en = item.seller_legal_name_en || '';
        item.company_location_en = item.company_location_en || '';
        // Normalize activation fields for UI consumption
        if(item.activation_hw_id){ item.activation_hw_id = String(item.activation_hw_id).toUpperCase(); }
        if(item.activation_hw_type){ item.activation_hw_type = String(item.activation_hw_type).toLowerCase(); }
        // Ensure UI toggles are numbers
        item.show_whatsapp_controls = item.show_whatsapp_controls ? 1 : 0;
        item.weight_mode_enabled = item.weight_mode_enabled ? 1 : 0;
        item.electronic_scale_enabled = item.electronic_scale_enabled ? 1 : 0;
        item.electronic_scale_type = item.electronic_scale_type || 'weight';
        // Normalize print margins (mm)
        item.print_margin_right_mm = (item.print_margin_right_mm===''||item.print_margin_right_mm===null||item.print_margin_right_mm===undefined) ? null : Number(item.print_margin_right_mm);
        item.print_margin_left_mm = (item.print_margin_left_mm===''||item.print_margin_left_mm===null||item.print_margin_left_mm===undefined) ? null : Number(item.print_margin_left_mm);
        // passthrough new fields as strings
        item.commercial_register = item.commercial_register || '';
        item.national_number = item.national_number || '';
        item.show_email_in_invoice = (item.show_email_in_invoice === undefined || item.show_email_in_invoice === null) ? 1 : (item.show_email_in_invoice ? 1 : 0);
        item.show_barcode_in_a4 = (item.show_barcode_in_a4 === undefined || item.show_barcode_in_a4 === null) ? 0 : (item.show_barcode_in_a4 ? 1 : 0);
        // Normalize support end date as YYYY-MM-DD or keep raw string if present (never drop if non-empty)
        if(item.support_end_date !== null && item.support_end_date !== undefined){
          const raw = String(item.support_end_date).trim();
          if(raw){
            try{
              const d = new Date(raw);
              if(!isNaN(d)){
                item.support_end_date = d.toISOString().slice(0,10);
              }else{
                const m = raw.match(/^(\d{4})[-\/.](\d{2})[-\/.](\d{2})$/);
                item.support_end_date = m ? `${m[1]}-${m[2]}-${m[3]}` : raw; // keep raw as fallback
              }
            }catch(_){ item.support_end_date = raw; }
          } else {
            item.support_end_date = null;
          }
        } else { item.support_end_date = null; }
        // App locale normalize
        item.app_locale = (item.app_locale === 'en' ? 'en' : 'ar');
        // Normalize scheduler/email fields
        item.daily_email_enabled = item.daily_email_enabled ? 1 : 0;
        item.daily_email_time = item.daily_email_time ? String(item.daily_email_time).slice(0,5) : null;
        // DB backup schedule
        item.db_backup_enabled = item.db_backup_enabled ? 1 : 0;
        item.db_backup_time = item.db_backup_time ? String(item.db_backup_time).slice(0,5) : null;
        item.db_backup_local_enabled = item.db_backup_local_enabled ? 1 : 0;
        item.db_backup_local_time = item.db_backup_local_time ? String(item.db_backup_local_time).slice(0,5) : null;
        item.db_backup_local_path = item.db_backup_local_path || '';
        item.smtp_host = item.smtp_host || 'smtp.gmail.com';
        item.smtp_port = Number(item.smtp_port || 587);
        item.smtp_secure = (item.smtp_secure === null || item.smtp_secure === undefined) ? 0 : (item.smtp_secure ? 1 : 0);
        item.smtp_user = item.smtp_user || '';
        item.smtp_pass = item.smtp_pass || '';
        item.daily_email_last_sent = item.daily_email_last_sent || null;
        // closing hour normalized as HH:MM string or null
        if(item.closing_hour){
          try{
            // item.closing_hour may be Date or string depending on driver; normalize to HH:MM
            const hh = (''+item.closing_hour).slice(0,5);
            item.closing_hour = hh;
          }catch(_){ item.closing_hour = null; }
        } else { item.closing_hour = null; }
        // Normalize payment_methods to array
        try{
          item.payment_methods = item.payment_methods ? JSON.parse(item.payment_methods) : [];
        }catch(_){ item.payment_methods = []; }
        // Ensure flags/formats
        item.allow_sell_zero_stock = item.allow_sell_zero_stock ? 1 : 0;
        item.allow_negative_inventory = item.allow_negative_inventory ? 1 : 0;
        item.op_price_manual = item.op_price_manual ? 1 : 0;
        item.silent_print = item.silent_print ? 1 : 0;
        item.cart_separate_duplicate_lines = item.cart_separate_duplicate_lines ? 1 : 0;
        // Default copies: if print_copies missing/null, derive from legacy flag
        item.print_copies = Number(item.print_copies || (item.print_two_copies ? 2 : 1));
        // Ensure logo size numbers
        item.logo_width_px = Number(item.logo_width_px || 120);
        item.logo_height_px = Number(item.logo_height_px || 120);
        item.invoice_footer_note = item.invoice_footer_note || '';
        item.unit_price_label = item.unit_price_label || 'سعر القطعة';
        item.hide_product_images = item.hide_product_images ? 1 : 0;
        item.show_quotation_button = item.show_quotation_button ? 1 : 0;
        item.show_selling_units = (item.show_selling_units === undefined || item.show_selling_units === null) ? 1 : (item.show_selling_units ? 1 : 0);
        item.show_employee_selector = (item.show_employee_selector === undefined || item.show_employee_selector === null) ? 1 : (item.show_employee_selector ? 1 : 0);
        item.show_shifts = (item.show_shifts === undefined || item.show_shifts === null) ? 0 : (item.show_shifts ? 1 : 0);
        item.zatca_enabled = item.zatca_enabled ? 1 : 0;
        // Defaults for tobacco fee settings
        item.tobacco_fee_percent = Number(item.tobacco_fee_percent || 100);
        // إزالة إعداد حد أدنى للأساس — الحد ثابت 25 ريال في المنطق
        item.tobacco_min_fee_amount = Number(item.tobacco_min_fee_amount || 25);
        // expose recovery flag
        item.recovery_unlocked = item.recovery_unlocked ? 1 : 0;
        item.require_payment_before_print = item.require_payment_before_print ? 1 : 0;
        // Barcode label defaults
        item.barcode_printer_device_name = item.barcode_printer_device_name || null;
        item.barcode_paper_width_mm = (item.barcode_paper_width_mm===''||item.barcode_paper_width_mm===null||item.barcode_paper_width_mm===undefined)
          ? 40
          : Number(item.barcode_paper_width_mm);
        item.barcode_paper_height_mm = (item.barcode_paper_height_mm===''||item.barcode_paper_height_mm===null||item.barcode_paper_height_mm===undefined)
          ? 25
          : Number(item.barcode_paper_height_mm);
        item.barcode_show_shop_name = item.barcode_show_shop_name === 0 ? 0 : 1;
        item.barcode_show_product_name = item.barcode_show_product_name === 0 ? 0 : 1;
        item.barcode_show_price = item.barcode_show_price === 0 ? 0 : 1;
        item.barcode_show_barcode_text = item.barcode_show_barcode_text === 0 ? 0 : 1;
        item.barcode_font_size_shop = Number(item.barcode_font_size_shop || 12);
        item.barcode_font_size_product = Number(item.barcode_font_size_product || 12);
        item.barcode_font_size_price = Number(item.barcode_font_size_price || 12);
        item.barcode_font_size_barcode_text = Number(item.barcode_font_size_barcode_text || 10);
        item.barcode_height_px = Number(item.barcode_height_px || 40);
        item.barcode_label_offset_right_mm = Number(item.barcode_label_offset_right_mm || 0);
        item.barcode_label_offset_left_mm = Number(item.barcode_label_offset_left_mm || 0);
        item.barcode_label_offset_top_mm = Number(item.barcode_label_offset_top_mm || 0);
        item.barcode_label_offset_bottom_mm = Number(item.barcode_label_offset_bottom_mm || 0);
        
        // Merge with sync config from JSON file (for branch devices in production)
        try {
          const { app } = require('electron');
          const fs = require('fs');
          const path = require('path');
          const configPath = path.join(app.getPath('userData'), 'sync-config.json');
          
          if(fs.existsSync(configPath)) {
            const syncConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            Object.assign(item, syncConfig);
          }
        } catch(_) {
          // Ignore errors - sync config is optional
        }
        
        return { ok:true, item };
      } finally { conn.release(); }
    }catch(e){ 
      console.error(e); 
      
      // For branch devices, try to return sync config even if DB fails
      try {
        const { app } = require('electron');
        const fs = require('fs');
        const path = require('path');
        const configPath = path.join(app.getPath('userData'), 'sync-config.json');
        
        if(fs.existsSync(configPath)) {
          const syncConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
          return { ok: true, item: syncConfig, settings: syncConfig };
        }
      } catch(_) {
        // Ignore
      }
      
      return { ok:false, error:'تعذر تحميل الإعدادات' }; 
    }
  });

  // Fetch logo image (BLOB or legacy path) as base64 for preview/printing
  ipcMain.handle('settings:image_get', async () => {
    try{
      const fs = require('fs');
      const path = require('path');
      const conn = await dbAdapter.getConnection();
      try{
        const [rows] = await conn.query('SELECT logo_blob, logo_mime, logo_path FROM app_settings WHERE id=1 LIMIT 1');
        const row = rows[0] || {};
        if(row.logo_blob){
          const base64 = Buffer.from(row.logo_blob).toString('base64');
          return { ok:true, base64, mime: row.logo_mime || 'image/png' };
        }
        const relOrAbs = row.logo_path;
        if(relOrAbs){
          try{
            let abs = relOrAbs;
            if(/^assets\//.test(relOrAbs)){
              abs = path.resolve(__dirname, '..', '..', relOrAbs);
            }
            const buf = fs.readFileSync(abs);
            const ext = String(path.extname(abs)).toLowerCase();
            const mime = ext==='.jpg' || ext==='.jpeg' ? 'image/jpeg' : ext==='.webp' ? 'image/webp' : 'image/png';
            return { ok:true, base64: buf.toString('base64'), mime };
          }catch(_){ /* ignore path read errors */ }
        }
        return { ok:false, error:'لا توجد صورة' };
      } finally { conn.release(); }
    }catch(e){ console.error(e); return { ok:false, error:'خطأ في الجلب' }; }
  });

  // Fetch default product image as base64 (if set)
  ipcMain.handle('settings:default_product_image_get', async () => {
    try{
      const conn = await dbAdapter.getConnection();
      try{
        const [rows] = await conn.query('SELECT default_product_img_blob, default_product_img_mime FROM app_settings WHERE id=1 LIMIT 1');
        const row = rows[0] || {};
        if(row.default_product_img_blob){
          const base64 = Buffer.from(row.default_product_img_blob).toString('base64');
          return { ok:true, base64, mime: row.default_product_img_mime || 'image/png' };
        }
        return { ok:false, error:'لا توجد صورة افتراضية' };
      } finally { conn.release(); }
    }catch(e){ console.error(e); return { ok:false, error:'خطأ في الجلب' }; }
  });

  // Save settings. Supports both legacy logo_path and new logo_blob/logo_mime (base64 from renderer)
  ipcMain.handle('settings:save', async (_e, payload) => {
    try{
      const conn = await dbAdapter.getConnection();
      try{
        await ensureTable(conn);
        await ensureSingleton(conn);
        const p = payload || {};
        // Preserve WhatsApp flags if not explicitly provided by UI
        const [curRows] = await conn.query('SELECT whatsapp_on_print, show_whatsapp_controls, support_end_date FROM app_settings WHERE id=1 LIMIT 1');
        const cur = curRows[0] || {};
        const hasOwn = (obj, k) => Object.prototype.hasOwnProperty.call(obj, k);
        const wop = hasOwn(p, 'whatsapp_on_print') ? (p.whatsapp_on_print ? 1 : 0) : (cur.whatsapp_on_print ? 1 : 0);
        const showW = hasOwn(p, 'show_whatsapp_controls') ? (p.show_whatsapp_controls ? 1 : 0) : (cur.show_whatsapp_controls ? 1 : 0);
        const methods = Array.isArray(p.payment_methods) ? JSON.stringify(p.payment_methods) : null;
        // Preserve support_end_date unless explicitly provided with a parseable value
        let supportEndToSave = cur.support_end_date || null;
        if (hasOwn(p, 'support_end_date')) {
          const raw = String(p.support_end_date || '').trim();
          if (raw) {
            const m = raw.match(/^(\d{4})[-\/.](\d{2})[-\/.](\d{2})$/);
            if (m) {
              supportEndToSave = `${m[1]}-${m[2]}-${m[3]}`;
            } else {
              try{
                const d = new Date(raw);
                if(!isNaN(d)) supportEndToSave = d.toISOString().slice(0,10);
                // else keep current value to avoid accidental clearing
              }catch(_){ /* keep current */ }
            }
          } else {
            // Explicit empty string clears the date
            supportEndToSave = null;
          }
        }
        await conn.query(`UPDATE app_settings SET 
          seller_legal_name=?, seller_legal_name_en=?, seller_vat_number=?, company_site=?, company_location=?, company_location_en=?, mobile=?, email=?, show_email_in_invoice=?, logo_path=?, 
          vat_percent=?, prices_include_vat=?, payment_methods=?, default_payment_method=?,
          currency_code=?, currency_symbol=?, currency_symbol_position=?, app_locale=?,
          default_print_format=?, print_copies=?, silent_print=?, print_show_change=?, show_barcode_in_a4=?, unit_price_label=?, quantity_label=?, op_price_manual=?, allow_sell_zero_stock=?, allow_negative_inventory=?, cart_separate_duplicate_lines=?,
          logo_width_px=?, logo_height_px=?, invoice_footer_note=?, hide_product_images=?, closing_hour=?, zatca_enabled=?, recovery_unlocked=?, 
          tobacco_fee_percent=?, tobacco_min_fee_amount=?,
          daily_email_enabled=?, daily_email_time=?, db_backup_enabled=?, db_backup_time=?, db_backup_local_enabled=?, db_backup_local_time=?, db_backup_local_path=?, smtp_host=?, smtp_port=?, smtp_secure=?, smtp_user=?, smtp_pass=?,
          support_end_date=?,
          whatsapp_on_print=?, whatsapp_auto_connect=?, whatsapp_message=?,
          commercial_register=?, national_number=?,
          show_whatsapp_controls=?,
          print_margin_right_mm=?, print_margin_left_mm=?,
          low_stock_threshold=?, show_low_stock_alerts=?,
          low_stock_email_enabled=?,
          low_stock_email_per_item=?,
          low_stock_email_cooldown_hours=?,
          weight_mode_enabled=?,
          electronic_scale_enabled=?,
          electronic_scale_type=?,
          show_quotation_button=?,
          show_selling_units=?,
          show_employee_selector=?,
          require_payment_before_print=?,
          require_customer_before_print=?,
          require_phone_min_10=?,
          customer_display_enabled=?,
          customer_display_simulator=?,
          customer_display_port=?,
          customer_display_baud_rate=?,
          customer_display_columns=?,
          customer_display_rows=?,
          customer_display_protocol=?,
          customer_display_encoding=?,
          customer_display_brightness=?,
          customer_display_welcome_msg=?,
          customer_display_thankyou_msg=?,
          appointment_reminder_minutes=?,
          app_theme=?,
          barcode_printer_device_name=?,
          barcode_paper_width_mm=?,
          barcode_paper_height_mm=?,
          barcode_show_shop_name=?,
          barcode_show_product_name=?,
          barcode_show_price=?,
          barcode_show_barcode_text=?,
          barcode_font_size_shop=?,
          barcode_font_size_product=?,
          barcode_font_size_price=?,
          barcode_font_size_barcode_text=?,
          barcode_height_px=?,
          barcode_label_offset_right_mm=?,
          barcode_label_offset_left_mm=?,
          barcode_label_offset_top_mm=?,
          barcode_label_offset_bottom_mm=?
          WHERE id=1`, [
          p.seller_legal_name || null,
          (p.seller_legal_name_en || null),
          p.seller_vat_number || null,
          p.company_site || null,
          p.company_location || null,
          (p.company_location_en || null),
          p.mobile || null,
          p.email || null,
          (p.show_email_in_invoice ? 1 : 0),
          p.logo_path || null,
          (p.vat_percent==='' || p.vat_percent===null || p.vat_percent===undefined) ? 15.00 : Number(p.vat_percent),
          p.prices_include_vat ? 1 : 0,
          methods,
          (p.default_payment_method || null),
          (p.currency_code || 'SAR'),
          (p.currency_symbol || '﷼'),
          (p.currency_symbol_position === 'before' ? 'before' : 'after'),
          (p.app_locale === 'en' ? 'en' : 'ar'),
          (p.default_print_format === 'a4' ? 'a4' : 'thermal'),
          Math.max(1, Number(p.print_copies || 1)),
          (p.silent_print ? 1 : 0),
          (p.print_show_change === 0 ? 0 : 1),
          (p.show_barcode_in_a4 ? 1 : 0),
          (p.unit_price_label || 'سعر القطعة'),
          (p.quantity_label || 'عدد'),
          (p.op_price_manual ? 1 : 0),
          (p.allow_sell_zero_stock ? 1 : 0),
          (p.allow_negative_inventory ? 1 : 0),
          (p.cart_separate_duplicate_lines ? 1 : 0),
          (Number(p.logo_width_px) || null),
          (Number(p.logo_height_px) || null),
          (p.invoice_footer_note || null),
          (p.hide_product_images ? 1 : 0),
          (p.closing_hour ? String(p.closing_hour).slice(0,5)+':00' : null),
          (p.zatca_enabled ? 1 : 0),
          (p.recovery_unlocked ? 1 : 0),
          (p.tobacco_fee_percent==='' || p.tobacco_fee_percent===null || p.tobacco_fee_percent===undefined) ? null : Number(p.tobacco_fee_percent),
          (p.tobacco_min_fee_amount==='' || p.tobacco_min_fee_amount===null || p.tobacco_min_fee_amount===undefined) ? null : Number(p.tobacco_min_fee_amount),
          (p.daily_email_enabled ? 1 : 0),
          (p.daily_email_time ? String(p.daily_email_time).slice(0,5)+':00' : null),
          (p.db_backup_enabled ? 1 : 0),
          (p.db_backup_time ? String(p.db_backup_time).slice(0,5)+':00' : null),
          (p.db_backup_local_enabled ? 1 : 0),
          (p.db_backup_local_time ? String(p.db_backup_local_time).slice(0,5)+':00' : null),
          (p.db_backup_local_path || null),
          (p.smtp_host || null),
          (p.smtp_port ? Number(p.smtp_port) : null),
          (p.smtp_secure ? 1 : 0),
          (p.smtp_user || null),
          (p.smtp_pass || null),
          supportEndToSave,
          wop,
          (p.whatsapp_auto_connect ? 1 : 0),
          (p.whatsapp_message || null),
          (p.commercial_register || null),
          (p.national_number || null),
          showW,
          (p.print_margin_right_mm===''||p.print_margin_right_mm===null||p.print_margin_right_mm===undefined) ? null : Number(p.print_margin_right_mm),
          (p.print_margin_left_mm===''||p.print_margin_left_mm===null||p.print_margin_left_mm===undefined) ? null : Number(p.print_margin_left_mm),
          Math.max(0, Number(p.low_stock_threshold===''||p.low_stock_threshold===null||p.low_stock_threshold===undefined ? 5 : p.low_stock_threshold)),
          (p.show_low_stock_alerts ? 1 : 0),
          (p.low_stock_email_enabled ? 1 : 0),
          (p.low_stock_email_per_item ? 1 : 0),
          Math.max(1, Number(p.low_stock_email_cooldown_hours===''||p.low_stock_email_cooldown_hours===null||p.low_stock_email_cooldown_hours===undefined ? 24 : p.low_stock_email_cooldown_hours)),
          (p.weight_mode_enabled ? 1 : 0),
          (p.electronic_scale_enabled ? 1 : 0),
          (p.electronic_scale_type === 'price' ? 'price' : 'weight'),
          (p.show_quotation_button ? 1 : 0),
          (p.show_selling_units ? 1 : 0),
          (p.show_employee_selector ? 1 : 0),
          (p.require_payment_before_print ? 1 : 0),
          (p.require_customer_before_print ? 1 : 0),
          (p.require_phone_min_10 ? 1 : 0),
          (p.customer_display_enabled ? 1 : 0),
          (p.customer_display_simulator ? 1 : 0),
          (p.customer_display_port || null),
          (p.customer_display_baud_rate ? Number(p.customer_display_baud_rate) : 9600),
          (p.customer_display_columns ? Number(p.customer_display_columns) : 20),
          (p.customer_display_rows ? Number(p.customer_display_rows) : 2),
          (p.customer_display_protocol || 'escpos'),
          (p.customer_display_encoding || 'windows-1256'),
          (p.customer_display_brightness ? Number(p.customer_display_brightness) : 100),
          (p.customer_display_welcome_msg || 'مرحباً بك'),
          (p.customer_display_thankyou_msg || 'شكراً لزيارتك'),
          (p.appointment_reminder_minutes !== undefined ? Number(p.appointment_reminder_minutes) : 15),
          (p.app_theme && ['light','gray','dark','auto'].includes(p.app_theme) ? p.app_theme : 'light'),
          (p.barcode_printer_device_name || null),
          (p.barcode_paper_width_mm===''||p.barcode_paper_width_mm===null||p.barcode_paper_width_mm===undefined) ? null : Number(p.barcode_paper_width_mm),
          (p.barcode_paper_height_mm===''||p.barcode_paper_height_mm===null||p.barcode_paper_height_mm===undefined) ? null : Number(p.barcode_paper_height_mm),
          (p.barcode_show_shop_name ? 1 : 0),
          (p.barcode_show_product_name ? 1 : 0),
          (p.barcode_show_price ? 1 : 0),
          (p.barcode_show_barcode_text ? 1 : 0),
          (p.barcode_font_size_shop ? Number(p.barcode_font_size_shop) : 12),
          (p.barcode_font_size_product ? Number(p.barcode_font_size_product) : 12),
          (p.barcode_font_size_price ? Number(p.barcode_font_size_price) : 12),
          (p.barcode_font_size_barcode_text ? Number(p.barcode_font_size_barcode_text) : 10),
          (p.barcode_height_px ? Number(p.barcode_height_px) : 40),
          (p.barcode_label_offset_right_mm !== undefined && p.barcode_label_offset_right_mm !== null && p.barcode_label_offset_right_mm !== '') ? Number(p.barcode_label_offset_right_mm) : 0,
          (p.barcode_label_offset_left_mm !== undefined && p.barcode_label_offset_left_mm !== null && p.barcode_label_offset_left_mm !== '') ? Number(p.barcode_label_offset_left_mm) : 0,
          (p.barcode_label_offset_top_mm !== undefined && p.barcode_label_offset_top_mm !== null && p.barcode_label_offset_top_mm !== '') ? Number(p.barcode_label_offset_top_mm) : 0,
          (p.barcode_label_offset_bottom_mm !== undefined && p.barcode_label_offset_bottom_mm !== null && p.barcode_label_offset_bottom_mm !== '') ? Number(p.barcode_label_offset_bottom_mm) : 0
        ]);
        // Handle logo updates (DB BLOB), mirroring products image flow
        if(p && p.logo_clear === true){
          await conn.query('UPDATE app_settings SET logo_blob=NULL, logo_mime=NULL, logo_path=NULL WHERE id=1');
        } else if(p && p.logo_blob_base64){
          try{
            const buf = Buffer.from(p.logo_blob_base64, 'base64');
            const mime = p.logo_mime || 'image/png';
            await conn.query('UPDATE app_settings SET logo_blob=?, logo_mime=?, logo_path=NULL WHERE id=1', [buf, mime]);
          }catch(_){ /* ignore malformed base64 */ }
        }
        // Handle default product image updates
        if(p && p.default_product_img_clear === true){
          await conn.query('UPDATE app_settings SET default_product_img_blob=NULL, default_product_img_mime=NULL WHERE id=1');
        } else if(p && p.default_product_img_blob_base64){
          try{
            const buf2 = Buffer.from(p.default_product_img_blob_base64, 'base64');
            const mime2 = p.default_product_img_mime || 'image/png';
            await conn.query('UPDATE app_settings SET default_product_img_blob=?, default_product_img_mime=? WHERE id=1', [buf2, mime2]);
          }catch(_){ /* ignore malformed base64 */ }
        }
        return { ok:true };
      } finally { conn.release(); }
    }catch(e){ console.error(e); return { ok:false, error:'فشل حفظ الإعدادات' }; }
  });

  // Device Mode IPC for Primary/Secondary linking
  const { getDeviceMode, setDeviceMode, getDeviceConfig } = require('./api-client');
  
  ipcMain.handle('device:get_mode', async () => {
    try {
      return { ok: true, mode: getDeviceMode(), config: getDeviceConfig() };
    } catch (e) {
      return { ok: false, error: String(e && e.message || e) };
    }
  });
  
  ipcMain.handle('device:set_mode', async (_e, payload) => {
    try {
      const { mode, api_host, api_port } = payload || {};
      const config = setDeviceMode(mode, api_host, api_port);
      return { ok: true, config };
    } catch (e) {
      return { ok: false, error: String(e && e.message || e) };
    }
  });
}

// eager ensure on app start
(async () => {
  try{
    const conn = await dbAdapter.getConnection();
    try{
      await conn.query(`
        CREATE TABLE IF NOT EXISTS app_settings (
          id INT PRIMARY KEY,
          company_name VARCHAR(255) NULL,
          company_site VARCHAR(255) NULL,
          mobile VARCHAR(50) NULL,
          email VARCHAR(255) NULL,
          logo_path VARCHAR(512) NULL,
          vat_percent DECIMAL(5,2) NOT NULL DEFAULT 15.00,
          prices_include_vat TINYINT NOT NULL DEFAULT 1,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);
      // Progressive ensure of new fields
      const missing = async (name) => {
        return !(await dbAdapter.columnExists('app_settings', name));
      };
      if(await missing('company_location')){
        await conn.query('ALTER TABLE app_settings ADD COLUMN company_location VARCHAR(255) NULL AFTER company_site');
      }
      if(await missing('payment_methods')){
        await conn.query('ALTER TABLE app_settings ADD COLUMN payment_methods TEXT NULL AFTER email');
      }
      if(await missing('currency_code')){
        await conn.query("ALTER TABLE app_settings ADD COLUMN currency_code VARCHAR(8) NULL DEFAULT 'SAR' AFTER payment_methods");
      }
      if(await missing('currency_symbol')){
        await conn.query("ALTER TABLE app_settings ADD COLUMN currency_symbol VARCHAR(8) NULL DEFAULT '﷼' AFTER currency_code");
      }
      if(await missing('currency_symbol_position')){
        await conn.query("ALTER TABLE app_settings ADD COLUMN currency_symbol_position ENUM('before','after') NOT NULL DEFAULT 'after' AFTER currency_symbol");
      }
      // Also ensure new general info fields
      if(await missing('seller_legal_name')){
        await conn.query("ALTER TABLE app_settings ADD COLUMN seller_legal_name VARCHAR(255) NULL AFTER email");
      }
      if(await missing('seller_vat_number')){
        await conn.query("ALTER TABLE app_settings ADD COLUMN seller_vat_number VARCHAR(32) NULL AFTER seller_legal_name");
      }
      if(await missing('commercial_register')){
        await conn.query("ALTER TABLE app_settings ADD COLUMN commercial_register VARCHAR(64) NULL AFTER seller_vat_number");
      }
      if(await missing('national_number')){
        await conn.query("ALTER TABLE app_settings ADD COLUMN national_number VARCHAR(64) NULL AFTER commercial_register");
      }
      // License fields (ensure at startup as well)
      if(await missing('license_code')){
        try{ await conn.query("ALTER TABLE app_settings ADD COLUMN license_code VARCHAR(255) NULL AFTER app_locale"); }
        catch(_){ /* ignore if already exists */ }
      }
      if(await missing('license_uuid')){
        try{ await conn.query("ALTER TABLE app_settings ADD COLUMN license_uuid VARCHAR(64) NULL AFTER license_code"); }
        catch(_){ /* ignore if already exists */ }
      }
      if(await missing('license_activated_at')){
        try{ await conn.query("ALTER TABLE app_settings ADD COLUMN license_activated_at DATETIME NULL AFTER license_uuid"); }
        catch(_){ /* ignore if already exists */ }
      }

      const [rows] = await conn.query('SELECT id FROM app_settings WHERE id=1');
      if(rows.length === 0){
        await conn.query("INSERT INTO app_settings (id, vat_percent, prices_include_vat, currency_code, currency_symbol, currency_symbol_position) VALUES (1, 15.00, 1, 'SAR', '﷼', 'after')");
      }
    } finally { conn.release(); }
  }catch(e){ /* silently ignore - tables will be created on first connection */ }
})();

// Lightweight helpers to read/write app_locale directly for app-wide language
async function __get_app_locale(){
  try{
    const conn = await dbAdapter.getConnection();
    try{
      const [rows] = await conn.query('SELECT app_locale FROM app_settings WHERE id=1 LIMIT 1');
      const v = rows[0] && rows[0].app_locale ? rows[0].app_locale : 'ar';
      return (v==='en'?'en':'ar');
    } finally { conn.release(); }
  }catch(_){ return 'ar'; }
}
async function __set_app_locale(v){
  const lang = (v==='en'?'en':'ar');
  try{
    const conn = await dbAdapter.getConnection();
    try{
      await conn.query('UPDATE app_settings SET app_locale=? WHERE id=1', [lang]);
      return true;
    } finally { conn.release(); }
  }catch(_){ return false; }
}

module.exports = { registerSettingsIPC, __get_app_locale, __set_app_locale };