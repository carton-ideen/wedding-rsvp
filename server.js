const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const helmet = require('helmet');
const rateLimit = (require('express-rate-limit').rateLimit || require('express-rate-limit').default || require('express-rate-limit'));

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'change-me';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'cristina&raffaele';

const db = new Database(path.join(__dirname, 'rsvp.sqlite'));

db.exec(`
  CREATE TABLE IF NOT EXISTS rsvps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    contact TEXT,
    attending TEXT NOT NULL CHECK(attending IN ('yes','no')),
    total_guests INTEGER,
    menu_meat INTEGER,
    menu_vegi INTEGER,
    menu_kids INTEGER,
    allergies_has INTEGER NOT NULL DEFAULT 0,
    allergies_text TEXT,
    guest_names TEXT,
    guest_details TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )
`);
try {
  db.prepare('ALTER TABLE rsvps ADD COLUMN guest_names TEXT').run();
} catch (e) {
  if (!/duplicate column name/i.test(e.message)) throw e;
}
try {
  db.prepare('ALTER TABLE rsvps ADD COLUMN guest_details TEXT').run();
} catch (e) {
  if (!/duplicate column name/i.test(e.message)) throw e;
}

db.exec(`
  CREATE TABLE IF NOT EXISTS tischplan (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    data TEXT NOT NULL DEFAULT '{"tables":[],"assignments":{}}'
  )
`);
db.prepare('INSERT OR IGNORE INTO tischplan (id, data) VALUES (1, ?)').run('{"tables":[],"assignments":{}}');

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '50kb' }));
app.use(express.static(path.join(__dirname, 'public')));

var rsvpLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { ok: false, error: 'Zu viele Anfragen. Bitte kurz warten.' },
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api/rsvp', rsvpLimiter);

var adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { ok: false, error: 'Zu viele Login-Versuche. Bitte später erneut versuchen.' },
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api/admin/login', adminLoginLimiter);

const MAX_NAME_LENGTH = 200;
const MAX_CONTACT_LENGTH = 200;
const MAX_ALLERGIES_LENGTH = 500;

function validateRsvp(body) {
  const errors = [];
  const name = String(body.name || '').trim().slice(0, MAX_NAME_LENGTH);
  if (!name || name.length < 1) errors.push('Bitte gib einen Namen ein.');
  const contact = String(body.contact || '').trim().slice(0, MAX_CONTACT_LENGTH);
  const attending = String(body.attending || '').toLowerCase();
  if (attending !== 'yes' && attending !== 'no') {
    errors.push('Bitte wähle, ob du kommst oder nicht.');
  }

  let allergiesHas = false;
  let allergiesText = '';
  if (attending === 'yes') {
    const guestDetails = Array.isArray(body.guest_details) ? body.guest_details : [];
    if (guestDetails.length > 0) {
      const total = guestDetails.length;
      if (total < 1 || total > 20) {
        errors.push('Anzahl Gäste muss zwischen 1 und 20 liegen.');
      }
      const menuTypes = ['meat', 'vegi', 'kids'];
      for (let i = 0; i < guestDetails.length; i++) {
        const g = guestDetails[i];
        const gName = String(g.name || '').trim().slice(0, MAX_NAME_LENGTH);
        if (!gName.length) errors.push('Bitte für jeden Gast einen Namen eintragen.');
        const mt = String(g.menu_type || '').toLowerCase();
        if (!menuTypes.includes(mt)) errors.push('Bitte für jeden Gast ein Menü (Fleisch / Vegetarisch / Kinder) wählen.');
        const aHas = g.allergies_has === true || g.allergies_has === 'true' || g.allergies_has === 1 || g.allergies_has === '1';
        const aText = String(g.allergies_text || '').trim().slice(0, MAX_ALLERGIES_LENGTH);
        if (aHas && aText.length < 2) errors.push('Bitte Allergien beschreiben (mind. 2 Zeichen), sofern angegeben.');
      }
    } else {
      const total = parseInt(body.total_guests, 10);
      if (Number.isNaN(total) || total < 1 || total > 20) {
        errors.push('Anzahl Gäste muss zwischen 1 und 20 liegen.');
      }
      const guestNames = Array.isArray(body.guest_names) ? body.guest_names : [];
      if (Number.isInteger(total) && total > 1) {
        const needed = total - 1;
        if (guestNames.length !== needed) {
          errors.push('Bitte Namen aller weiteren Gäste eintragen.');
        } else {
          for (let i = 0; i < needed; i++) {
            const n = String(guestNames[i] || '').trim().slice(0, MAX_NAME_LENGTH);
            if (n.length < 1) errors.push('Bitte Namen aller weiteren Gäste eintragen.');
          }
        }
      }
      const meat = parseInt(body.menu_meat, 10) || 0;
      const vegi = parseInt(body.menu_vegi, 10) || 0;
      const kids = parseInt(body.menu_kids, 10) || 0;
      if (meat < 0 || vegi < 0 || kids < 0) {
        errors.push('Menüanzahlen dürfen nicht negativ sein.');
      }
      const sum = meat + vegi + kids;
      if (Number.isInteger(total) && sum !== total) {
        errors.push('Die Summe der Menüs (Fleisch + Vegetarisch + Kinder) muss der Anzahl Gäste entsprechen.');
      }
    }
  }

  if (!Array.isArray(body.guest_details) || body.guest_details.length === 0) {
    allergiesHas = body.allergies_has === true || body.allergies_has === 'true' || body.allergies_has === '1';
    allergiesText = String(body.allergies_text || '').trim().slice(0, MAX_ALLERGIES_LENGTH);
    if (allergiesHas && allergiesText.length < 2) {
      errors.push('Bitte beschreibe die Allergien (mindestens 2 Zeichen).');
    }
  }

  return { errors, name, contact, attending, body, allergiesHas, allergiesText };
}

app.post('/api/rsvp', (req, res) => {
  const { errors, name, contact, attending, body, allergiesHas, allergiesText } = validateRsvp(req.body);
  if (errors.length > 0) {
    return res.status(400).json({ ok: false, error: errors.join(' ') });
  }

  let total_guests = null;
  let menu_meat = null;
  let menu_vegi = null;
  let menu_kids = null;
  let guest_names_json = null;
  let guest_details_json = null;
  let saveName = name;
  if (attending === 'yes') {
    const guestDetails = Array.isArray(body.guest_details) ? body.guest_details : [];
    if (guestDetails.length > 0) {
      total_guests = guestDetails.length;
      let meat = 0, vegi = 0, kids = 0;
      const details = guestDetails.map((g) => {
        const mt = String(g.menu_type || '').toLowerCase();
        if (mt === 'meat') meat++;
        else if (mt === 'vegi') vegi++;
        else if (mt === 'kids') kids++;
        return {
          name: String(g.name || '').trim().slice(0, MAX_NAME_LENGTH),
          menu_type: mt === 'meat' || mt === 'vegi' || mt === 'kids' ? mt : 'meat',
          allergies_has: (g.allergies_has === true || g.allergies_has === 'true' || g.allergies_has === 1 || g.allergies_has === '1') ? 1 : 0,
          allergies_text: String(g.allergies_text || '').trim().slice(0, MAX_ALLERGIES_LENGTH)
        };
      });
      if (details[0] && details[0].name) saveName = details[0].name;
      menu_meat = meat;
      menu_vegi = vegi;
      menu_kids = kids;
      guest_details_json = JSON.stringify(details);
    } else {
      total_guests = parseInt(body.total_guests, 10);
      menu_meat = parseInt(body.menu_meat, 10) || 0;
      menu_vegi = parseInt(body.menu_vegi, 10) || 0;
      menu_kids = parseInt(body.menu_kids, 10) || 0;
      const guestNames = Array.isArray(body.guest_names) ? body.guest_names : [];
      if (guestNames.length > 0) {
        const names = guestNames.slice(0, (total_guests || 1) - 1).map((n) => String(n || '').trim().slice(0, MAX_NAME_LENGTH));
        guest_names_json = JSON.stringify(names);
      }
    }
  }

  try {
    const stmt = db.prepare(`
      INSERT INTO rsvps (name, contact, attending, total_guests, menu_meat, menu_vegi, menu_kids, allergies_has, allergies_text, guest_names, guest_details)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(saveName, contact || null, attending, total_guests, menu_meat, menu_vegi, menu_kids, allergiesHas ? 1 : 0, allergiesHas ? allergiesText : null, guest_names_json, guest_details_json);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'Speichern fehlgeschlagen. Bitte später erneut versuchen.' });
  }
});

function requireAdminToken(req, res) {
  const token = req.query.token;
  if (token !== ADMIN_TOKEN) {
    res.status(401).json({ ok: false, error: 'Nicht autorisiert.' });
    return false;
  }
  return true;
}

app.post('/api/admin/login', (req, res) => {
  const password = (req.body && req.body.password) ? String(req.body.password).trim() : '';
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ ok: false, error: 'Falsches Passwort.' });
  }
  res.json({ ok: true, token: ADMIN_TOKEN });
});

app.get('/api/admin/rsvps', (req, res) => {
  if (!requireAdminToken(req, res)) return;
  const rows = db.prepare('SELECT * FROM rsvps ORDER BY created_at DESC').all();
  const rsvps = rows.map((r) => {
    const out = { ...r };
    if (out.guest_names != null && out.guest_names !== '') {
      try {
        out.guest_names = JSON.parse(out.guest_names);
      } catch (e) {
        out.guest_names = null;
      }
    } else {
      out.guest_names = null;
    }
    if (out.guest_details != null && out.guest_details !== '') {
      try {
        out.guest_details = JSON.parse(out.guest_details);
      } catch (e) {
        out.guest_details = null;
      }
    } else {
      out.guest_details = null;
    }
    return out;
  });
  res.json({ ok: true, rsvps });
});

app.get('/api/admin/tischplan', (req, res) => {
  if (!requireAdminToken(req, res)) return;
  try {
    const row = db.prepare('SELECT data FROM tischplan WHERE id = 1').get();
    const data = row && row.data ? JSON.parse(row.data) : { tables: [], assignments: {} };
    if (!Array.isArray(data.tables)) data.tables = [];
    if (typeof data.assignments !== 'object' || data.assignments === null) data.assignments = {};
    res.json({ ok: true, plan: data });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'Tischplan konnte nicht geladen werden.' });
  }
});

app.put('/api/admin/tischplan', (req, res) => {
  if (!requireAdminToken(req, res)) return;
  const body = req.body || {};
  let tables = Array.isArray(body.tables) ? body.tables : [];
  let assignments = typeof body.assignments === 'object' && body.assignments !== null ? body.assignments : {};
  tables = tables.map((t) => ({
    id: String(t.id || '').slice(0, 50),
    name: String(t.name || 'Tisch').slice(0, 100),
    capacity: Math.max(1, Math.min(99, parseInt(t.capacity, 10) || 1)),
    x: Math.max(0, Math.min(100, parseFloat(t.x) || 0)),
    y: Math.max(0, Math.min(100, parseFloat(t.y) || 0)),
    shape: String(t.shape || 'rect').toLowerCase() === 'round' ? 'round' : 'rect',
    rotation: Math.max(0, Math.min(360, parseFloat(t.rotation) || 0))
  })).filter((t) => t.id);
  const assignmentsClean = {};
  for (const [key, tableId] of Object.entries(assignments)) {
    const k = String(key);
    const tid = String(tableId);
    if (k && tid) assignmentsClean[k] = tid;
  }
  try {
    const data = JSON.stringify({ tables, assignments: assignmentsClean });
    db.prepare('UPDATE tischplan SET data = ? WHERE id = 1').run(data);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'Tischplan konnte nicht gespeichert werden.' });
  }
});

app.delete('/api/admin/rsvps/:id', (req, res) => {
  if (!requireAdminToken(req, res)) return;
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id) || id < 1) {
    return res.status(400).json({ ok: false, error: 'Ungültige ID.' });
  }
  try {
    const result = db.prepare('DELETE FROM rsvps WHERE id = ?').run(id);
    if (result.changes === 0) {
      return res.status(404).json({ ok: false, error: 'Eintrag nicht gefunden.' });
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'Löschen fehlgeschlagen.' });
  }
});

function formatDatePdf(createdAt) {
  if (!createdAt) return '';
  const m = String(createdAt).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return m[3] + '.' + m[2] + '.' + m[1];
  return String(createdAt);
}

/** Allergien aus Hauptgast + Mitgästen (guest_details) zusammenführen für PDF/Excel. */
function getMergedAllergies(r) {
  const parts = [];
  const mainHas = !!(r.allergies_has === 1 || r.allergies_has === true);
  const mainText = (r.allergies_text != null && String(r.allergies_text).trim()) ? String(r.allergies_text).trim() : '';
  if (mainHas && mainText) {
    parts.push((r.name || 'Hauptgast') + ': ' + mainText);
  }
  let guestDetails = [];
  if (r.guest_details != null && String(r.guest_details).trim() !== '') {
    try {
      guestDetails = JSON.parse(r.guest_details);
    } catch (e) {
      guestDetails = [];
    }
  }
  if (Array.isArray(guestDetails)) {
    for (let j = 0; j < guestDetails.length; j++) {
      const g = guestDetails[j];
      const gHas = !!(g.allergies_has === 1 || g.allergies_has === true);
      const gText = (g.allergies_text != null && String(g.allergies_text).trim()) ? String(g.allergies_text).trim() : '';
      if (gHas && gText) {
        parts.push((g.name || 'Gast') + ': ' + gText);
      }
    }
  }
  const text = parts.join('; ');
  return { has: parts.length > 0, text };
}

app.get('/api/admin/rsvps.pdf', (req, res) => {
  if (!requireAdminToken(req, res)) return;
  const rows = db.prepare('SELECT * FROM rsvps ORDER BY created_at DESC').all();
  let sumYes = 0, sumNo = 0, sumGuests = 0, sumMeat = 0, sumVegi = 0, sumKids = 0;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (r.attending === 'yes') {
      sumYes++;
      sumGuests += r.total_guests || 0;
      sumMeat += r.menu_meat || 0;
      sumVegi += r.menu_vegi || 0;
      sumKids += r.menu_kids || 0;
    } else sumNo++;
  }

  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="Rueckmeldungen_Cristina_Raffaele.pdf"');
  doc.pipe(res);

  const gold = '#c79a58';
  const gray = '#5a5a5a';
  const lightBg = '#f7f5f1';

  doc.fontSize(22).fillColor(gold).text('Rückmeldungen', { align: 'center' });
  doc.moveDown(0.3);
  doc.fontSize(18).text('Cristina & Raffaele', { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(11).fillColor(gray).text('Auswertung der Anmeldungen', { align: 'center' });
  doc.moveDown(1.2);

  const summaryY = doc.y;
  doc.fontSize(12).fillColor('black').font('Helvetica-Bold').text('Zusammenfassung', 50, summaryY);
  doc.moveDown(0.6);
  const boxY = doc.y;
  const boxH = 36;
  const col1 = 50, col2 = 180, col3 = 310;
  const labels = ['Zusagen', 'Absagen', 'Gesamtgäste', 'Menü Fleisch', 'Menü Vegetarisch', 'Menü Kinder'];
  const values = [sumYes, sumNo, sumGuests, sumMeat, sumVegi, sumKids];
  for (let i = 0; i < 6; i++) {
    const x = i % 3 === 0 ? col1 : i % 3 === 1 ? col2 : col3;
    const y = boxY + Math.floor(i / 3) * (boxH + 8);
    doc.roundedRect(x, y, 120, boxH, 4).fillAndStroke(lightBg, gold);
    doc.fontSize(9).fillColor(gray).font('Helvetica').text(labels[i], x + 10, y + 8, { width: 100 });
    doc.fontSize(14).fillColor(gold).font('Helvetica-Bold').text(String(values[i]), x + 10, y + 22, { width: 100 });
  }
  doc.y = boxY + 2 * (boxH + 8) + 20;

  doc.fontSize(12).fillColor('black').font('Helvetica-Bold').text('Details', 50, doc.y);
  doc.moveDown(0.5);

  const tableTop = doc.y;
  const colW = [42, 52, 58, 28, 28, 28, 28, 28, 28, 70];
  const headers = ['Datum', 'Name', 'Kontakt', 'Status', 'Gäste', 'Fleisch', 'Vegi', 'Kinder', 'Allerg.', 'Allergietext'];
  const rowH = 22;
  doc.rect(50, tableTop, colW.reduce((a, b) => a + b, 0), rowH).fill(gold);
  let x = 50;
  doc.fontSize(8).fillColor('white').font('Helvetica-Bold');
  for (let c = 0; c < headers.length; c++) {
    doc.text(headers[c], x + 4, tableTop + 6, { width: colW[c] - 6, ellipsis: true });
    x += colW[c];
  }
  doc.y = tableTop + rowH;

  doc.font('Helvetica').fillColor('black').fontSize(8);
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (doc.y > 700) {
      doc.addPage();
      doc.y = 50;
      doc.rect(50, doc.y, colW.reduce((a, b) => a + b, 0), rowH).fill(gold);
      x = 50;
      doc.fillColor('white').font('Helvetica-Bold');
      for (let c = 0; c < headers.length; c++) {
        doc.text(headers[c], x + 4, doc.y + 6, { width: colW[c] - 6, ellipsis: true });
        x += colW[c];
      }
      doc.y += rowH;
      doc.fillColor('black').font('Helvetica');
    }
    const isYes = r.attending === 'yes';
    const dash = '–';
    const merged = getMergedAllergies(r);
    const cells = [
      formatDatePdf(r.created_at),
      (r.name || '').substring(0, 14),
      (r.contact || '').substring(0, 14),
      isYes ? 'Ja' : 'Nein',
      isYes ? String(r.total_guests != null ? r.total_guests : dash) : dash,
      isYes ? String(r.menu_meat != null ? r.menu_meat : dash) : dash,
      isYes ? String(r.menu_vegi != null ? r.menu_vegi : dash) : dash,
      isYes ? String(r.menu_kids != null ? r.menu_kids : dash) : dash,
      merged.has ? 'ja' : 'nein',
      merged.text.substring(0, 22)
    ];
    const rowY = doc.y;
    x = 50;
    for (let c = 0; c < cells.length; c++) {
      doc.text(cells[c], x + 4, rowY + 5, { width: colW[c] - 6, ellipsis: true });
      x += colW[c];
    }
    doc.y = rowY + rowH;
  }

  doc.end();
});

function formatDateExcel(createdAt) {
  if (!createdAt) return '';
  const m = String(createdAt).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return m[3] + '.' + m[2] + '.' + m[1];
  return String(createdAt);
}

app.get('/api/admin/rsvps.xlsx', async (req, res) => {
  if (!requireAdminToken(req, res)) return;
  const rows = db.prepare('SELECT * FROM rsvps ORDER BY created_at DESC').all();
  let sumYes = 0, sumNo = 0, sumGuests = 0, sumMeat = 0, sumVegi = 0, sumKids = 0;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (r.attending === 'yes') {
      sumYes++;
      sumGuests += r.total_guests || 0;
      sumMeat += r.menu_meat || 0;
      sumVegi += r.menu_vegi || 0;
      sumKids += r.menu_kids || 0;
    } else sumNo++;
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Hochzeit Cristina & Raffaele';
  workbook.created = new Date();

  const gold = 'FFC79A58';
  const goldFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: gold } };
  const lightBg = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF7F5F1' } };
  const goldBorder = {
    top: { style: 'thin', color: { argb: gold } },
    left: { style: 'thin', color: { argb: gold } },
    bottom: { style: 'thin', color: { argb: gold } },
    right: { style: 'thin', color: { argb: gold } }
  };

  const sheet = workbook.addWorksheet('Auswertung', { views: [{ showGridLines: true }] });
  sheet.columns = [
    { width: 14 }, { width: 18 }, { width: 18 }, { width: 8 }, { width: 8 },
    { width: 8 }, { width: 10 }, { width: 8 }, { width: 8 }, { width: 24 }
  ];

  sheet.mergeCells(1, 1, 1, 10);
  const titleCell = sheet.getCell(1, 1);
  titleCell.value = 'Rückmeldungen';
  titleCell.font = { size: 18, bold: true, color: { argb: gold } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

  sheet.mergeCells(2, 1, 2, 10);
  const subtitleCell = sheet.getCell(2, 1);
  subtitleCell.value = 'Cristina & Raffaele';
  subtitleCell.font = { size: 14, color: { argb: gold } };
  subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' };

  sheet.mergeCells(3, 1, 3, 10);
  const sub2 = sheet.getCell(3, 1);
  sub2.value = 'Auswertung der Anmeldungen';
  sub2.font = { size: 11, color: { argb: 'FF5A5A5A' } };
  sub2.alignment = { horizontal: 'center', vertical: 'middle' };

  sheet.getCell(5, 1).value = 'Zusammenfassung';
  sheet.getCell(5, 1).font = { size: 12, bold: true };

  const summaryLabels1 = ['Zusagen', 'Absagen', 'Gesamtgäste'];
  const summaryVals1 = [sumYes, sumNo, sumGuests];
  for (let c = 0; c < 3; c++) {
    const cellLabel = sheet.getCell(6, c + 1);
    const cellVal = sheet.getCell(7, c + 1);
    cellLabel.value = summaryLabels1[c];
    cellLabel.fill = lightBg;
    cellLabel.border = goldBorder;
    cellLabel.font = { size: 10, color: { argb: 'FF5A5A5A' } };
    cellLabel.alignment = { vertical: 'middle', wrapText: true };
    cellVal.value = summaryVals1[c];
    cellVal.fill = lightBg;
    cellVal.border = goldBorder;
    cellVal.font = { size: 12, bold: true, color: { argb: gold } };
    cellVal.alignment = { vertical: 'middle' };
  }

  const summaryLabels2 = ['Menü Fleisch', 'Menü Vegetarisch', 'Menü Kinder'];
  const summaryVals2 = [sumMeat, sumVegi, sumKids];
  for (let c = 0; c < 3; c++) {
    const cellLabel = sheet.getCell(8, c + 1);
    const cellVal = sheet.getCell(9, c + 1);
    cellLabel.value = summaryLabels2[c];
    cellLabel.fill = lightBg;
    cellLabel.border = goldBorder;
    cellLabel.font = { size: 10, color: { argb: 'FF5A5A5A' } };
    cellLabel.alignment = { vertical: 'middle', wrapText: true };
    cellVal.value = summaryVals2[c];
    cellVal.fill = lightBg;
    cellVal.border = goldBorder;
    cellVal.font = { size: 12, bold: true, color: { argb: gold } };
    cellVal.alignment = { vertical: 'middle' };
  }

  sheet.getCell(11, 1).value = 'Details';
  sheet.getCell(11, 1).font = { size: 12, bold: true };

  const detailHeaders = ['Datum', 'Name', 'Kontakt', 'Status', 'Gäste', 'Fleisch', 'Vegetarisch', 'Kinder', 'Allergien', 'Allergietext'];
  for (let c = 1; c <= 10; c++) {
    const cell = sheet.getCell(12, c);
    cell.value = detailHeaders[c - 1];
    cell.fill = goldFill;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
  }

  rows.forEach((r, i) => {
    const merged = getMergedAllergies(r);
    const row = sheet.getRow(13 + i);
    row.values = [
      formatDateExcel(r.created_at),
      r.name || '',
      r.contact || '',
      r.attending === 'yes' ? 'Ja' : 'Nein',
      r.total_guests != null ? r.total_guests : '',
      r.menu_meat != null ? r.menu_meat : '',
      r.menu_vegi != null ? r.menu_vegi : '',
      r.menu_kids != null ? r.menu_kids : '',
      merged.has ? 'ja' : 'nein',
      merged.text || ''
    ];
    row.alignment = { vertical: 'middle', wrapText: true };
  });

  const buffer = await workbook.xlsx.writeBuffer();
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="Rückmeldungen_Cristina_Raffaele.xlsx"');
  res.send(buffer);
});

app.listen(PORT, () => {
  console.log('RSVP-Server läuft auf Port', PORT);
});
