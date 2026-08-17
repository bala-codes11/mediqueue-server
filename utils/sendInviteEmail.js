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

/* ======================================================
   CREATE RAW EMAIL
====================================================== */

const createRawEmail = ({
  to,
  subject,
  html
}) => {
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
};

/* ======================================================
   SEND DOCTOR INVITATION
====================================================== */

const sendInviteEmail = async (
  doctorEmail,
  inviteToken
) => {

  try {

    const frontendUrl =
      process.env.FRONTEND_URL ||
      "http://localhost:3000";

    const setupUrl =
      `${frontendUrl}/doctor-setup/${inviteToken}`;

    const html = `
      <div style="
        font-family: Arial, sans-serif;
        max-width: 600px;
        margin: auto;
        padding: 30px;
        line-height: 1.6;
        color: #333;
      ">

        <h2 style="
          color: #2563eb;
          margin-bottom: 20px;
        ">
          Welcome to ClinicFlow
        </h2>

        <p>Hello Doctor,</p>

        <p>
          Your doctor account has been created by the
          ClinicFlow administrator.
        </p>

        <p>
          Please click the button below to create your
          password and complete your account setup.
        </p>

        <div style="margin: 30px 0;">

          <a
            href="${setupUrl}"
            style="
              display: inline-block;
              padding: 12px 24px;
              background-color: #2563eb;
              color: #ffffff;
              text-decoration: none;
              border-radius: 6px;
              font-weight: bold;
            "
          >
            Complete Account Setup
          </a>

        </div>

        <p>
          If the button doesn't work, copy and paste
          the following URL into your browser:
        </p>

        <p>
          <a
            href="${setupUrl}"
            style="color: #2563eb;"
          >
            ${setupUrl}
          </a>
        </p>

        <p>
          This invitation link is valid for
          <strong>24 hours</strong>.
        </p>

        <hr style="margin: 30px 0;" />

        <p style="
          color: #666;
          font-size: 13px;
        ">
          This is an automated email from ClinicFlow.
          Please do not reply to this email.
        </p>

        <p style="
          color: #666;
          font-size: 13px;
        ">
          © ClinicFlow
        </p>

      </div>
    `;

    /* -----------------------------------------------
       Create email
    ------------------------------------------------ */

    const raw = createRawEmail({
      to: doctorEmail,
      subject:
        "ClinicFlow - Complete Your Doctor Account Setup",
      html
    });

    /* -----------------------------------------------
       Send through Gmail API
    ------------------------------------------------ */

    const response =
      await gmail.users.messages.send({
        userId: "me",

        requestBody: {
          raw
        }
      });

    console.log(
      `📧 Doctor invitation sent successfully to ${doctorEmail}`
    );

    console.log(
      "📨 Gmail Message ID:",
      response.data.id
    );

    return response.data;

  } catch (error) {

    console.error(
      "❌ Gmail invitation failed:"
    );

    console.error(
      error.response?.data ||
      error.message
    );

    throw new Error(
      "Failed to send doctor invitation email"
    );
  }
};

module.exports = sendInviteEmail;