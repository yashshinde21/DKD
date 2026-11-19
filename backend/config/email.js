
export const sendOTPEmail = async (email, otp) => {
  const response = await fetch(
    'https://api.brevo.com/v3/smtp/email',
    {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': process.env.BREVO_API_KEY,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sender: {
          name: process.env.BREVO_SENDER_NAME,
          email: process.env.BREVO_SENDER_EMAIL,
        },
        to: [{ email }],
        subject: 'Your DKD Fruits Verification Code',
        htmlContent: `
          <div style="font-family:Arial;padding:25px">
            <h2 style="color:#245C32">DKD Fruits</h2>
            <h3>Email Verification</h3>
            <p>Your verification code is:</p>
            <h1 style="letter-spacing:8px;color:#245C32">
              ${otp}
            </h1>
            <p>This code expires in 5 minutes.</p>
            <p>Please do not share this code with anyone.</p>
            <p>Trusted since 1938.</p>
          </div>
        `,
      }),
    },
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Brevo email error: ${error}`);
  }

  return await response.json();
};
