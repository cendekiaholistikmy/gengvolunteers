/**
 * ═══════════════════════════════════════════════════════════════
 * GENGVOLUNTEERS 2.0 · BACKEND
 * Persatuan Belia Cendekia Holistik
 * ═══════════════════════════════════════════════════════════════
 *
 * FIRST TIME SETUP — do these in order:
 *
 *   1. Open your Google Sheet. Extensions > Apps Script.
 *   2. Delete whatever is in Code.gs and paste this whole file.
 *   3. Run the function  setup  once. Approve the permissions prompt.
 *      This builds every tab you need and fills in the defaults.
 *   4. Deploy > New deployment > Web app
 *        Execute as:      Me
 *        Who has access:  Anyone
 *   5. Copy the /exec URL it gives you into index.html at
 *        appsScriptUrl : "..."
 *
 * AFTER ANY EDIT you must redeploy, or the live URL keeps running
 * the old code:
 *   Deploy > Manage deployments > pencil > Version: New version > Deploy
 *
 * NEVER use File > Share > Publish to web on the spreadsheet itself.
 * That would expose every phone number in the Registrations tab.
 * This script is the only door in or out.
 * ═══════════════════════════════════════════════════════════════
 */

/* Leave blank when the script is bound to the Sheet (Extensions > Apps Script).
   Only fill this in if you created the script as a standalone project. */
var SHEET_ID = '';

var T_REG    = 'Registrations';
var T_CONFIG = 'Config';
var T_COUNT  = 'Counters';
var T_AUDIT  = 'Audit';

var HEADERS = [
  'Timestamp','Status','Name','Email','Phone','Telegram','Age','State','District',
  'Education level','Institution','School type','School name',
  'Course or field','Social handle',
  'Prior involvement','Preferred squad','Quiz squad','Highcom interest','Own transport',
  'Reasons for joining','Activity ideas','Guardian acknowledged','Dignity pledge','PDPA consent',
  'GV Code','Photo'
];

/* Pass numbering continues from cycle one. First new pass is 1582. */
var PASS_START = 1581;
var PASS_PREFIX = 'HLSTK-GV-2.0';
var PHOTO_FOLDER = 'GV2 Volunteer Photos';

/* Key, default value, and the note written beside it in the Config tab. */
var CONFIG_DEFAULTS = [
  ['capacity',   100,          'Hard cap on volunteer places. Registration closes when filled reaches this.'],
  ['forceOpen',  true,         'TRUE = form always visible. Set FALSE to respect openDate.'],
  ['openDate',   '2026-08-24', 'Registration opens (YYYY-MM-DD).'],
  ['closed',     false,        'TRUE = shut registration immediately, whatever the seat count says.'],
  ['announce',   '',           'Optional short line shown on the site. Leave blank for none.']
];

/* ═══════════════════════════════════════════════════════════════
   RUN THIS ONCE
   ═══════════════════════════════════════════════════════════════ */
function setup() {
  var ss = book();

  var reg = ss.getSheetByName(T_REG);
  if (!reg) reg = ss.insertSheet(T_REG);
  if (reg.getLastRow() === 0) reg.appendRow(HEADERS);
  reg.getRange(1, 1, 1, HEADERS.length)
     .setFontWeight('bold').setBackground('#1F2A44').setFontColor('#FFFFFF');
  reg.setFrozenRows(1);

  var cfg = ss.getSheetByName(T_CONFIG);
  if (!cfg) {
    cfg = ss.insertSheet(T_CONFIG);
    cfg.appendRow(['Key', 'Value', 'What it does']);
    CONFIG_DEFAULTS.forEach(function (r) { cfg.appendRow(r); });
  }
  cfg.getRange(1, 1, 1, 3)
     .setFontWeight('bold').setBackground('#1F2A44').setFontColor('#FFFFFF');
  cfg.setFrozenRows(1);
  cfg.setColumnWidth(3, 460);

  var cnt = ss.getSheetByName(T_COUNT);
  if (!cnt) {
    cnt = ss.insertSheet(T_COUNT);
    cnt.appendRow(['Metric', 'Value', 'Note']);
    cnt.appendRow(['visits', 0, 'Total page views since launch. Written by the site, do not edit.']);
    cnt.appendRow(['today', 0, 'Views since midnight. Resets itself.']);
    cnt.appendRow(['lastReset', new Date(), 'When the daily counter last rolled over.']);
    cnt.appendRow(['lastPassNo', PASS_START, 'Last GV Pass number issued. Next volunteer gets this + 1.']);
  }
  cnt.getRange(1, 1, 1, 3)
     .setFontWeight('bold').setBackground('#1F2A44').setFontColor('#FFFFFF');
  cnt.setFrozenRows(1);
  cnt.setColumnWidth(3, 460);

  var aud = ss.getSheetByName(T_AUDIT);
  if (!aud) {
    aud = ss.insertSheet(T_AUDIT);
    aud.appendRow(['Timestamp', 'Event', 'Detail']);
  }
  aud.getRange(1, 1, 1, 3)
     .setFontWeight('bold').setBackground('#1F2A44').setFontColor('#FFFFFF');
  aud.setFrozenRows(1);
  aud.setColumnWidth(3, 460);

  audit('setup', 'Tabs verified or created.');
  try {
    SpreadsheetApp.getActive().toast('Setup complete. Now deploy as a web app.', 'GengVolunteers', 8);
  } catch (err) {}
}

/* ═══════════════════════════════════════════════════════════════
   WRITE A REGISTRATION
   ═══════════════════════════════════════════════════════════════ */
function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var raw = (e && e.parameter && e.parameter.payload)
      ? e.parameter.payload
      : (e && e.postData ? e.postData.contents : '{}');
    var d = JSON.parse(raw);

    if (!d.name && !d.email && !d.phone) {
      return ok({ status: 'error', message: 'empty submission' });
    }

    var before = readState();
    var status = d.status || (before.filled >= before.capacity ? 'waitlist' : 'confirmed');

    var code  = nextPassCode();
    var photo = savePhoto(d.photo, d.name, code);

    var reg = regSheet();
    reg.appendRow([
      new Date(), status, d.name || '', d.email || '', d.phone || '',
      d.telegram || '', d.age || '', d.state || '', d.district || '',
      d.education || '', d.institution || '', d.schoolType || '', d.schoolName || '',
      d.course || '', d.socialHandle || '',
      d.priorInvolvement || '', d.squad || '', d.quizSquad || '',
      d.highcomInterest || '', d.transport || '', d.reason || '', d.ideas || '',
      d.guardianAck || '', d.pledge || '', d.consent || '',
      code, photo
    ]);

    var after = readState();
    if (status === 'confirmed' && after.filled >= after.capacity) {
      audit('full', 'Capacity reached at ' + after.filled + ' of ' + after.capacity + '.');
    }

    return ok({
      status: 'saved',
      placed: status,
      code: code,
      row: reg.getLastRow(),
      filled: after.filled,
      waitlist: after.waitlist,
      left: Math.max(0, after.capacity - after.filled)
    });
  } catch (err) {
    audit('error', String(err));
    return ok({ status: 'error', message: String(err) });
  } finally {
    lock.releaseLock();
  }
}

/* ═══════════════════════════════════════════════════════════════
   READ LIVE STATE  ·  the site calls this
   ?hit=1 counts the visit, no parameter just reads
   ═══════════════════════════════════════════════════════════════ */
function doGet(e) {
  var hit = !!(e && e.parameter && e.parameter.hit);
  var v = bumpVisits(hit);
  var s = readState();

  return ok({
    visits:   v.visits,
    today:    v.today,
    filled:   s.filled,
    waitlist: s.waitlist,
    capacity: s.capacity,
    left:     Math.max(0, s.capacity - s.filled),
    open:     s.open,
    announce: s.announce
  });
}

/* ═══════════════════════════════════════════════════════════════
   INTERNALS
   ═══════════════════════════════════════════════════════════════ */
function book() {
  var ss = SpreadsheetApp.getActive();
  if (!ss && SHEET_ID) ss = SpreadsheetApp.openById(SHEET_ID);
  if (!ss) throw new Error('No spreadsheet. Bind the script to a Sheet, or set SHEET_ID.');
  return ss;
}

function regSheet() {
  var ss = book();
  var sh = ss.getSheetByName(T_REG);
  if (!sh) { setup(); sh = ss.getSheetByName(T_REG); }
  return sh;
}

function readConfig() {
  var out = {};
  CONFIG_DEFAULTS.forEach(function (r) { out[r[0]] = r[1]; });
  try {
    var sh = book().getSheetByName(T_CONFIG);
    if (!sh) return out;
    var rows = sh.getDataRange().getValues();
    for (var i = 1; i < rows.length; i++) {
      var k = String(rows[i][0]).trim();
      if (k) out[k] = rows[i][1];
    }
  } catch (err) {}
  return out;
}

function readState() {
  var c = readConfig();
  var capacity = Number(c.capacity) || 100;
  var filled = 0, waitlist = 0;

  try {
    var rows = regSheet().getDataRange().getValues();
    for (var i = 1; i < rows.length; i++) {
      var st = String(rows[i][1]).toLowerCase();
      if (!rows[i][2] && !rows[i][3]) continue;
      if (st === 'cancelled' || st === 'withdrawn') continue;
      if (st === 'waitlist') waitlist++;
      else filled++;
    }
  } catch (err) {}

  var closed = truthy(c.closed);
  var openOk = truthy(c.forceOpen) || afterDate(c.openDate);

  return {
    capacity: capacity,
    filled: filled,
    waitlist: waitlist,
    announce: String(c.announce || ''),
    open: !closed && openOk && filled < capacity
  };
}

function bumpVisits(hit) {
  var ss;
  try { ss = book(); } catch (err) { return { visits: 0, today: 0 }; }
  var sh = ss.getSheetByName(T_COUNT);
  if (!sh) return { visits: 0, today: 0 };

  var lock = LockService.getScriptLock();
  try { lock.waitLock(8000); } catch (err) {}

  try {
    var rows = sh.getDataRange().getValues();
    var idx = {};
    for (var i = 1; i < rows.length; i++) idx[String(rows[i][0]).trim()] = i + 1;

    var visits = idx['visits'] ? Number(sh.getRange(idx['visits'], 2).getValue()) || 0 : 0;
    var today  = idx['today']  ? Number(sh.getRange(idx['today'], 2).getValue())  || 0 : 0;
    var last   = idx['lastReset'] ? sh.getRange(idx['lastReset'], 2).getValue() : null;

    var tz = ss.getSpreadsheetTimeZone() || 'Asia/Kuala_Lumpur';
    var stamp = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
    var lastStamp = last ? Utilities.formatDate(new Date(last), tz, 'yyyy-MM-dd') : '';

    if (stamp !== lastStamp) {
      today = 0;
      if (idx['lastReset']) sh.getRange(idx['lastReset'], 2).setValue(new Date());
    }

    if (hit) {
      visits++; today++;
      if (idx['visits']) sh.getRange(idx['visits'], 2).setValue(visits);
      if (idx['today'])  sh.getRange(idx['today'], 2).setValue(today);
    }
    return { visits: visits, today: today };
  } catch (err) {
    return { visits: 0, today: 0 };
  } finally {
    try { lock.releaseLock(); } catch (err) {}
  }
}

/* Atomically issue the next GV Pass code. Numbers are never reused,
   even if a registration is later cancelled. */
function nextPassCode() {
  var n = PASS_START + 1;
  try {
    var ss = book();
    var sh = ss.getSheetByName(T_COUNT);
    if (sh) {
      var rows = sh.getDataRange().getValues();
      var row = 0;
      for (var i = 1; i < rows.length; i++) {
        if (String(rows[i][0]).trim() === 'lastPassNo') { row = i + 1; break; }
      }
      if (!row) {
        sh.appendRow(['lastPassNo', PASS_START, 'Last GV Pass number issued.']);
        row = sh.getLastRow();
      }
      var last = Number(sh.getRange(row, 2).getValue()) || PASS_START;
      n = last + 1;
      sh.getRange(row, 2).setValue(n);
    }
    var tz = ss.getSpreadsheetTimeZone() || 'Asia/Kuala_Lumpur';
    var stamp = Utilities.formatDate(new Date(), tz, 'yyyyMMdd');
    return PASS_PREFIX + '-' + stamp + '-' + n;
  } catch (err) {
    audit('error', 'pass code: ' + err);
    return PASS_PREFIX + '-' + Utilities.formatDate(new Date(), 'Asia/Kuala_Lumpur', 'yyyyMMdd') + '-' + n;
  }
}

/* Store the optional photo in Drive and return a viewable link.
   Nothing is stored if the volunteer skipped it. */
function savePhoto(dataUrl, name, code) {
  if (!dataUrl || String(dataUrl).indexOf('data:image/') !== 0) return '';
  try {
    var parts = String(dataUrl).split(',');
    var meta = parts[0], b64 = parts[1];
    if (!b64) return '';
    var type = meta.substring(meta.indexOf(':') + 1, meta.indexOf(';'));
    var ext = type.indexOf('png') > -1 ? 'png' : 'jpg';
    var blob = Utilities.newBlob(Utilities.base64Decode(b64), type,
      (code || 'GV') + '-' + String(name || 'volunteer').replace(/[^A-Za-z0-9]/g, '_') + '.' + ext);

    var it = DriveApp.getFoldersByName(PHOTO_FOLDER);
    var folder = it.hasNext() ? it.next() : DriveApp.createFolder(PHOTO_FOLDER);
    var file = folder.createFile(blob);
    return file.getUrl();
  } catch (err) {
    audit('error', 'photo: ' + err);
    return '';
  }
}

function audit(evt, detail) {
  try {
    var sh = book().getSheetByName(T_AUDIT);
    if (sh) sh.appendRow([new Date(), evt, detail]);
  } catch (err) {}
}

function truthy(v) {
  if (v === true) return true;
  var s = String(v).trim().toLowerCase();
  return s === 'true' || s === 'yes' || s === 'y' || s === '1';
}

function afterDate(v) {
  if (!v) return true;
  var d = (v instanceof Date) ? v : new Date(String(v));
  if (isNaN(d.getTime())) return true;
  return Date.now() >= d.getTime();
}

function ok(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/* Optional: run this to check everything works before deploying. */
function selfTest() {
  var s = readState();
  var v = bumpVisits(false);
  Logger.log('capacity=%s filled=%s waitlist=%s open=%s visits=%s today=%s',
             s.capacity, s.filled, s.waitlist, s.open, v.visits, v.today);
}
