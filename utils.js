const AWS = require('aws-sdk');
const short = require('short-uuid');


// Disable chargeover on dev environment
const CHARGE_OVER_ENABLED = false;

const shortTranslator = short();  // flickrBase58 alphabet
const cognitoidentityserviceprovider = new AWS.CognitoIdentityServiceProvider();




function result(result, otherBody, status = 200) {
    return {
      statusCode: status,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      body: JSON.stringify({
        ...otherBody,
        result,
      }),
    };
}

function error(status, errorText, errorBody){
    return result(false, {errorText:errorText, errorBody:errorBody}, status)
}

async function asyncForEach(array, callback) {
    for (let index = 0; index < array.length; index++) {
      await callback(array[index], index, array);
    }
  }

async function getUserData(identityOrUsername) {
    let usersData;

    if (typeof identityOrUsername !== 'string') {
        const userSub = identityOrUsername.cognitoAuthenticationProvider.match(/CognitoSignIn:(.+)/)[1];
        usersData = await cognitoidentityserviceprovider.listUsers({Filter: `sub = \"${userSub}\"`, UserPoolId: process.env.UserPoolId, Limit: 1}).promise()
    } else {
        usersData = await cognitoidentityserviceprovider.listUsers({Filter: `username = \"${identityOrUsername}\"`, UserPoolId: process.env.UserPoolId}).promise()
    }
    if(!usersData.Users || !usersData.Users.length){ return false; }

    const userData      = usersData.Users[0];
    const userGroups    = await cognitoidentityserviceprovider.adminListGroupsForUser({ UserPoolId: process.env.UserPoolId, Username: userData.Username, Limit: 1}).promise()
    const userRole      = userGroups.Groups.length > 0 ? userGroups.Groups[0].GroupName : '';

    const sub                 = userData.Attributes.find(attr => attr.Name === "sub")
    const email                 = userData.Attributes.find(attr => attr.Name === "email")


    return {
        sub:        (sub && sub.Value) || "",
        role:        userRole,
        group:       userRole,
        email:       (email && email.Value) || "",
        status:      userData.UserStatus,
        name:      userData.name,

        enabled:     userData.Enabled,
        username:    userData.Username,
    }
}





function fixPath(path) {
    return path.replace(/\/{2,}/g, '/');
}




function replaceOnStart(text, replace, replacement) {
    return text.startsWith(replace) ?  replacement + text.slice(replace.length) : text;
}

module.exports = {
    CHARGE_OVER_ENABLED,

    result,
    error,
    getUserData,
    asyncForEach,
    fixPath,
    replaceOnStart,
};