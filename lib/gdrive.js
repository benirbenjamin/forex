// Google Drive File Storage using OAuth2 Refresh Token
// Provides seamless uploads to Google Drive with resilient local disk fallback

const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const db = require('./db');

const UPLOADS_DIR = path.join(__dirname, '../public/uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

async function getGoogleDriveConfig() {
  let clientId = process.env.GOOGLE_CLIENT_ID;
  let clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  let refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  let folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

  // Check platform_settings in database
  try {
    if (db.isConnectedToPostgres()) {
      const res = await db.query("SELECT value FROM platform_settings WHERE key = 'google_drive_credentials' LIMIT 1");
      if (res.rowCount > 0 && res.rows[0].value) {
        const val = res.rows[0].value;
        if (val.client_id) clientId = val.client_id;
        if (val.client_secret) clientSecret = val.client_secret;
        if (val.refresh_token) refreshToken = val.refresh_token;
        if (val.folder_id) folderId = val.folder_id;
      }
    }
  } catch (e) {}

  return { clientId, clientSecret, refreshToken, folderId };
}

async function uploadToGoogleDrive(filePath, originalFilename, mimeType) {
  const config = await getGoogleDriveConfig();

  // If Google Drive credentials are fully provided, upload to Drive
  if (config.clientId && config.clientSecret && config.refreshToken) {
    try {
      const oauth2Client = new google.auth.OAuth2(
        config.clientId,
        config.clientSecret,
        'https://developers.google.com/oauthplayground'
      );
      oauth2Client.setCredentials({ refresh_token: config.refreshToken });

      const drive = google.drive({ version: 'v3', auth: oauth2Client });

      const fileMetadata = {
        name: `fds_${Date.now()}_${originalFilename}`,
        parents: config.folderId ? [config.folderId] : []
      };

      const media = {
        mimeType: mimeType || 'image/jpeg',
        body: fs.createReadStream(filePath)
      };

      const file = await drive.files.create({
        resource: fileMetadata,
        media: media,
        fields: 'id, name, webViewLink, webContentLink'
      });

      // Make file publicly readable
      try {
        await drive.permissions.create({
          fileId: file.data.id,
          requestBody: { role: 'reader', type: 'anyone' }
        });
      } catch (permErr) {}

      console.log(`✅ File uploaded to Google Drive: ${file.data.name} (ID: ${file.data.id})`);
      return {
        url: `https://drive.google.com/uc?id=${file.data.id}&export=view`,
        viewUrl: file.data.webViewLink,
        driveFileId: file.data.id,
        storage: 'google_drive'
      };
    } catch (err) {
      console.warn('⚠️ Google Drive upload error (falling back to secure local storage):', err.message);
    }
  }

  // Fallback: Local storage in /public/uploads/
  const ext = path.extname(originalFilename) || '.jpg';
  const localFileName = `proof_${Date.now()}_${Math.random().toString(36).substring(2, 8)}${ext}`;
  const targetPath = path.join(UPLOADS_DIR, localFileName);

  fs.copyFileSync(filePath, targetPath);

  return {
    url: `/uploads/${localFileName}`,
    storage: 'local'
  };
}

module.exports = {
  uploadToGoogleDrive,
  getGoogleDriveConfig,
  UPLOADS_DIR
};
