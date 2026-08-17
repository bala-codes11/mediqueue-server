const { google } = require("googleapis");

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET
);

oauth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN
});

const gmail = google.gmail({
  version: "v1",
  auth: oauth2Client
});

function createRawEmail({ to, subject, html }) {
  const message = [
    `From: ClinicFlow <${process.env.GMAIL_USER}>`,
    `To: ${to}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/html; charset=UTF-8",
    "",
    html
  ].join("\r\n");

  return Buffer
    .from(message)
    .toString("base64url");
}

async function sendEmail({ to, subject, html }) {
  try {
    const raw = createRawEmail({
      to,
      subject,
      html
    });

    const response = await gmail.users.messages.send({
      userId: "me",
      requestBody: {
        raw
      }
    });

    console.log(
      `📧 Email sent successfully to ${to}`
    );

    return response.data;
  } catch (error) {
    console.error(
      "❌ Gmail API error:",
      error.response?.data || error.message
    );

    throw error;
  }
}

module.exports = {
  sendEmail
};