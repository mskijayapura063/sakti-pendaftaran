// ================================================================
// Google Apps Script — SAKTI KPPN Jayapura
// Backend lengkap: Auth, Data (Sheets), File (Drive)
// ================================================================

// ===== KONFIGURASI — WAJIB DIISI =====
const CONFIG = {
  FOLDER_ID:        'GANTI_DENGAN_ID_FOLDER_DRIVE_KAMU',   // ID folder Google Drive
  SPREADSHEET_ID:   'GANTI_DENGAN_ID_SPREADSHEET_KAMU',    // ID Google Sheets
  SESSION_DURATION: 8 * 60 * 60 * 1000,                    // 8 jam (ms)
  ADMIN_SECRET:     'KPPN_JAYAPURA_SECRET_2024',            // Secret untuk hash
};

// ===== SHEET NAMES =====
const SHEET = {
  USERS:        'Users',
  PENDAFTARAN:  'Pendaftaran',
  SESSIONS:     'Sessions',
  PENGGUNA:     'PenggunaTerdaftar',   // NIK + NIP semua user yang pernah didaftarkan
};

// ================================================================
// ROUTER UTAMA
// ================================================================
function doPost(e) {
  try {
    // CORS headers
    const data   = JSON.parse(e.postData.contents);
    const action = data.action || '';

    // Routes yang tidak butuh auth
    if (action === 'login')         return handleLogin(data);
    if (action === 'submitDaftar')  return handleSubmitDaftar(data);
    if (action === 'cekRef')        return handleCekRef(data);

    // Routes yang butuh auth
    const auth = checkSession(data.token);
    if (!auth.valid) return jsonErr('Sesi tidak valid atau sudah habis. Silakan login ulang.');

    // Admin routes
    if (action === 'logout')          return handleLogout(data.token);
    if (action === 'getDaftarList')   return handleGetDaftarList(auth);
    if (action === 'getDetail')       return handleGetDetail(data, auth);
    if (action === 'hapusData')       return handleHapusData(data, auth);
    if (action === 'uploadFile')      return handleUploadFile(data, auth);
    if (action === 'getUsers')        return handleGetUsers(auth);
    if (action === 'addUser')         return handleAddUser(data, auth);
    if (action === 'deleteUser')      return handleDeleteUser(data, auth);
    if (action === 'changePassword')  return handleChangePassword(data, auth);
    if (action === 'getDashboard')    return handleGetDashboard(auth);
    if (action === 'aktivasiOTP')     return handleAktivasiOTP(data, auth);

    return jsonErr('Action tidak dikenal: ' + action);
  } catch (err) {
    return jsonErr('Server error: ' + err.toString());
  }
}

function doGet(e) {
  const action = (e.parameter && e.parameter.action) || '';
  if (action === 'ping') return jsonOk({ message: 'SAKTI KPPN Jayapura - Aktif ✅' });
  return jsonOk({ message: 'SAKTI KPPN Jayapura Backend' });
}

// ================================================================
// INISIALISASI SPREADSHEET
// Jalankan sekali dari editor Apps Script sebelum deploy!
// ================================================================
function initSpreadsheet() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);

  // Sheet Users
  let shUsers = ss.getSheetByName(SHEET.USERS);
  if (!shUsers) {
    shUsers = ss.insertSheet(SHEET.USERS);
    shUsers.appendRow(['username', 'passwordHash', 'role', 'createdAt']);
    // User admin default
    shUsers.appendRow(['admin', hashPassword('kppn2024'), 'Admin', new Date().toISOString()]);
    shUsers.appendRow(['kppn1', hashPassword('sakti123'), 'Petugas', new Date().toISOString()]);
  }

  // Sheet Pendaftaran
  let shDaftar = ss.getSheetByName(SHEET.PENDAFTARAN);
  if (!shDaftar) {
    shDaftar = ss.insertSheet(SHEET.PENDAFTARAN);
    shDaftar.appendRow([
      'refKode','namaSatker','kodeSatker','namaKpa','nip',
      'noHp','email','alamat','tanggalDaftar','status',
      'otpCode','otpAktif','driveFolder','filesJson','catatanAdmin'
    ]);
  }

  // Sheet Sessions
  let shSess = ss.getSheetByName(SHEET.SESSIONS);
  if (!shSess) {
    shSess = ss.insertSheet(SHEET.SESSIONS);
    shSess.appendRow(['token','username','role','createdAt','expiresAt']);
  }

  // Sheet PenggunaTerdaftar — untuk cek duplikat NIK/NIP lintas pendaftaran
  let shPengguna = ss.getSheetByName(SHEET.PENGGUNA);
  if (!shPengguna) {
    shPengguna = ss.insertSheet(SHEET.PENGGUNA);
    shPengguna.appendRow(['refKode','namaSatker','nama','nipnrp','nik','peran','terdaftarAt']);
  }

  return jsonOk({ message: 'Spreadsheet berhasil diinisialisasi' });
}

// ================================================================
// AUTH — LOGIN / LOGOUT / SESSION
// ================================================================
function handleLogin(data) {
  const username = (data.username || '').trim();
  const password = data.password || '';

  if (!username || !password) return jsonErr('Username dan password wajib diisi');

  const ss    = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sh    = ss.getSheetByName(SHEET.USERS);
  const rows  = sh.getDataRange().getValues();

  // rows[0] = header
  for (let i = 1; i < rows.length; i++) {
    const [uname, pwHash, role] = rows[i];
    if (uname === username && pwHash === hashPassword(password)) {
      // Hapus session lama user ini
      cleanOldSessions(username);

      // Buat token baru
      const token     = generateToken();
      const now       = new Date();
      const expiresAt = new Date(now.getTime() + CONFIG.SESSION_DURATION);

      const shSess = ss.getSheetByName(SHEET.SESSIONS);
      shSess.appendRow([token, username, role, now.toISOString(), expiresAt.toISOString()]);

      return jsonOk({ token, username, role, expiresAt: expiresAt.toISOString() });
    }
  }

  return jsonErr('Username atau password salah');
}

function handleLogout(token) {
  const ss   = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sh   = ss.getSheetByName(SHEET.SESSIONS);
  const rows = sh.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === token) {
      sh.deleteRow(i + 1);
      break;
    }
  }
  return jsonOk({ message: 'Logout berhasil' });
}

function checkSession(token) {
  if (!token) return { valid: false };
  const ss   = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sh   = ss.getSheetByName(SHEET.SESSIONS);
  const rows = sh.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    const [tok, username, role, , expiresAt] = rows[i];
    if (tok === token) {
      if (new Date() > new Date(expiresAt)) {
        sh.deleteRow(i + 1); // Hapus expired session
        return { valid: false };
      }
      return { valid: true, username, role, rowIndex: i + 1 };
    }
  }
  return { valid: false };
}

function cleanOldSessions(username) {
  const ss   = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sh   = ss.getSheetByName(SHEET.SESSIONS);
  const rows = sh.getDataRange().getValues();
  // Hapus dari bawah agar index tidak bergeser
  for (let i = rows.length - 1; i >= 1; i--) {
    if (rows[i][1] === username) sh.deleteRow(i + 1);
  }
}

// ================================================================
// PENDAFTARAN — SUBMIT, CEK, LIST, DETAIL, HAPUS
// ================================================================
function handleSubmitDaftar(data) {
  const required = ['refKode','namaSatker','kodeSatker'];
  for (const f of required) {
    if (!data[f]) return jsonErr(`Field wajib kosong: ${f}`);
  }

  const ss   = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sh   = ss.getSheetByName(SHEET.PENDAFTARAN);
  const rows = sh.getDataRange().getValues();

  // Cek duplikat refKode
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === data.refKode) return jsonErr('Kode referensi sudah digunakan');
  }

  // Cek duplikat NIK / NIP lintas pendaftaran
  let usersArr = [];
  try { usersArr = JSON.parse(data.usersJson || '[]'); } catch(e) {}

  if (usersArr.length > 0) {
    const shPengguna = ss.getSheetByName(SHEET.PENGGUNA);
    const pRows = shPengguna ? shPengguna.getDataRange().getValues() : [];

    // Kumpulkan semua NIK dan NIP yang sudah terdaftar
    const registeredNIK = new Map(); // nik -> {nama, satker}
    const registeredNIP = new Map(); // nipnrp -> {nama, satker}
    for (let i = 1; i < pRows.length; i++) {
      const [pRef, pSatker, pNama, pNip, pNik] = pRows[i];
      if (pNik)  registeredNIK.set(String(pNik).trim(),  { nama: pNama, satker: pSatker, ref: pRef });
      if (pNip)  registeredNIP.set(String(pNip).trim(),  { nama: pNama, satker: pSatker, ref: pRef });
    }

    // Cek setiap user baru
    const dupErrors = [];
    for (const u of usersArr) {
      const nik    = String(u.nik    || '').trim();
      const nipnrp = String(u.nipnrp || '').trim();
      const nama   = u.nama || '(tanpa nama)';

      if (nik && registeredNIK.has(nik)) {
        const ex = registeredNIK.get(nik);
        dupErrors.push(`NIK ${nik} (${nama}) sudah terdaftar atas nama "${ex.nama}" dari satker "${ex.satker}" (ref: ${ex.ref})`);
      }
      if (nipnrp && registeredNIP.has(nipnrp)) {
        const ex = registeredNIP.get(nipnrp);
        dupErrors.push(`NIP/NRP ${nipnrp} (${nama}) sudah terdaftar atas nama "${ex.nama}" dari satker "${ex.satker}" (ref: ${ex.ref})`);
      }
    }

    if (dupErrors.length > 0) {
      return jsonErr('Terdapat pengguna yang sudah pernah didaftarkan:\n' + dupErrors.join('\n'));
    }
  }

  const otp = generateOTP();
  sh.appendRow([
    data.refKode,
    data.namaSatker,
    data.kodeSatker,
    data.namaKpa || data.namaKPA || '',
    data.nip     || data.nipKPA  || '',
    data.noHp    || '',
    data.email   || '',
    data.alamat  || '',
    new Date().toISOString(),
    'Menunggu',   // status
    otp,          // otpCode
    'false',      // otpAktif
    '',           // driveFolder
    '{}',         // filesJson
    '',           // catatanAdmin
  ]);

  // Simpan daftar pengguna ke sheet PenggunaTerdaftar
  if (usersArr.length > 0) {
    const shPengguna = ss.getSheetByName(SHEET.PENGGUNA);
    if (shPengguna) {
      const now = new Date().toISOString();
      for (const u of usersArr) {
        shPengguna.appendRow([
          data.refKode,
          data.namaSatker,
          u.nama    || '',
          u.nipnrp  || '',
          u.nik     || '',
          (u.peranList || []).join(', '),
          now,
        ]);
      }
    }
  }

  return jsonOk({ refKode: data.refKode, otp });
}

function handleCekRef(data) {
  const refKode = (data.refKode || '').trim();
  if (!refKode) return jsonErr('refKode wajib diisi');

  const row = findPendaftaran(refKode);
  if (!row) return jsonErr('Kode referensi tidak ditemukan');

  return jsonOk({
    refKode:    row[0],
    namaSatker: row[1],
    status:     row[9],
    otpAktif:   row[11] === 'true',
  });
}

function handleGetDaftarList(auth) {
  const ss   = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sh   = ss.getSheetByName(SHEET.PENDAFTARAN);
  const rows = sh.getDataRange().getValues();

  const list = [];
  for (let i = 1; i < rows.length; i++) {
    list.push({
      refKode:      rows[i][0],
      namaSatker:   rows[i][1],
      kodeSatker:   rows[i][2],
      namaKpa:      rows[i][3],
      tanggalDaftar:rows[i][8],
      status:       rows[i][9],
      otpAktif:     rows[i][11] === 'true',
    });
  }

  return jsonOk({ list });
}

function handleGetDetail(data, auth) {
  const refKode = data.refKode || '';
  const row = findPendaftaran(refKode);
  if (!row) return jsonErr('Data tidak ditemukan');

  let filesJson = {};
  try { filesJson = JSON.parse(row[13] || '{}'); } catch(e) {}

  return jsonOk({
    refKode:      row[0],
    namaSatker:   row[1],
    kodeSatker:   row[2],
    namaKpa:      row[3],
    nip:          row[4],
    noHp:         row[5],
    email:        row[6],
    alamat:       row[7],
    tanggalDaftar:row[8],
    status:       row[9],
    otpCode:      auth.role === 'Admin' ? row[10] : '***',
    otpAktif:     row[11] === 'true',
    driveFolder:  row[12],
    files:        filesJson,
    catatanAdmin: row[14],
  });
}

function handleHapusData(data, auth) {
  if (auth.role !== 'Admin') return jsonErr('Hanya Admin yang bisa menghapus data');

  const refs = data.refs || [];
  if (!refs.length) return jsonErr('Tidak ada data yang dipilih');

  const ss   = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sh   = ss.getSheetByName(SHEET.PENDAFTARAN);
  const rows = sh.getDataRange().getValues();

  let deletedCount = 0;
  // Hapus dari bawah agar index tidak bergeser
  for (let i = rows.length - 1; i >= 1; i--) {
    if (refs.includes(rows[i][0])) {
      sh.deleteRow(i + 1);
      deletedCount++;
    }
  }

  // Hapus juga data pengguna terkait dari sheet PenggunaTerdaftar
  const shPengguna = ss.getSheetByName(SHEET.PENGGUNA);
  if (shPengguna) {
    const pRows = shPengguna.getDataRange().getValues();
    for (let i = pRows.length - 1; i >= 1; i--) {
      if (refs.includes(pRows[i][0])) shPengguna.deleteRow(i + 1);
    }
  }

  return jsonOk({ message: `${deletedCount} data berhasil dihapus`, deletedCount });
}

function handleAktivasiOTP(data, auth) {
  const refKode = data.refKode || '';
  const catatan = data.catatan || '';

  const ss   = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sh   = ss.getSheetByName(SHEET.PENDAFTARAN);
  const rows = sh.getDataRange().getValues();

  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === refKode) {
      sh.getRange(i + 1, 10).setValue('Aktif');   // status
      sh.getRange(i + 1, 12).setValue('true');    // otpAktif
      if (catatan) sh.getRange(i + 1, 15).setValue(catatan); // catatan
      return jsonOk({ message: 'OTP berhasil diaktivasi', refKode });
    }
  }

  return jsonErr('Data tidak ditemukan');
}

// ================================================================
// FILE UPLOAD KE GOOGLE DRIVE
// ================================================================
function handleUploadFile(data, auth) {
  const refKode    = data.refKode    || '';
  const namaSatker = data.namaSatker || 'Satker';
  const fileKey    = data.fileKey    || 'file';
  const fileName   = data.fileName   || 'dokumen';
  const fileData   = data.fileData   || '';   // base64
  const mimeType   = data.mimeType   || 'application/octet-stream';

  if (!fileData) return jsonErr('Data file kosong');
  if (!refKode)  return jsonErr('refKode wajib diisi');

  const rootFolder     = DriveApp.getFolderById(CONFIG.FOLDER_ID);
  const subFolderName  = `${refKode} — ${namaSatker}`;

  let subFolder;
  const existing = rootFolder.getFoldersByName(subFolderName);
  subFolder = existing.hasNext() ? existing.next() : rootFolder.createFolder(subFolderName);

  // Folder KTP untuk file KTP
  let targetFolder = subFolder;
  if (fileKey.startsWith('ktp_')) {
    const ktpFolders = subFolder.getFoldersByName('KTP');
    targetFolder = ktpFolders.hasNext() ? ktpFolders.next() : subFolder.createFolder('KTP');
  }

  // Simpan file
  const blob = Utilities.newBlob(Utilities.base64Decode(fileData), mimeType, fileName);
  const file = targetFolder.createFile(blob);

  // Set file agar hanya bisa diakses yang punya link (bukan publik)
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  const fileUrl    = file.getUrl();
  const folderUrl  = subFolder.getUrl();

  // Update filesJson di Sheets
  updateFilesJson(refKode, fileKey, { url: fileUrl, name: fileName });
  updateDriveFolder(refKode, folderUrl);

  return jsonOk({ success: true, fileUrl, folderUrl, fileName });
}

function updateFilesJson(refKode, fileKey, fileInfo) {
  const ss   = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sh   = ss.getSheetByName(SHEET.PENDAFTARAN);
  const rows = sh.getDataRange().getValues();

  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === refKode) {
      let filesJson = {};
      try { filesJson = JSON.parse(rows[i][13] || '{}'); } catch(e) {}
      filesJson[fileKey] = fileInfo;
      sh.getRange(i + 1, 14).setValue(JSON.stringify(filesJson));
      return;
    }
  }
}

function updateDriveFolder(refKode, folderUrl) {
  const ss   = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sh   = ss.getSheetByName(SHEET.PENDAFTARAN);
  const rows = sh.getDataRange().getValues();

  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === refKode) {
      sh.getRange(i + 1, 13).setValue(folderUrl);
      return;
    }
  }
}

// ================================================================
// MANAJEMEN USER ADMIN
// ================================================================
function handleGetUsers(auth) {
  if (auth.role !== 'Admin') return jsonErr('Hanya Admin yang bisa melihat daftar user');

  const ss   = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sh   = ss.getSheetByName(SHEET.USERS);
  const rows = sh.getDataRange().getValues();

  const users = [];
  for (let i = 1; i < rows.length; i++) {
    users.push({
      username:  rows[i][0],
      role:      rows[i][2],
      createdAt: rows[i][3],
    });
  }

  return jsonOk({ users });
}

function handleAddUser(data, auth) {
  if (auth.role !== 'Admin') return jsonErr('Hanya Admin yang bisa menambah user');

  const username = (data.username || '').trim();
  const password = data.password || '';
  const role     = data.role || 'Petugas';

  if (!username || !password) return jsonErr('Username dan password wajib diisi');
  if (password.length < 6)    return jsonErr('Password minimal 6 karakter');
  if (!['Admin','Petugas'].includes(role)) return jsonErr('Role tidak valid');

  const ss   = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sh   = ss.getSheetByName(SHEET.USERS);
  const rows = sh.getDataRange().getValues();

  // Cek duplikat
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === username) return jsonErr('Username sudah digunakan');
  }

  sh.appendRow([username, hashPassword(password), role, new Date().toISOString()]);
  return jsonOk({ message: `User '${username}' berhasil ditambahkan` });
}

function handleDeleteUser(data, auth) {
  if (auth.role !== 'Admin') return jsonErr('Hanya Admin yang bisa menghapus user');

  const username = data.username || '';
  if (username === auth.username) return jsonErr('Tidak bisa menghapus akun sendiri');

  const ss   = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sh   = ss.getSheetByName(SHEET.USERS);
  const rows = sh.getDataRange().getValues();

  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === username) {
      sh.deleteRow(i + 1);
      // Hapus semua session user ini
      cleanOldSessions(username);
      return jsonOk({ message: `User '${username}' berhasil dihapus` });
    }
  }

  return jsonErr('User tidak ditemukan');
}

function handleChangePassword(data, auth) {
  const passwordLama = data.passwordLama || '';
  const passwordBaru = data.passwordBaru || '';

  if (!passwordLama || !passwordBaru) return jsonErr('Password lama dan baru wajib diisi');
  if (passwordBaru.length < 6)        return jsonErr('Password baru minimal 6 karakter');

  const ss   = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sh   = ss.getSheetByName(SHEET.USERS);
  const rows = sh.getDataRange().getValues();

  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === auth.username) {
      if (rows[i][1] !== hashPassword(passwordLama)) {
        return jsonErr('Password lama salah');
      }
      sh.getRange(i + 1, 2).setValue(hashPassword(passwordBaru));
      return jsonOk({ message: 'Password berhasil diubah' });
    }
  }

  return jsonErr('User tidak ditemukan');
}

// ================================================================
// DASHBOARD STATS
// ================================================================
function handleGetDashboard(auth) {
  const ss   = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sh   = ss.getSheetByName(SHEET.PENDAFTARAN);
  const rows = sh.getDataRange().getValues();

  let total = 0, menunggu = 0, aktif = 0, ditolak = 0;
  for (let i = 1; i < rows.length; i++) {
    total++;
    const status = rows[i][9];
    if (status === 'Menunggu') menunggu++;
    else if (status === 'Aktif') aktif++;
    else if (status === 'Ditolak') ditolak++;
  }

  return jsonOk({ total, menunggu, aktif, ditolak });
}

// ================================================================
// HELPER FUNCTIONS
// ================================================================
function findPendaftaran(refKode) {
  const ss   = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sh   = ss.getSheetByName(SHEET.PENDAFTARAN);
  const rows = sh.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === refKode) return rows[i];
  }
  return null;
}

function hashPassword(password) {
  // SHA-256 via Utilities
  const raw     = password + CONFIG.ADMIN_SECRET;
  const bytes   = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, raw);
  return bytes.map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join('');
}

function generateToken() {
  return Utilities.getUuid() + '-' + new Date().getTime().toString(36);
}

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function jsonOk(obj) {
  return ContentService
    .createTextOutput(JSON.stringify({ success: true, ...obj }))
    .setMimeType(ContentService.MimeType.JSON);
}

function jsonErr(message) {
  return ContentService
    .createTextOutput(JSON.stringify({ success: false, message }))
    .setMimeType(ContentService.MimeType.JSON);
}
