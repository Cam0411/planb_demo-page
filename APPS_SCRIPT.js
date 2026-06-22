/**
 * GOOGLE APPS SCRIPT CODE (Code.gs)
 * 1. Create a Google Sheet.
 * 2. Create 2 tabs (sheets): "Videos" and "Comments".
 * 3. Go to Extensions > Apps Script.
 * 4. Paste this code and Deploy as Web App.
 * 5. Copy the Web App URL and paste it into .env.example (VITE_GOOGLE_SHEET_API_URL).
 */

const SPREADSHEET_ID = SpreadsheetApp.getActiveSpreadsheet().getId();

function doGet(e) {
  const action = e.parameter.action;
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  
  if (action === 'getVideos') {
    const sheet = ss.getSheetByName('Videos');
    const data = sheet.getDataRange().getValues();
    const headers = data.shift();
    const json = data.map(row => {
      let obj = {};
      headers.forEach((h, i) => obj[h] = row[i]);
      return obj;
    });
    return ContentService.createTextOutput(JSON.stringify(json)).setMimeType(ContentService.MimeType.JSON);
  }
  
  if (action === 'getComments') {
    const videoId = e.parameter.videoId;
    const version = e.parameter.version;
    const sheet = ss.getSheetByName('Comments');
    const data = sheet.getDataRange().getValues();
    const headers = data.shift();
    const json = data.filter(row => {
      // row[1] is videoId, row[7] is version (added at the end)
      const matchVideo = String(row[1]) === String(videoId);
      // Support old data where version might not exist (row[7])
      const rowVersion = row[7] || 'v1';
      const matchVersion = !version || String(rowVersion) === String(version);
      return matchVideo && matchVersion;
    }).map(row => {
                        let obj = {};
                        headers.forEach((h, i) => obj[h] = row[i]);
                        return obj;
                     });
    return ContentService.createTextOutput(JSON.stringify(json)).setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  const postData = JSON.parse(e.postData.contents);
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const action = postData.action;

  if (action === 'addVideo') {
    const sheet = ss.getSheetByName('Videos');
    const d = postData.data || postData;
    sheet.appendRow([
      d.videoId || d.id, 
      d.title, 
      d.youtubeUrl, 
      d.driveUrl || '', 
      d.thumbnail || '', 
      d.createdAt
    ]);
  }

  if (action === 'addComment') {
    const sheet = ss.getSheetByName('Comments');
    const d = postData.data || postData;
    // Enhanced columns: id, videoId, userId, content, frameTime, createdAt, resolved, version, priority, category
    sheet.appendRow([
      d.commentId || d.id, 
      d.videoId, 
      d.userId, 
      d.content, 
      d.frameTime, 
      d.createdAt, 
      d.resolved || false,
      d.version || 'v1',
      d.priority || 'Normal',
      d.category || 'Edit'
    ]);
  }

  if (action === 'updateComment') {
    const sheet = ss.getSheetByName('Comments');
    const data = sheet.getDataRange().getValues();
    const targetId = String(postData.commentId || postData.id).trim();
    for (let i = 1; i < data.length; i++) {
        if (String(data[i][0]).trim() === targetId) {
            // Update individual fields if provided
            if (postData.resolved !== undefined) sheet.getRange(i + 1, 7).setValue(postData.resolved);
            if (postData.priority) sheet.getRange(i + 1, 9).setValue(postData.priority);
            if (postData.category) sheet.getRange(i + 1, 10).setValue(postData.category);
            break;
        }
    }
  }

  if (action === 'toggleStatus') {
    const sheet = ss.getSheetByName('Comments');
    const data = sheet.getDataRange().getValues();
    const targetId = postData.commentId || postData.id;
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim() === String(targetId).trim()) {
        // resolved column is now G (column 7)
        sheet.getRange(i + 1, 7).setValue(postData.resolved);
        break;
      }
    }
  }

  if (action === 'deleteComment') {
    const sheetNames = ['Comments', 'Sheet1']; // Try common names
    let sheet;
    for (let name of sheetNames) {
      sheet = ss.getSheetByName(name);
      if (sheet) break;
    }
    if (!sheet) sheet = ss.getSheets()[0];
    if (!sheet) return ContentService.createTextOutput("Critical Error: No sheets found");
    
    const targetId = String(postData.commentId || postData.id || "").trim();
    if (!targetId) return ContentService.createTextOutput("Error: No ID provided");
    
    const range = sheet.getDataRange();
    const data = range.getValues();
    let deletedCount = 0;
    
    // Iterate backwards to safely delete multiple matches or just avoid index issues
    for (let i = data.length - 1; i >= 1; i--) {
        // Check first 3 columns as ID might be shifted
        const idInRow = String(data[i][0] || data[i][1] || data[i][2]).trim();
        if (idInRow === targetId) {
            sheet.deleteRow(i + 1);
            deletedCount++;
        }
    }
    
    if (deletedCount > 0) {
      return ContentService.createTextOutput("SUCCESS: Deleted " + deletedCount + " row(s) for ID " + targetId);
    } else {
      return ContentService.createTextOutput("FAIL: ID " + targetId + " not found in Sheet " + sheet.getName());
    }
  }

  if (action === 'deleteVideo') {
    const videoId = String(postData.videoId || postData.id).trim();
    if (!videoId) return ContentService.createTextOutput("Error: No videoId provided");

    // 1. Delete from Videos sheet
    const videoSheet = ss.getSheetByName('Videos');
    if (videoSheet) {
      const data = videoSheet.getDataRange().getValues();
      for (let i = data.length - 1; i >= 1; i--) {
        if (String(data[i][0]).trim() === videoId) {
          videoSheet.deleteRow(i + 1);
        }
      }
    }

    // 2. Delete associated comments
    const commentSheet = ss.getSheetByName('Comments');
    if (commentSheet) {
      const data = commentSheet.getDataRange().getValues();
      for (let i = data.length - 1; i >= 1; i--) {
        // row[1] is videoId
        if (String(data[i][1]).trim() === videoId) {
          commentSheet.deleteRow(i + 1);
        }
      }
    }
    
    return ContentService.createTextOutput("SUCCESS: Deleted video and comments for " + videoId);
  }

  if (action === 'addUser') {
    const sheet = ss.getSheetByName('Users') || ss.insertSheet('Users');
    const d = postData.data || postData;
    sheet.appendRow([d.userId || d.id, d.name, new Date().getTime()]);
  }

  return ContentService.createTextOutput("OK");
}
