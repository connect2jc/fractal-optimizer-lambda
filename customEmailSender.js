const AWS = require('aws-sdk')
const b64 = require('base64-js')
const encryptionSdk = require('@aws-crypto/client-node');
const verifiedEmail = 'info@fractalmodel.com';

const { decrypt } = encryptionSdk.buildClient(encryptionSdk.CommitmentPolicy.REQUIRE_ENCRYPT_ALLOW_DECRYPT)
const keyring = new encryptionSdk.KmsKeyringNode({
    keyIds: [process.env.KMS_KEY_ARN]
});

const genericTemplate = ({ part },{url, code, codeParameter, title, codeOnly, noInner,key="code" }) => {
  let inner;
  if (noInner) {
    inner = "";
  } else {
    if (codeOnly) {
      inner = `<span style="padding: 8px 12px; border: 1px solid #f99f24;border-radius: 2px;font-family: Helvetica, Arial, sans-serif;font-size: 14px; color: #ffffff;text-decoration: none;font-weight:bold;display: inline-block;">
        ${codeParameter}
      </span>`
    } else {
      inner = `<a href="${url}?${key}=${code}__${codeParameter}" target="_blank" style="padding: 8px 12px; border: 1px solid #f99f24;border-radius: 2px;font-family: Helvetica, Arial, sans-serif;font-size: 14px; color: #ffffff;text-decoration: none;font-weight:bold;display: inline-block;">
        ${title}
      </a>`
    }
  }

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
  <html xmlns="http://www.w3.org/1999/xhtml">
    <head>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <title>Fractal Model</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  </head>
  <body style="font-family: Arial, sans-serif; font-size: 16px;">
    <table bgcolor="#f1f1f1" style="background:#f1f1f1; margin: 0 auto 0; width: 600px;">
      <tr><td height="30"></td></tr>
      <tr>
        <td></td>
        <td width="490" colspan="3" style="text-align: center"><img src='https://app.fractalmodel.com/logo1.png' style="height: 90px" height="80"/></td>
      </tr>
      <tr><td height="10"></td></tr><tr><td colspan="4"><table width="100%"><tr><td width="75"></td><td>
      ${part}
      </td><td width="50"></td></tr></table></td></tr>
      <tr><td height="30"><br></td></tr>
      <tr><td colspan="4" align="center">
        <table cellspacing="0" cellpadding="0"><tr><td style="border-radius: 2px; text-align:center;" bgcolor="#f99f24">
          ${inner}
        </td></tr></table>
      </td></tr>
      <tr><td height="50"></td></tr>
    </table>
  </body>
  </html>`;
}



exports.handler = async (event) => {
  let html = '';
  let subject = '';
  let codeParameter = '';
  if (event.request.code) {
    const decrypted = await decrypt(keyring, b64.toByteArray(event.request.code));
    codeParameter = decrypted.plaintext.toString('utf8');
    console.log(decrypted);
  }
  if (["CustomEmailSender_SignUp","CustomEmailSender_ResendCode"].includes(event.triggerSource)) {
    const { userName, region } = event;
    const { clientId } = event.callerContext;
    const { email } = event.request.userAttributes;
    const url = `https://${process.env.Domain}/confirmSignup`;
    const code = Buffer.from( JSON.stringify({userName, clientId, region, email})).toString('base64');
    subject = "Fractal Model signup confirmation";
    html = genericTemplate({part: `
      <div style="font-weight:bold; font-size:24px; line-height:32px; color: #000;">Please click on the following link to confirm your account</div><br>
    `},{url, code, codeParameter, title: 'Confirm'});
 
  }

  if (event.triggerSource === "CustomEmailSender_VerifyUserAttribute") {
    console.log('TRIGGERED 1 Email Attribute', JSON.stringify(event, null, 2));
    const { userName, region } = event
    const { clientId } = event.callerContext
    const { email } = event.request.userAttributes
    const url = `https://${process.env.Domain}/confirm-otp`

    const code = Buffer.from( JSON.stringify({userName, clientId, region, email})).toString('base64');
    subject = "Fractal Model: One-Time Password (OTP) Verification";
    html = genericTemplate({part: ` 
      <div style="font-weight:bold; font-size:24px; line-height:32px; color: #000;"> Please use the following One-Time Password (OTP) to complete your verification:
      </div><br>
    
    `},{url, code, codeParameter, title: 'Confirm', codeOnly:true});
  }

  if (event.triggerSource === "CustomEmailSender_ForgotPassword") {
    const { userName, region } = event;
    const { clientId } = event.callerContext;
    const { email } = event.request.userAttributes;
    const url = `https://${process.env.Domain}/passwordReset`
    const code = Buffer.from( JSON.stringify({userName, clientId, region, email})).toString('base64');
    subject = "Fractal Model reset password link";
    html = genericTemplate({part: `
      <div style="font-weight:bold; font-size:24px; line-height:32px; color: #000;">Password reset request has been sent from your account <strong>"${userName}"</strong></div><br>
      <div style="padding-top: 20px; text-align center; color: #000;">Click on the following link to reset your password</div><br>
    `},{url, code, codeParameter, title: 'Reset Password',key:"key"});
  }

  if (event.triggerSource === 'CustomEmailSender_AdminCreateUser') {
    const username = event.request.userAttributes['custom:accountname'] || event.userName;
    const email = event.request.userAttributes.email;
    subject = "Fractal Model Sign Up";
    html = genericTemplate({part: `
      <p>Dear ${username},</p>
      <p>
        Welcome to the Fractal Model! Please sign in <a href="https://${process.env.Domain}/" target="_blank">here</a> using the following credentials for your account:
      </p>
      <p>Email: ${email}</p>
      <p>User ID: ${event.userName}</p>
      <p>Temporary Password: ${codeParameter}</p>
      <p>
        After you reset your password, please install the Fractal Model Add-in in your Excel, and
        use your new credentials to sign in. For instructions to install the Fractal Model Add-in, please click
        <a href="https://www.fractalmodel.com/docs/Fractal%20Model%20Add-in%20Installation.pdf" target="_blank">here</a>
      </p>
      <p>If you have any questions, please don’t hesitate to reach us
      <a href="mailto:info@fractalmodel.com?subject=Fractal%20Model%20Support%20Ticket" target="_blank">here</a>
      </p>
    `},{ noInner: true });
  }

  if (html && subject) {
    const ses = new AWS.SES();
    const result = await ses.sendEmail({
        Destination: {
            BccAddresses: ['rahul@fractalba.com', 'judy@fractalba.com', 'aradchenko@devforth.io'],
            ToAddresses: [event.request.userAttributes.email],
        },
        Message: {
            Body: {
                Html: {
                    Data: html,
                    Charset: 'UTF8',
                },
            },
            Subject: {
                Data: subject,
                Charset: 'UTF8'
            }
        },
        Source: verifiedEmail,
    }).promise();
  }
}