const { BrowserWindow } = require('electron');
const { dbAdapter, DB_NAME } = require('../db/db-adapter');

let reminderInterval = null;
const notifiedAppointments = new Set();

function formatLocalDateTime(date){
  const pad = (v) => String(v).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

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
    // Ignore if column already exists
  }
}

function startAppointmentReminderService() {
  if (reminderInterval) {
    clearInterval(reminderInterval);
  }

  checkUpcomingAppointments();

  reminderInterval = setInterval(() => {
    checkUpcomingAppointments();
  }, 60000);
}

function stopAppointmentReminderService() {
  if (reminderInterval) {
    clearInterval(reminderInterval);
    reminderInterval = null;
  }
  notifiedAppointments.clear();
}

async function checkUpcomingAppointments() {
  try {
    const conn = await dbAdapter.getConnection();
    try {
      await ensureTable(conn);
      
      const [settings] = await conn.query('SELECT appointment_reminder_minutes FROM app_settings WHERE id=1 LIMIT 1');
      const reminderMinutes = settings[0]?.appointment_reminder_minutes || 15;

      if (reminderMinutes === 0) {
        return;
      }

      const now = new Date();
      const futureTime = new Date(now.getTime() + reminderMinutes * 60000);
      const nowLocal = formatLocalDateTime(now);
      const futureTimeLocal = formatLocalDateTime(futureTime);

      const [appointments] = await conn.query(`
        SELECT a.*, c.name as customer_name, c.phone as customer_phone
        FROM appointments a
        JOIN customers c ON a.customer_id = c.id
        WHERE a.status IN ('booked', 'confirmed')
        AND CONCAT(a.appointment_date, ' ', a.appointment_time) > ?
        AND CONCAT(a.appointment_date, ' ', a.appointment_time) <= ?
        ORDER BY a.appointment_date, a.appointment_time
      `, [nowLocal, futureTimeLocal]);

      // console.log('Checking appointments:', { reminderMinutes, nowLocal, futureTimeLocal, count: appointments.length });

      for (const appointment of appointments) {
        // Fix: Ensure appointment_date is a string in YYYY-MM-DD format
        let dateStr = appointment.appointment_date;
        if (dateStr instanceof Date) {
          const pad = (v) => String(v).padStart(2, '0');
          dateStr = `${dateStr.getFullYear()}-${pad(dateStr.getMonth() + 1)}-${pad(dateStr.getDate())}`;
        }

        const appointmentKey = `${appointment.id}-${dateStr}-${appointment.appointment_time}`;
        
        if (!notifiedAppointments.has(appointmentKey)) {
          const appointmentDateTime = new Date(`${dateStr}T${appointment.appointment_time}`);
          const minutesUntil = Math.ceil((appointmentDateTime - now) / 60000);
          
          if (minutesUntil <= reminderMinutes && minutesUntil >= 0) {
            sendNotificationToAllWindows({
              id: appointment.id,
              customerName: appointment.customer_name,
              customerPhone: appointment.customer_phone,
              date: appointment.appointment_date,
              time: appointment.appointment_time,
              minutesUntil: minutesUntil,
              notes: appointment.notes
            });
            
            notifiedAppointments.add(appointmentKey);
          }
        }
      }

      cleanupOldNotifications();
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error('Error checking upcoming appointments:', err);
  }
}

function sendNotificationToAllWindows(appointmentData) {
  const allWindows = BrowserWindow.getAllWindows();
  allWindows.forEach(win => {
    if (win && !win.isDestroyed()) {
      win.webContents.send('appointment-reminder', appointmentData);
    }
  });
}

function cleanupOldNotifications() {
  if (notifiedAppointments.size > 1000) {
    notifiedAppointments.clear();
  }
}

module.exports = {
  startAppointmentReminderService,
  stopAppointmentReminderService,
  checkUpcomingAppointments
};
