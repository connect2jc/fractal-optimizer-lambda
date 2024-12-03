
'use strict';

const AWS = require('aws-sdk');
const { result, error, getUserData } = require('./utils.js');
const verifiedEmail = 'info@fractalmodel.com';

const UpdateAttribute = (username,cognitoidentityserviceprovider) => {
    return new Promise(async (resolve, reject) => {
  
      try {
        return await cognitoidentityserviceprovider.adminUpdateUserAttributes({
          UserAttributes: [{
            Name: 'email_verified',
            Value: 'false'
          }],
          UserPoolId: process.env.UserPoolId,
          Username: username
        }).promise().then(async (result) => {
          return await cognitoidentityserviceprovider.adminUserGlobalSignOut({
            UserPoolId: process.env.UserPoolId,
            Username: username
          }).promise();
        }).then((result) => {
          if(username === 'testtest2'){
            console.log(result,'Signed out'+username);
          }
          resolve(result);
        }).catch((error) => {
          console.log('An error occurred when updating user attributes'+username,error);
          reject(error);
        });
  
      } catch (err) {
        console.log('Update User Attributes failed: ' + err.message)
        reject(err);
      }
  
    })
  
  }
module.exports.updateUserAttribute = async (event, context) => {

    let statistics = {
      totalUsers:0,
      success:false,
      step : 0,
      users : [],
      error:false
    }

    const cognitoidentityserviceprovider = new AWS.CognitoIdentityServiceProvider();

    const AllUsers = await getListUsersPaginated({
      cognitoidentityserviceprovider,
      Filter: `status = \"${'Enabled'}\"`,
      UserPoolId: process.env.UserPoolId
    });
    statistics.step = 1;

    let usersPromise = [];
    if(AllUsers ) {

      statistics.step = 2;

      if(AllUsers.Users && AllUsers.Users.length > 0){
        statistics.step = 3;
        try {

          for (let i = 0; i < AllUsers.Users.length; i++){
            const item = AllUsers.Users[i];
            if(item.UserStatus === "CONFIRMED" ){
              usersPromise.push(await UpdateAttribute(item.Username,cognitoidentityserviceprovider));
            }
          }

          console.log('Confirmed users',usersPromise.length)
          statistics.totalUsers = usersPromise.length;
          if(usersPromise.length > 0) {

            Promise.allSettled(usersPromise).then((response) => {
              console.log('Successfully updated user list')
              statistics.step = 4;


            }).catch((err) => {
              console.log('Error updating user list',err);
              statistics.step = 5;
              statistics.error = err;
            });

            return result(statistics);

          } else {
            statistics.step = 6;
            return result(statistics);
          }

        } catch(e) {
          console.log('Error updating user list catch',e)
          statistics.step = -1;
          statistics.error = e;
          return result(statistics);
        }

      }


    } else {
      statistics.step = -2;
      return result(statistics);
    }

};

module.exports.getUsernameByEmail = async (event, context) => {
  const data = JSON.parse(event.body);
  const cognitoidentityserviceprovider = new AWS.CognitoIdentityServiceProvider();
  console.log('Recieved request from get username by email',data)

  return await getUsernameByEmail({data, cognitoidentityserviceprovider})
};

module.exports.checkLoginUniqueness = async (event, context) => {
  const data = JSON.parse(event.body);
  return await checkLoginUniqueness({data})
};

module.exports.emailVerifyChallenge = async (event, context) => {
    console.log("emailVerifyChallenge 1.1", JSON.stringify(event));
  
    if(event.request.userAttributes && event.request.userAttributes.email_verified === "false") {
      event.response.issueTokens = false;
      event.response.failAuthentication = false;
      event.response.challengeName = 'CUSTOM_CHALLENGE';
    } else {
      console.log('emailVerifyChallenge Else')
      event.response.issueTokens = true;
      event.response.failAuthentication = false;
  
    }
    context.done(null, event);
  };


module.exports.loginWithoutPasswordDefine = async (event, context) => {
    console.log("loginWithoutPasswordDefine", JSON.stringify(event));
      if (event.request.session.length === 1 &&
          event.request.session[0].challengeName === 'SRP_A') {
          event.response.issueTokens = false;
          event.response.failAuthentication = false;
          event.response.challengeName = 'CUSTOM_CHALLENGE';
      } else if (event.request.session.length === 2 &&
          event.request.session[1].challengeName === 'CUSTOM_CHALLENGE' &&
          event.request.session[1].challengeResult === true) {
          event.response.issueTokens = true;
          event.response.failAuthentication = false;
      } else {
          event.response.issueTokens = false;
          event.response.failAuthentication = true;
      }
      context.done(null, event);
  };
  
  module.exports.loginWithoutPasswordCreate = async (event, context) => {
      console.log("loginWithoutPasswordCreate", JSON.stringify(event));
    if (event.request.session.length === 1 && event.request.challengeName === 'CUSTOM_CHALLENGE') {
      event.response.publicChallengeParameters = {
        USER_ID_FOR_SRP: event.userName
      };
    }
    context.done(null, event);
  };
  
  module.exports.loginWithoutPasswordVerify = async (event, context) => {
    console.log("loginWithoutPasswordVerify", JSON.stringify(event));
    const cognito = new AWS.CognitoIdentityServiceProvider();
    console.log(event.request.challengeAnswer);
    const user = await cognito.getUser({
      AccessToken: event.request.challengeAnswer
    }).promise();
    console.log(user);
  
    const groups = await cognito.adminListGroupsForUser({
      Username: user.Username,
      UserPoolId: process.env.UserPoolId
    }).promise();
  
    const groupNames = groups.Groups.map(group => group.GroupName);
  
    event.response.answerCorrect = groupNames.includes('Administrator');
    context.done(null, event);
  };

  async function checkLoginUniqueness({data}){
    const cognitoidentityserviceprovider = new AWS.CognitoIdentityServiceProvider();
    const usersData = await getListUsersPaginated({
      cognitoidentityserviceprovider,
      Filter: `username = \"${data.username}\"`,
      UserPoolId: process.env.UserPoolId
    });
    console.log("usersData", usersData);
    return result({isUnique: usersData.Users && usersData.Users.length === 0, reqId: data.reqId});
  }
  

  async function getUsernameByEmail({
    data,
    cognitoidentityserviceprovider
  }){
    let users = await getListUsersPaginated({
      cognitoidentityserviceprovider,
      Filter: `email = "${data.email}"`,
      UserPoolId: process.env.UserPoolId
    });
    users = users.Users.map( (user, index) => {
      return user.Username
    })
  
    return result(users[0]);
  }
  
  async function getListUsersPaginated({cognitoidentityserviceprovider, UserPoolId, Filter}) {
    let pgToken = 0;
    let users = [];
    while (pgToken || pgToken === 0) {
      console.log(pgToken);
      const result = await cognitoidentityserviceprovider.listUsers({
        UserPoolId,
        ...(Filter ? {Filter} : {}),
        ...(pgToken ? {PaginationToken: pgToken} : {})
      }).promise();
  
      pgToken = result.PaginationToken;
      console.log(pgToken);
      users = users.concat(result.Users);
    }
    
     // Filter users based on UserState
     users = users.filter(user => {
      return user.UserStatus !== 'EXTERNAL_PROVIDER'; 
    });
    return { Users: users };
  }
  
  
  