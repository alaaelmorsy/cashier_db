const { ipcMain } = require('electron');
const { dbAdapter, DB_NAME } = require('../db/db-adapter');

function registerAppointmentsIPC(){
  async function ensureTable(conn){
    await conn.query(`
      CREATE TABLE IF NOT EXISTS appointments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        customer_id INT NOT NULL,
        appointment_date DATE NOT NULL,
        appointment_time TIME NOT NULL,
        status ENUM('booked', 'confirmed', 'cancelled', 'completed') NOT NULL DEFAULT 'booked',
        deposit DECIMAL(10,2) DEFAULT 0.00,
        notes TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_customer_id (customer_id),
        INDEX idx_appointment_date (appointment_date),
        INDEX idx_appointment_time (appointment_time),
        INDEX idx_status (status),
        INDEX idx_datetime (appointment_date, appointment_time),
        FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    
    try {
      const [cols] = await conn.query(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'appointments' AND COLUMN_NAME = 'deposit'
      `, [DB_NAME]);
      
      if (!cols || cols.length === 0) {
        await conn.query(`
          ALTER TABLE appointments 
          ADD COLUMN deposit DECIMAL(10,2) DEFAULT 0.00 AFTER status
        `);
      }
    } catch (e) {
      console.log('deposit column check/add:', e.message);
    }
  }

  ipcMain.handle('appointments:add', async (_evt, payload) => {
    const { customer_id, appointment_date, appointment_time, notes, deposit } = payload || {};
    if(!customer_id) return { ok:false, error:'العميل مطلوب' };
    if(!appointment_date) return { ok:false, error:'تاريخ الموعد مطلوب' };
    if(!appointment_time) return { ok:false, error:'وقت الموعد مطلوب' };

    // التحقق من أن الموعد ليس في الماضي
    const appointmentDateTime = new Date(`${appointment_date}T${appointment_time}`);
    const now = new Date();
    if(appointmentDateTime < now){
      return { ok:false, error:'لا يمكن حجز موعد في الماضي' };
    }

    try{
      const conn = await dbAdapter.getConnection();
      try{
        await ensureTable(conn);
        
        const [existing] = await conn.query(
          `SELECT id FROM appointments 
           WHERE appointment_date = ? AND appointment_time = ? 
           AND status NOT IN ('cancelled', 'completed')`,
          [appointment_date, appointment_time]
        );
        
        if(existing && existing.length > 0){
          return { ok:false, error:'يوجد موعد آخر في نفس التوقيت' };
        }

        const [result] = await conn.query(
          `INSERT INTO appointments (customer_id, appointment_date, appointment_time, deposit, notes, status) 
           VALUES (?, ?, ?, ?, ?, 'booked')`,
          [customer_id, appointment_date, appointment_time, deposit || 0, notes || null]
        );
        
        return { ok:true, id:result.insertId };
      }finally{ conn.release(); }
    }catch(err){
      console.error('appointments:add error', err);
      return { ok:false, error:err.message || String(err) };
    }
  });

  ipcMain.handle('appointments:list', async (_evt, payload) => {
    const { search = '', page = 1, pageSize = 20, status = '', dateFrom = '', dateTo = '' } = payload || {};
    try{
      const conn = await dbAdapter.getConnection();
      try{
        await ensureTable(conn);
        
        let where = '1=1';
        const params = [];
        
        if(search && search.trim()){
          where += ` AND (c.name LIKE ? OR c.phone LIKE ?)`;
          const s = `%${search.trim()}%`;
          params.push(s, s);
        }
        
        if(status && status.trim()){
          where += ` AND a.status = ?`;
          params.push(status.trim());
        }
        
        if(dateFrom && dateFrom.trim()){
          where += ` AND a.appointment_date >= ?`;
          params.push(dateFrom.trim());
        }
        
        if(dateTo && dateTo.trim()){
          where += ` AND a.appointment_date <= ?`;
          params.push(dateTo.trim());
        }
        
        const offset = (page - 1) * pageSize;
        const limit = pageSize > 0 ? pageSize : 999999;

        const [rows] = await conn.query(
          `SELECT a.*, c.name as customer_name, c.phone as customer_phone 
           FROM appointments a 
           JOIN customers c ON a.customer_id = c.id 
           WHERE ${where} 
           ORDER BY a.appointment_date DESC, a.appointment_time DESC 
           LIMIT ? OFFSET ?`,
          [...params, limit, offset]
        );
        
        const [count] = await conn.query(
          `SELECT COUNT(*) as total FROM appointments a 
           JOIN customers c ON a.customer_id = c.id 
           WHERE ${where}`,
          params
        );
        
        return { ok:true, rows, total:(count[0]?.total || 0) };
      }finally{ conn.release(); }
    }catch(err){
      console.error('appointments:list error', err);
      return { ok:false, error:err.message || String(err) };
    }
  });

  ipcMain.handle('appointments:update', async (_evt, payload) => {
    const { id, customer_id, appointment_date, appointment_time, status, deposit, notes } = payload || {};
    if(!id) return { ok:false, error:'رقم الموعد مطلوب' };
    
    // التحقق من أن الموعد ليس في الماضي
    if(appointment_date && appointment_time){
      const appointmentDateTime = new Date(`${appointment_date}T${appointment_time}`);
      const now = new Date();
      if(appointmentDateTime < now){
        return { ok:false, error:'لا يمكن تعديل الموعد إلى تاريخ في الماضي' };
      }
    }
    
    try{
      const conn = await dbAdapter.getConnection();
      try{
        await ensureTable(conn);
        
        if(appointment_date && appointment_time){
          const [existing] = await conn.query(
            `SELECT id FROM appointments 
             WHERE appointment_date = ? AND appointment_time = ? 
             AND id != ? 
             AND status NOT IN ('cancelled', 'completed')`,
            [appointment_date, appointment_time, id]
          );
          
          if(existing && existing.length > 0){
            return { ok:false, error:'يوجد موعد آخر في نفس التوقيت' };
          }
        }

        const updates = [];
        const params = [];
        
        if(customer_id !== undefined){ updates.push('customer_id = ?'); params.push(customer_id); }
        if(appointment_date !== undefined){ updates.push('appointment_date = ?'); params.push(appointment_date); }
        if(appointment_time !== undefined){ updates.push('appointment_time = ?'); params.push(appointment_time); }
        if(status !== undefined){ updates.push('status = ?'); params.push(status); }
        if(deposit !== undefined){ updates.push('deposit = ?'); params.push(deposit); }
        if(notes !== undefined){ updates.push('notes = ?'); params.push(notes || null); }
        
        if(updates.length === 0) return { ok:false, error:'لا توجد تحديثات' };
        
        params.push(id);
        await conn.query(
          `UPDATE appointments SET ${updates.join(', ')} WHERE id = ?`,
          params
        );
        
        return { ok:true };
      }finally{ conn.release(); }
    }catch(err){
      console.error('appointments:update error', err);
      return { ok:false, error:err.message || String(err) };
    }
  });

  ipcMain.handle('appointments:delete', async (_evt, id) => {
    if(!id) return { ok:false, error:'رقم الموعد مطلوب' };
    try{
      const conn = await dbAdapter.getConnection();
      try{
        await ensureTable(conn);
        await conn.query('DELETE FROM appointments WHERE id = ?', [id]);
        return { ok:true };
      }finally{ conn.release(); }
    }catch(err){
      console.error('appointments:delete error', err);
      return { ok:false, error:err.message || String(err) };
    }
  });

  ipcMain.handle('appointments:get', async (_evt, id) => {
    if(!id) return { ok:false, error:'رقم الموعد مطلوب' };
    try{
      const conn = await dbAdapter.getConnection();
      try{
        await ensureTable(conn);
        const [rows] = await conn.query(
          `SELECT a.*, c.name as customer_name, c.phone as customer_phone 
           FROM appointments a 
           JOIN customers c ON a.customer_id = c.id 
           WHERE a.id = ?`,
          [id]
        );
        if(!rows || rows.length === 0) return { ok:false, error:'الموعد غير موجود' };
        return { ok:true, row:rows[0] };
      }finally{ conn.release(); }
    }catch(err){
      console.error('appointments:get error', err);
      return { ok:false, error:err.message || String(err) };
    }
  });
}

module.exports = { registerAppointmentsIPC };
