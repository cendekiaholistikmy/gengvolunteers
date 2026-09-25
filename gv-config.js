/* ═══════════════════════════════════════════════════════════════
   GENGVOLUNTEERS 2.0 · HIGHCOM PAGE SETTINGS
   ═══════════════════════════════════════════════════════════════

   This is the only file you ever need to edit to change how the
   HighCom page behaves. It lives next to highcom.html in the repo.
   Change a line, commit, hard refresh. Nothing else to rebuild.

   appsScriptUrl
     Your Apps Script web app address. Get it from the Apps Script
     editor: Deploy > Manage deployments > copy the Web app URL.
     It must end in /exec, never /dev.
     Nothing is saved to the spreadsheet until this is correct.

   deadline
     When applications close. The countdown clock reads this, and
     the form locks itself the moment it passes.

   opened
     When you announced the link. Only feeds the progress bar.

   Times are Malaysian time, which is the +08:00 on the end.

   To check your work, open:
     https://cendekiaholistikmy.github.io/gengvolunteers/highcom.html?selftest=1
   A green bar means submissions will reach the spreadsheet.
   A red bar means they will not, and tells you why.
   ═══════════════════════════════════════════════════════════════ */

window.GV_CONFIG = {

  appsScriptUrl : "PASTE_YOUR_EXEC_URL_HERE",

  deadline      : "2026-10-01T12:00:00+08:00",

  opened        : "2026-09-25T09:00:00+08:00"

};
