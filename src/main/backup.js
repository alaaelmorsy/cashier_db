// Backup and email database dump
const { ipcMain, app, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const zlib = require('zlib');
const { spawn } = require('child_process');
const nodemailer = require('nodemailer');
const { dbAdapter, DB_NAME } = require('../db/db-adapter');
const { getConfig } = require('../db/connection');
require('dotenv').config();

async function readSettings(conn){
  const [[s]] = await conn.query('SELECT * FROM app_settings WHERE id=1');
  return s || {};
}

function nowStamp(){
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const dd = String(d.getDate()).padStart(2,'0');
  const hh = String(d.getHours()).padStart(2,'0');
  const mm = String(d.getMinutes()).padStart(2,'0');
  const ss = String(d.getSeconds()).padStart(2,'0');
  return `${y}${m}${dd}-${hh}${mm}${ss}`;
}

function dateStampDMY(){
  // Return date as dd-MM-yyyy
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const dd = String(d.getDate()).padStart(2,'0');
  return `${dd}-${m}-${y}`;
}

function stampDMY_HHMM(){
  const d = new Date();
  const dd = String(d.getDate()).padStart(2,'0');
  const mm = String(d.getMonth()+1).padStart(2,'0');
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2,'0');
  const mi = String(d.getMinutes()).padStart(2,'0');
  return `${dd}-${mm}-${yyyy}_${hh}${mi}`;
}

async function createDbDumpSql(){
  // Create plain SQL dump (not gzipped)
  const cfg = getConfig();
  const sql = await dumpWithMysqldump(cfg);
  return sql; // Buffer
}

function zipBufferWithFilename(innerFilename, contentBuffer){
  // Create a minimal ZIP with a single file entry stored (no compression)
  // ZIP file format: [Local Header][File Data][Data Desc][Central Dir][End of Central Dir]
  function crc32(buf){
    // Compute CRC-32 using standard polynomial 0xEDB88320
    let crc = 0xFFFFFFFF;
    for(let i=0;i<buf.length;i++){
      crc ^= buf[i];
      for(let j=0;j<8;j++){
        const mask = -(crc & 1);
        crc = (crc >>> 1) ^ (0xEDB88320 & mask);
      }
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }
  const textEncoder = new TextEncoder();
  const nameBytes = textEncoder.encode(String(innerFilename));
  const fileData = Buffer.from(contentBuffer);
  const crc = crc32(fileData);
  const now = new Date();
  const dosTime = ((now.getHours() & 0x1f) << 11) | ((now.getMinutes() & 0x3f) << 5) | ((Math.floor(now.getSeconds()/2)) & 0x1f);
  const dosDate = (((now.getFullYear()-1980) & 0x7f) << 9) | (((now.getMonth()+1) & 0xf) << 5) | ((now.getDate()) & 0x1f);

  // Local file header
  const LFH = Buffer.alloc(30);
  let o = 0;
  LFH.writeUInt32LE(0x04034b50, o); o+=4; // signature
  LFH.writeUInt16LE(20, o); o+=2; // version needed
  LFH.writeUInt16LE(0, o); o+=2;  // general purpose
  LFH.writeUInt16LE(0, o); o+=2;  // compression method = 0 (stored)
  LFH.writeUInt16LE(dosTime, o); o+=2;
  LFH.writeUInt16LE(dosDate, o); o+=2;
  LFH.writeUInt32LE(crc, o); o+=4;
  LFH.writeUInt32LE(fileData.length, o); o+=4; // comp size
  LFH.writeUInt32LE(fileData.length, o); o+=4; // uncomp size
  LFH.writeUInt16LE(nameBytes.length, o); o+=2; // file name length
  LFH.writeUInt16LE(0, o); o+=2; // extra length

  // Central directory header
  const CDH = Buffer.alloc(46);
  o = 0;
  CDH.writeUInt32LE(0x02014b50, o); o+=4; // signature
  CDH.writeUInt16LE(20, o); o+=2; // version made by
  CDH.writeUInt16LE(20, o); o+=2; // version needed to extract
  CDH.writeUInt16LE(0, o); o+=2;  // general purpose
  CDH.writeUInt16LE(0, o); o+=2;  // compression method
  CDH.writeUInt16LE(dosTime, o); o+=2;
  CDH.writeUInt16LE(dosDate, o); o+=2;
  CDH.writeUInt32LE(crc, o); o+=4;
  CDH.writeUInt32LE(fileData.length, o); o+=4;
  CDH.writeUInt32LE(fileData.length, o); o+=4;
  CDH.writeUInt16LE(nameBytes.length, o); o+=2;
  CDH.writeUInt16LE(0, o); o+=2; // extra len
  CDH.writeUInt16LE(0, o); o+=2; // file comment len
  CDH.writeUInt16LE(0, o); o+=2; // disk number start
  CDH.writeUInt16LE(0, o); o+=2; // internal attrs
  CDH.writeUInt32LE(0, o); o+=4; // external attrs
  const localHeaderOffset = 0; // will be at start of file
  CDH.writeUInt32LE(localHeaderOffset, o); o+=4;

  // End of central directory record
  const EOCD = Buffer.alloc(22);
  o = 0;
  EOCD.writeUInt32LE(0x06054b50, o); o+=4; // signature
  EOCD.writeUInt16LE(0, o); o+=2; // disk no
  EOCD.writeUInt16LE(0, o); o+=2; // central dir start disk
  EOCD.writeUInt16LE(1, o); o+=2; // total entries disk
  EOCD.writeUInt16LE(1, o); o+=2; // total entries
  const cdSize = CDH.length + nameBytes.length;
  const cdOffset = LFH.length + nameBytes.length + fileData.length;
  EOCD.writeUInt32LE(cdSize, o); o+=4; // central dir size
  EOCD.writeUInt32LE(cdOffset, o); o+=4; // central dir offset
  EOCD.writeUInt16LE(0, o); o+=2; // comment length

  return Buffer.concat([LFH, Buffer.from(nameBytes), fileData, CDH, Buffer.from(nameBytes), EOCD]);
}

function dumpWithMysqldump(cfg){
  // Robust dump that works with MySQL 5.7 servers using 8.0 client (handles COLUMN_STATISTICS issue)
  return new Promise((resolve, reject) => {
    const baseArgs = [
      '-h', cfg.host,
      '-P', String(cfg.port||3306),
      '-u', cfg.user,
      `-p${cfg.password||''}`,
      '--single-transaction', '--quick', '--skip-lock-tables', '--routines', '--events',
    ];

    // Resolve mysqldump path in this priority:
    // 1) MYSQLDUMP_PATH from .env (trimmed, quotes removed)
    // 2) Bundled binary in production: <resources>/assets/bin/win/mysqldump.exe
    // 3) Bundled binary in development: <repo>/assets/bin/win/mysqldump.exe
    // 4) Fallback to system PATH: 'mysqldump'
    const stripQuotes = (s) => (s || '').replace(/^\s*["']|["']\s*$/g, '').trim();
    const envDumpPath = stripQuotes(process.env.MYSQLDUMP_PATH);
    const bundledDumpProd = path.join(process.resourcesPath || '', 'assets', 'bin', 'win', 'mysqldump.exe');
    const bundledDumpDev = path.join(__dirname, '..', '..', 'assets', 'bin', 'win', 'mysqldump.exe');

    let mysqldumpCmd = 'mysqldump';
    const candidates = [envDumpPath, bundledDumpProd, bundledDumpDev];
    for(const p of candidates){
      if(p && p !== 'mysqldump' && fs.existsSync(p)) { mysqldumpCmd = p; break; }
    }

    const runOnce = (extraArgs = []) => new Promise((res, rej) => {
      const args = [...baseArgs, ...extraArgs, DB_NAME];
      const proc = spawn(mysqldumpCmd, args, { stdio: ['ignore','pipe','pipe'] });
      const chunks = [];
      const errChunks = [];
      proc.stdout.on('data', d => chunks.push(Buffer.from(d)));
      proc.stderr.on('data', d => errChunks.push(Buffer.from(d)));
      proc.on('error', (e) => {
        const hint = '\nتلميح: ثبّت MySQL Client وأضف مسار bin إلى PATH، أو عرّف MYSQLDUMP_PATH في ملف .env بالمسار الكامل للأداة.';
        rej(new Error('تعذر تشغيل mysqldump: ' + (e && e.message || e) + hint));
      });
      proc.on('close', (code) => {
        if(code === 0){ return res(Buffer.concat(chunks)); }
        const err = Buffer.concat(errChunks).toString('utf8');
        rej(new Error(err || 'فشل إنشاء النسخة الاحتياطية (mysqldump)'));
      });
    });

    // Try without extras first, then retry with compatibility flags if COLUMN_STATISTICS issue arises
    runOnce().then(resolve).catch((e1) => {
      const msg = String(e1 && e1.message || e1 || '').toLowerCase();
      const needsColumnStatsFix = /column_statistics|information_schema\.column_statistics/.test(msg);
      const unknownOptionColumnStats = /unknown option '--column-statistics'/.test(msg);

      if(needsColumnStatsFix){
        // Retry with 8.0->5.7 compatibility flags
        runOnce(['--column-statistics=0', '--set-gtid-purged=OFF', '--no-tablespaces'])
          .then(resolve)
          .catch(err => reject(new Error('فشل إنشاء النسخة الاحتياطية (mysqldump): ' + (err && err.message || err))));
      } else if(unknownOptionColumnStats){
        // Client is older and does not support --column-statistics; re-run without it (already did), so just surface original error
        reject(new Error('فشل إنشاء النسخة الاحتياطية (mysqldump): ' + (e1 && e1.message || e1)));
      } else {
        // Surface the original error
        reject(new Error('فشل إنشاء النسخة الاحتياطية (mysqldump): ' + (e1 && e1.message || e1)));
      }
    });
  });
}

async function createDbDumpGz(){
  const cfg = getConfig();
  const sql = await dumpWithMysqldump(cfg);
  const gz = zlib.gzipSync(sql, { level: 9 });
  return gz;
}

async function writeDbBackupToDir(targetDir){
  if(!targetDir){ throw new Error('يرجى اختيار مجلد الحفظ'); }
  const dir = path.resolve(String(targetDir));
  fs.mkdirSync(dir, { recursive: true });
  const filename = `${DB_NAME}_${stampDMY_HHMM()}.dump`;
  const fullPath = path.join(dir, filename);
  const sql = await createDbDumpSql();
  fs.writeFileSync(fullPath, sql);
  return fullPath;
}

async function sendEmailWithAttachment(s, toEmail, filename, contentBuffer){
  if(!toEmail){ throw new Error('يرجى تحديد البريد المستلم في الإعدادات أو في نافذة الإرسال'); }
  if(!s.smtp_host || !s.smtp_user || !s.smtp_pass){
    throw new Error('إعدادات SMTP غير مكتملة. يرجى ضبط (البريد المرسل وكلمة المرور والخادم) في إعداد التقرير اليومي.');
  }
  const base = {
    host: s.smtp_host,
    auth: { user: s.smtp_user, pass: s.smtp_pass },
  };
  const userPort = Number(s.smtp_port||0);
  const userSecure = !!s.smtp_secure;
  const first = { ...base, port: userPort || (userSecure ? 465 : 587), secure: userSecure };
  const second = first.port === 465 && first.secure === true
    ? { ...base, port: 587, secure: false }
    : { ...base, port: 465, secure: true };

  // Build branded subject/body
  const shopName = (s.seller_legal_name || s.company_name || 'المتجر').toString();
  const shopLocation = s.company_location ? ` — ${s.company_location}` : '';
  const stamp = new Date();
  // Numeric date/time dd-MM-yyyy HH:mm
  const stampNum = (()=>{ const d = stamp; const dd=String(d.getDate()).padStart(2,'0'); const mm=String(d.getMonth()+1).padStart(2,'0'); const yyyy=d.getFullYear(); const hh=String(d.getHours()).padStart(2,'0'); const mi=String(d.getMinutes()).padStart(2,'0'); return `${dd}-${mm}-${yyyy} ${hh}:${mi}`; })();
  const subject = `نسخة احتياطية - ${shopName}`;
  const text = `تم إنشاء نسخة احتياطية من قاعدة البيانات.\nالمتجر: ${shopName}${shopLocation ? (' - ' + s.company_location) : ''}\nالتاريخ والوقت: ${stampNum}\nالملف: ${filename}\n\nهذا النظام مقدم من: مؤسسة تعلم التقنيات`;
  const html = `
    <div style="font-family:'Cairo',Segoe UI,Tahoma,sans-serif;direction:rtl;text-align:right;color:#111827;background:#f9fafb;padding:20px"> 
      <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">
        <div style="padding:18px 22px;background:linear-gradient(135deg,#6366f1,#4f46e5);color:#fff">
          <div style="font-size:18px;font-weight:800">نسخة احتياطية من قاعدة البيانات</div>
          <div style="opacity:.9;font-size:13px">${stampNum}</div>
        </div>
        <div style="padding:22px">
          <div style="font-weight:800;font-size:16px;margin-bottom:6px">${shopName}</div>
          ${shopLocation ? `<div style="color:#4b5563;font-size:13px;margin-bottom:12px">${s.company_location}</div>` : ''}
          <div style="color:#374151;font-size:14px;line-height:1.8">
            تم إنشاء نسخة من قاعدة البيانات وإرفاقها مع هذه الرسالة.<br/>
            اسم الملف: <span style="font-family:monospace">${filename}</span><br/>
            <span style="color:#6b7280">هذا النظام مقدم من: مؤسسة تعلم التقنيات</span>
          </div>
        </div>
        <div style="padding:14px 22px;background:#f3f4f6;color:#6b7280;font-size:12px">
          أُرسلت بواسطة نظام نقاط البيع.
        </div>
      </div>
    </div>`;

  const attempts = [first, second];
  let lastErr = null;
  for(const cfg of attempts){
    try{
      const transporter = nodemailer.createTransport(cfg);
      const ext = (filename || '').toLowerCase();
      const contentType = ext.endsWith('.gz')
        ? 'application/gzip'
        : (ext.endsWith('.zip') ? 'application/zip' : (ext.endsWith('.sql') || ext.endsWith('.dump') ? 'application/sql' : 'application/octet-stream'));
      const info = await transporter.sendMail({
        from: s.smtp_user,
        to: toEmail,
        subject,
        text,
        html,
        attachments: [ { filename, content: contentBuffer, contentType } ]
      });
      return info;
    }catch(e){ lastErr = e; }
  }
  throw lastErr || new Error('فشل إرسال البريد');
}

// Helper used by scheduler to email DB backup using current settings
async function emailDbBackup(s, toEmail){
  // Create plain SQL dump and wrap it in ZIP: <DB_NAME>_<dd-MM-yyyy>.zip containing <DB_NAME>.dump
  const sql = await createDbDumpSql();
  const inner = `${DB_NAME}.dump`;
  const zip = zipBufferWithFilename(inner, sql);
  const name = `${DB_NAME}_${dateStampDMY()}.zip`;
  try{
    const outDir = path.join(app.getPath('userData'), 'backups');
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, name), zip);
  }catch(_){ }
  await sendEmailWithAttachment(s, toEmail || (s.email || ''), name, zip);
  return { ok:true, filename: name };
}

function registerBackupIPC(){
  ipcMain.handle('backup:email_db', async (_e, payload) => {
    try{
      const conn = await dbAdapter.getConnection();
      try{
        const s = await readSettings(conn);
        const to = (payload && payload.to) ? String(payload.to).trim() : (s.email || '');
        // Create plain SQL dump and send as ZIP: <DB_NAME>_<dd-MM-yyyy>.zip containing <DB_NAME>.dump
        const sql = await createDbDumpSql();
        const inner = `${DB_NAME}.dump`;
        const zip = zipBufferWithFilename(inner, sql);
        const name = `${DB_NAME}_${dateStampDMY()}.zip`;
        // Save temp for reference (optional)
        try{
          const outDir = path.join(app.getPath('userData'), 'backups');
          fs.mkdirSync(outDir, { recursive: true });
          fs.writeFileSync(path.join(outDir, name), zip);
        }catch(_){ }
        await sendEmailWithAttachment(s, to, name, zip);
        return { ok:true };
      } finally { conn.release(); }
    }catch(e){
      return { ok:false, error: String(e && e.message || e) };
    }
  });

  ipcMain.handle('backup:db_local', async (_event, payload) => {
    try{
      const dirPath = payload && payload.dirPath ? String(payload.dirPath).trim() : '';
      if(dirPath){
        const savedPath = await writeDbBackupToDir(dirPath);
        return { ok: true, path: savedPath };
      }
      const defaultFilename = `${DB_NAME}_${stampDMY_HHMM()}.dump`;

      const result = await dialog.showSaveDialog({
        title: 'حفظ نسخة احتياطية من قاعدة البيانات',
        defaultPath: defaultFilename,
        filters: [
          { name: 'Database Dump', extensions: ['dump'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });

      if (result.canceled || !result.filePath) {
        return { ok: false, error: 'تم إلغاء العملية' };
      }

      const sql = await createDbDumpSql();
      fs.writeFileSync(result.filePath, sql);

      return { ok: true, path: result.filePath };
    }catch(e){
      return { ok: false, error: String(e && e.message || e) };
    }
  });

  ipcMain.handle('backup:pick_dir', async () => {
    try{
      const result = await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] });
      if(result.canceled || !result.filePaths || !result.filePaths[0]){
        return { ok:false, canceled:true, error:'تم الإلغاء' };
      }
      return { ok:true, path: result.filePaths[0] };
    }catch(e){ return { ok:false, error: String(e && e.message || e) }; }
  });
}

module.exports = { registerBackupIPC, emailDbBackup, writeDbBackupToDir };