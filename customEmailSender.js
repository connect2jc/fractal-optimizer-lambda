const AWS = require('aws-sdk')
const b64 = require('base64-js')
const encryptionSdk = require('@aws-crypto/client-node');
const verifiedEmail = 'info@fractalmodel.com';

const { decrypt } = encryptionSdk.buildClient(encryptionSdk.CommitmentPolicy.REQUIRE_ENCRYPT_ALLOW_DECRYPT)
// const keyring = new encryptionSdk.KmsKeyringNode({
//     keyIds: [process.env.KMS_KEY_ARN]
// });
const keyring = "";

const genericTemplate = ({ part },{url, code, codeParameter, title, codeOnly, noInner,key="code" }) => {
  let inner;
  if (noInner) {
    inner = "";
  } else {
    if (codeOnly) {
      inner = `<span style="padding: 8px 12px; border: 1px solid #007bff;border-radius: 2px;font-family: Helvetica, Arial, sans-serif;font-size: 14px; color: #ffffff;text-decoration: none;font-weight:bold;display: inline-block;">
        ${codeParameter}
      </span>`
    } else {
      inner = `<a href="${url}?${key}=${code}__${codeParameter}" target="_blank" style="padding: 8px 12px; border: 1px solid #007bff;border-radius: 2px;font-family: Helvetica, Arial, sans-serif;font-size: 14px; color: #ffffff;text-decoration: none;font-weight:bold;display: inline-block;">
        ${title}
      </a>`
    }
  }

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
  <html xmlns="http://www.w3.org/1999/xhtml">
    <head>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <title>Fractal Optimizer</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  </head>
  <body style="font-family: Arial, sans-serif; font-size: 16px;">
    <table bgcolor="#f1f1f1" style="background:#f1f1f1; margin: 0 auto 0; width: 600px;">
      <tr><td height="30"></td></tr>
      <tr>
        <td></td>
        <td width="490" colspan="3" style="text-align: center"><img src='https://betamatta.fractaloptimizer.com/logo.png' style="height: 90px" height="80"/></td>
      </tr>
      <tr><td height="10"></td></tr><tr><td colspan="4"><table width="100%"><tr><td width="75"></td><td>
      ${part}
      </td><td width="50"></td></tr></table></td></tr>
      <tr><td height="30"><br></td></tr>
      <tr><td colspan="4" align="center">
        <table cellspacing="0" cellpadding="0"><tr><td style="border-radius: 2px; text-align:center;" bgcolor="#007bff">
          ${inner}
        </td></tr></table>
      </td></tr>
      <tr><td height="50"></td></tr>
    </table>
  </body>
  </html>`;
}



exports.handler = async (event,context) => {

  try {
    
  
  let html = '';
  let subject = '';
  let codeParameter = event.request.codeParameter;
  
  // if (event.request.code) {
  //   const decrypted = await decrypt(keyring, b64.toByteArray(event.request.code));
  //   codeParameter = decrypted.plaintext.toString('utf8');
  //   console.log(decrypted);
  // }
   console.log('Event',event.triggerSource,)
    if (["CustomEmailSender_SignUp","CustomEmailSender_ResendCode"].includes(event.triggerSource)) {
      const { userName, region } = event;
      const { clientId } = event.callerContext;
      const { email } = event.request.userAttributes;
      const url = `https://${process.env.Domain}/confirmSignup`;
      const code = Buffer.from( JSON.stringify({userName, clientId, region, email})).toString('base64');
      subject = "Fractal Optimizer signup confirmation";
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
      subject = "Fractal Optimizer: One-Time Password (OTP) Verification";
      html = genericTemplate({part: ` 
        <div style="font-weight:bold; font-size:24px; line-height:32px; color: #000;"> Please use the following One-Time Password (OTP) to complete your verification:
        </div><br>
      
      `},{url, code, codeParameter, title: 'Confirm', codeOnly:true});
    }

    if (event.triggerSource === "CustomEmailSender_ForgotPassword" || event.triggerSource === "CustomMessage_ForgotPassword") {
    console.log("CustomEmailSender_ForgotPassword")
      const { userName, region } = event;
      const { clientId } = event.callerContext;
      const { email,name } = event.request.userAttributes;
      
      const url = `https://${process.env.Domain}/reset-password`
      const code = Buffer.from( JSON.stringify({userName, clientId, region, email})).toString('base64');
      subject = "Fractal Optimzer reset password link";
      html = genericTemplate({part: `
        <div style="font-weight:bold; font-size:24px; line-height:32px; color: #000;">Password reset request has been sent from your account <strong>"${name}"</strong></div><br>
        <div style="padding-top: 20px; text-align center; color: #000;">Click on the following link to reset your password</div><br>
      `},{url, code, codeParameter, title: 'Reset Password',key:"key"});
    }

    if (event.triggerSource === 'CustomEmailSender_AdminCreateUser') {
      const username = event.request.userAttributes['custom:accountname'] || event.userName;
      const email = event.request.userAttributes.email;
      subject = "Fractal Optimizer Sign Up";
      html = genericTemplate({part: `
        <p>Dear ${username},</p>
        <p>
          Welcome to the Fractal Model! Please sign in <a href="https://${process.env.Domain}/" target="_blank">here</a> using the following credentials for your account:
        </p>
        <p>Email: ${email}</p>
        <p>User ID: ${event.userName}</p>
        <p>Temporary Password: ${codeParameter}</p>
      
        <p>If you have any questions, please don’t hesitate to reach us
        <a href="mailto:info@fractalmodel.com?subject=Fractal%20Model%20Support%20Ticket" target="_blank">here</a>
        </p>
      `},{ noInner: true });
    }

    if (html && subject) {
      // Set the custom message
      event.response.emailMessage = html;
      event.response.emailSubject = subject;
    } else{
      const resetLink = `http://${process.env.Domain}/reset-password?username=${encodeURIComponent(event.userName)}&key=${encodeURIComponent(event.request.codeParameter)}`;
      // Set the custom message
      event.response.smsMessage = `Use this link to reset your password: ${resetLink}`;
      event.response.emailMessage = `Hello ${event.userName},\n\nPlease use the link below to reset your password:\n\n${resetLink}\n\nIf you did not request this, please ignore this message.`;
      event.response.emailSubject = "Fractal Optimizer Reset Your Password";
    }

    context.done(null, event);
  } catch (error) {
    console.error("Error in lambda email handler:", error);
    context.done(error);
  }
}