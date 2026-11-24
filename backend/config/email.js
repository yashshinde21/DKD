
export const sendOTPEmail = async (email, otp) => {
  const response = await fetch(
    'https://api.brevo.com/v3/smtp/email',
    {
      method: 'POST',
      headers: {
        accept: 'application/json',
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
          <!DOCTYPE html>
          <html>
          <body style="
            margin:0;
            padding:20px;
            background-color:#f5f7f5;
            font-family:Arial,sans-serif;
          ">

            <div style="
              max-width:480px;
              margin:20px auto;
              background:#ffffff;
              border-radius:14px;
              padding:30px 22px;
              text-align:center;
            ">

              <h1 style="
                color:#245C32;
                font-size:27px;
                margin-bottom:5px;
              ">
                DKD FRUITS
              </h1>

              <p style="color:#888;font-size:12px;">
                TRUSTED SINCE 1938
              </p>

              <div style="
                height:1px;
                background:#eeeeee;
                margin:22px 0;
              "></div>

              <h2 style="color:#222;">
                Verify Your Email
              </h2>

              <p style="
                color:#666;
                font-size:15px;
                line-height:24px;
              ">
                Use the verification code below to continue
                with your DKD Fruits account.
              </p>

              <div style="
                background:#f0f6f0;
                border:1px dashed #245C32;
                border-radius:12px;
                padding:22px 10px;
                margin:25px 0;
              ">

                <p style="
                  color:#245C32;
                  font-size:12px;
                  font-weight:bold;
                  letter-spacing:2px;
                  margin-top:0;
                ">
                  YOUR OTP CODE
                </p>

                <div style="
                  color:#245C32;
                  font-size:34px;
                  font-weight:bold;
                  letter-spacing:9px;
                  padding-left:9px;
                  user-select:all;
                  -webkit-user-select:all;
                ">
                  ${otp}
                </div>

                <p style="
                  color:#777;
                  font-size:12px;
                  margin-bottom:0;
                ">
                  Press and hold the code to copy it
                </p>

              </div>

              <p style="
                color:#555;
                font-size:14px;
              ">
                This verification code expires in
                <strong>5 minutes</strong>.
              </p>

              <p style="
                color:#999;
                font-size:12px;
                line-height:20px;
                margin-top:25px;
              ">
                Please do not share this code with anyone.
                If you did not request this code, ignore this email.
              </p>

              <div style="
                height:1px;
                background:#eeeeee;
                margin:22px 0;
              "></div>

              <p style="
                color:#245C32;
                font-weight:bold;
                font-size:13px;
              ">
                DKD FRUITS
              </p>

            </div>

          </body>
          </html>
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
