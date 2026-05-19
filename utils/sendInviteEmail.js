const nodemailer = require("nodemailer");

/* ======================================================
   EMAIL TRANSPORTER
====================================================== */

const transporter = nodemailer.createTransport({
  service: "gmail",

  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

/* ======================================================
   VERIFY CONNECTION
====================================================== */

transporter.verify((error) => {

  if (error) {

    console.error(
      "Email transporter error:",
      error
    );

  } else {

    console.log(
      "✅ Email server connected"
    );

  }

});


/* ======================================================
   SEND INVITE EMAIL
====================================================== */

const sendInviteEmail = async (
  email,
  inviteToken
) => {

  try {

    /* ================= VALIDATION ================= */

    if (!email || !inviteToken) {
      throw new Error(
        "Email and invite token required"
      );
    }

    /* ================= FRONTEND URL ================= */

    if (!process.env.FRONTEND_URL) {
      throw new Error(
        "FRONTEND_URL missing in environment variables"
      );
    }

    /* ================= INVITE LINK ================= */

    const inviteLink =
      `${process.env.FRONTEND_URL}/doctor-setup/${inviteToken}`;

    /* ================= EMAIL TEMPLATE ================= */

    const mailOptions = {

      from: `"ClinicFlow" <${process.env.EMAIL_USER}>`,

      to: email,

      subject:
        "Doctor Account Setup - ClinicFlow",

      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">

          <h2 style="color:#2563eb;">
            Welcome to ClinicFlow
          </h2>

          <p>
            Your doctor account has been created successfully.
          </p>

          <p>
            Click the button below to setup your password:
          </p>

          <a
            href="${inviteLink}"
            style="
              display:inline-block;
              padding:12px 20px;
              background:#2563eb;
              color:white;
              text-decoration:none;
              border-radius:6px;
              margin-top:10px;
            "
          >
            Setup Password
          </a>

          <p style="margin-top:20px;">
            Or copy this link:
          </p>

          <p>
            ${inviteLink}
          </p>

          <p style="margin-top:20px; color:gray;">
            This link will expire in 24 hours.
          </p>

        </div>
      `

    };

    /* ================= SEND EMAIL ================= */

    const info =
      await transporter.sendMail(
        mailOptions
      );

    console.log(
      "✅ Invite email sent:",
      info.messageId
    );

    return {
      success: true,
      messageId: info.messageId
    };

  } catch (error) {

    console.error(
      "❌ Invite email error:",
      error.message
    );

    throw error;

  }

};

module.exports = sendInviteEmail;