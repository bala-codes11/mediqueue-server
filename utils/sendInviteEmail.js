const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);

const sendInviteEmail = async (doctorEmail, inviteToken) => {
  const frontendUrl =
    process.env.FRONTEND_URL || "http://localhost:3000";

  const setupUrl = `${frontendUrl}/doctor-setup/${inviteToken}`;

  const { data, error } = await resend.emails.send({
    from: "ClinicFlow <onboarding@resend.dev>",
    to: [doctorEmail],
    subject: "ClinicFlow - Complete Your Doctor Account Setup",

    html: `
      <div style="
        font-family: Arial, sans-serif;
        max-width: 600px;
        margin: auto;
        padding: 30px;
        line-height: 1.6;
      ">

        <h2 style="color: #2563eb;">
          Welcome to ClinicFlow
        </h2>

        <p>Hello Doctor,</p>

        <p>
          Your doctor account has been created by the
          ClinicFlow administrator.
        </p>

        <p>
          Please click the button below to create your password
          and complete your account setup.
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
          If the button doesn't work, copy and paste this URL
          into your browser:
        </p>

        <p>
          <a href="${setupUrl}">
            ${setupUrl}
          </a>
        </p>

        <p>
          This invitation link is valid for 24 hours.
        </p>

        <hr style="margin: 30px 0;" />

        <p style="color: #666; font-size: 13px;">
          This is an automated email from ClinicFlow.
          Please do not reply to this email.
        </p>

        <p style="color: #666; font-size: 13px;">
          © ClinicFlow
        </p>

      </div>
    `
  });

  if (error) {
    console.error("❌ Resend email failed:", error);
    throw new Error(error.message);
  }

  console.log("✅ Email sent successfully:", data?.id);

  return data;
};

module.exports = sendInviteEmail;