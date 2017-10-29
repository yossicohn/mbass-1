'use strict';
var utils = require("./general-utils.js");
var dbModule = require("./dbmodule.js");

// ----------------------------------------------------------------
// function: updateTokensArrayWithDevicesTokens
// args:targetedAppsObj, devicesIds, registration_id_tokens, tokensUsersMap, currUserId
// return: the Tokens from the Customer Documents
// ----------------------------------------------------------------
exports.updateTokensArrayWithDevicesTokens = function (targetedAppsObj, devices, registration_id_tokens, tokensUsersMap, currUserId) {
    try {
        var devicesIds = Object.keys(devices);
        devicesIds.forEach((deviceId) => {
            var device = devices[deviceId];
            var appsKeys = Object.keys(device.apps); // get the apps
            appsKeys.forEach((appNameSpace) => {
                if (device.apps[appNameSpace] != undefined) { // the app exist in the Campaign List
                    var appObj = device.apps[appNameSpace];
                    if (appObj.opt_in == true) {
                        var token = appObj.token;
                        if (tokensUsersMap != undefined) { // personalized Campaign
                            tokensUsersMap[token] = currUserId;
                        }

                        registration_id_tokens.push(token);
                    }
                }
            })
        })
        if (tokensUsersMap != undefined) // Non-Personalized Campaign
        {
            var result = {
                registration_id_tokens: registration_id_tokens,
                tokensUsersMap: tokensUsersMap
            };

        } else { // Personalized Campaign
            var result = registration_id_tokens;
        }

        return result;
    } catch (error) {

        throw "Failed updateTokensArrayWithDevices- error = " + error;
    }

}



// ----------------------------------------------------------------
// function: getTokensFromCustomerDocForPersonalizedCampaign
// args:campaignDoc, customersDocs, usersPersonaizedPayload
// return: the Tokens from the Customer Documents
// We add all the relevant Tokensof a user to the array
// ----------------------------------------------------------------
var getTokensFromCustomerDocForPersonalizedCampaign = function (campaignDoc, customersDocs, usersPersonaizedPayload) {
    var targetedAndroidApps = undefined;
    var targetedIOSApps = undefined;
    var registration_id_tokens = [];
    if (campaignDoc.apps != undefined) {
        if (campaignDoc.apps.android != undefined) {
            targetedAndroidApps = campaignDoc.apps.android;
        }
        if (campaignDoc.apps.ios != undefined) {
            targetedIOSApps = campaignDoc.apps.ios;
        }
    }

    customersDocs.forEach((doc) => {
        var id = doc.public_customer_id;
        var userData = usersPersonaizedPayload[id];

        if (doc.opt_in == true) { // other wise we will not use tokens from this usersDocument
            if (targetedAndroidApps != undefined && doc.android_tokens != undefined) {
                if (userData.tokens == undefined) {
                    userData.tokens = [];
                }
                // we check that there are apps targeted and that ther are exist in the current doc
                var devices = doc.android_tokens; // get the devices
                var targetedAppsObj = targetedAndroidApps; // the Android Targeted Apps by the Campaign
                userData.tokens = updateTokensArrayWithDevicesTokens(targetedAppsObj, devices, userData.tokens);
            }

            if (targetedIOSApps != undefined && doc.ios_tokens != undefined) {
                if (userData.tokens == undefined) {
                    userData.tokens = [];
                }
                // we check that there are apps targeted and that ther are exist in the current doc
                var devices = doc.ios_tokens; // get the devices
                var targetedAppsObj = targetedAndroidApps; // the Android Targeted Apps by the Campaign
                userData.tokens = updateTokensArrayWithDevicesTokens(targetedAppsObj, devices, userData.tokens);
            }
        }

    })

    return usersPersonaizedPayload;
}





// ----------------------------------------------------------------
// function: getUsersTokensForPersonalizedCampaign
// args:db, campaignDoc, usersPersonaizedPayload
// return: respons registration_ids for the PN along with the appropriate personalized payload.
// We first check if subscription exist if not we failed and then we create it.
// Process:
// we need to go to the appropriate users Database (Visitors/Customers).
// And find by the ID's the different Users Document.
// Go uver the Document and in the Targeted apps (in the devices) get the appropriate tokens.
// ----------------------------------------------------------------
exports.getUsersTokensForPersonalizedCampaign = function (db, campaignDoc, usersPersonaizedPayload) {
    return new Promise(function (resolve, reject) {
        var usres_id = Object.keys(usersPersonaizedPayload);
        if (usres_id.length == 0) {
            console.log("getUsersTokensForPersonalizedCampaign: supplied usersPersonaizedPayload is empty");
            reject(false);
        } else {
            if (campaignDoc.audience == 1) { // Cutomers

                getCustomersPersonalizedCampaignTokens(db, campaignDoc, usersPersonaizedPayload)
                    .then((usersPersonaizedPayload) => {
                        resolve(usersPersonaizedPayload);
                    })
                    .catch((error) => {
                        reject(error);
                    })

            } else if (campaignDoc.audience == 2) { // Visitors

            }

        }

    });
}



// ----------------------------------------------------------------
// function: getCustomersPersonalizedCampaignTokens
// args:db, campaignDoc, usersPersonaizedPayload
// return: respons registration_ids for the Customers PN Campaign.
// We first check if subscription exist if not we failed and then we create it.
// Process:
// we need to go to the appropriate users Database (Visitors/Customers).
// And find by the ID's the different Users Document.
// Go over the Document and in the Targeted apps (in the devices) get the appropriate tokens.
// ----------------------------------------------------------------
var getCustomersPersonalizedCampaignTokens = function (db, campaignDoc, usersPersonaizedPayload) {
    return new Promise(function (resolve, reject) {
        var usersCollectionName = undefined;
        var registration_ids_tokens = undefined;
        var tenantCustomersTokens = dbModule.getBaseCustomersCollectionName();
        usersCollectionName = tenantCustomersTokens + campaignDoc.tenant_id;
        var prefixDocId = "tid-" + campaignDoc.tenant_id + "-pcid-";
        var users_ids = Object.keys(usersPersonaizedPayload);
        var documentsIds = utils.getDocumentsIdsByUsersIds(prefixDocId, users_ids, campaignDoc.audience);
        if (db != undefined) {
            try {
                var usersCollection = db.collection(usersCollectionName);
                dbModule.getUsersBatchDocument(documentsIds, usersCollection)
                    .then((result) => {
                        console.log(result.status);
                        if (result.status == 1 && result.data.length > 0) {
                            usersPersonaizedPayload = getTokensFromCustomerDocForPersonalizedCampaign(campaignDoc, result.data, usersPersonaizedPayload)
                            resolve(usersPersonaizedPayload);
                        }
                    })
                    .catch((error) => {
                        console.log("getCustomersCampaignTokens: error " + error);
                        reject(error);
                    })

            } catch (error) {
                console.log(error);
                reject(error);
            }

        } else {
            var error = "db is not defined";
            console.log(error);
            reject(error);
        }
    });
}


// ----------------------------------------------------------------
// function: getCustomersCampaignTokens
// args:db, campaignDoc, users_ids
// return: respons registration_ids for the Customers PN Campaign.
// We first check if subscription exist if not we failed and then we create it.
// Process:
// we need to go to the appropriate users Database (Visitors/Customers).
// And find by the ID's the different Users Document.
// Go over the Document and in the Targeted apps (in the devices) get the appropriate tokens.
// ----------------------------------------------------------------
var getCustomersCampaignTokens = function (db, campaignDoc, users_ids) {
    return new Promise(function (resolve, reject) {
        var usersCollectionName = undefined;
        var tokensResult = undefined;
        var tenantCustomersTokens = dbModule.getBaseCustomersCollectionName();
        usersCollectionName = tenantCustomersTokens + campaignDoc.tenant_id;
        var prefixDocId = "tid-" + campaignDoc.tenant_id + "-pcid-";
        var documentsIds = utils.getDocumentsIdsByUsersIds(prefixDocId, users_ids, campaignDoc.audience);
        if (db != undefined) {
            try {
                var usersCollection = db.collection(usersCollectionName);
                dbModule.getUsersBatchDocument(documentsIds, usersCollection)
                    .then((result) => {
                        console.log(result.status);
                        if (result.status == 1 && result.data.length > 0) {

                            tokensResult = getTokensFromCustomerDoc(campaignDoc, result.data);

                            resolve(tokensResult);
                        }
                    })
                    .catch((error) => {
                        console.log("getCustomersCampaignTokens: error " + error);
                        reject(error);
                    })

            } catch (error) {
                console.log(error);
                reject(error);
            }

        } else {
            var error = "db is not defined";
            console.log(error);
            reject(error);
        }
    });
}



// ----------------------------------------------------------------
// function: getUsersTokens
// args:db, campaignDoc, users_ids
// return: respons registration_ids for the PN.
// We first check if subscription exist if not we failed and then we create it.
// Process:
// we need to go to the appropriate users Database (Visitors/Customers).
// And find by the ID's the different Users Document.
// Go uver the Document and in the Targeted apps (in the devices) get the appropriate tokens.
// ----------------------------------------------------------------
exports.getNonPersonalizedUsersTokens = function (db, campaignDoc, users_ids) {
    return new Promise(function (resolve, reject) {
        if (users_ids.length == 0) {
            console.log("getUsersTokens: supplied users_ids is empty");
            reject(false);
        } else {
            if (campaignDoc.audience == 1) { // Cutomers

                getCustomersCampaignTokens(db, campaignDoc, users_ids)
                    .then((tokensResult) => {
                        resolve(tokensResult);
                    })
                    .catch((error) => {
                        reject(error);
                    })

            } else if (campaignDoc.audience == 2) { // Visitors

            }

        }
    });
}


// ----------------------------------------------------------------
// function: updateTokensArrayWithDevicesTokens
// args:targetedAppsObj, devicesIds, registration_id_tokens, tokensUsersMap, currUserId
// return: the Tokens from the Customer Documents
// ----------------------------------------------------------------
var updateTokensArrayWithDevicesTokens = function (targetedAppsObj, devices, registration_id_tokens, tokensUsersMap, currUserId) {
    try {
        var devicesIds = Object.keys(devices);
        devicesIds.forEach((deviceId) => {
            var device = devices[deviceId];
            var appsKeys = Object.keys(device.apps); // get the apps
            appsKeys.forEach((appNameSpace) => {
                if (device.apps[appNameSpace] != undefined) { // the app exist in the Campaign List
                    var appObj = device.apps[appNameSpace];
                    if (appObj.opt_in == true) {
                        var token = appObj.token;
                        if (tokensUsersMap != undefined) { // personalized Campaign
                            tokensUsersMap[token] = currUserId;
                        }

                        registration_id_tokens.push(token);
                    }
                }
            })
        })
        if (tokensUsersMap != undefined) // Non-Personalized Campaign
        {
            var result = {
                registration_id_tokens: registration_id_tokens,
                tokensUsersMap: tokensUsersMap
            };

        } else { // Personalized Campaign
            var result = registration_id_tokens;
        }
        return result;
    } catch (error) {
        throw "Failed updateTokensArrayWithDevices- error = " + error;
    }
}


// ----------------------------------------------------------------
// function: getTokensFromCustomerDoc
// args:campaignDoc, customersDocs
// return: the Tokens from the Customer Documents + the Mapping of Tokens to Users.
// Which should be used for the Invalidation of Tokens and other scenarios.
//  var result = {
//     registration_id_tokens: registration_id_tokens,
//     tokensUsersMap: tokensUsersMap
// };
// The tokensUsersMap is a mapping of token to userId
// ----------------------------------------------------------------
var getTokensFromCustomerDoc = function (campaignDoc, customersDocs) {

    var targetedAndroidApps = undefined;
    var targetedIOSApps = undefined;
    var registration_id_tokens = [];
    var tokensUsersMap = {};

    if (campaignDoc.apps != undefined) {
        if (campaignDoc.apps.android != undefined) {
            targetedAndroidApps = campaignDoc.apps.android;
        }
        if (campaignDoc.apps.ios != undefined) {
            targetedIOSApps = campaignDoc.apps.ios;
        }
    }

    customersDocs.forEach((doc) => {

        if (doc.opt_in == true) { // other wise we will not use tokens from this usersDocument
            var currUserId = undefined;
            if (doc.public_customer_id != undefined) {
                currUserId = doc.public_customer_id;
            } else {
                currUserId = doc.visitor_id;
            }

            if (targetedAndroidApps != undefined && doc.android_tokens != undefined) {
                // we check that there are apps targeted and that ther are exist in the current doc
                var devices = doc.android_tokens; // get the devices
                var targetedAppsObj = targetedAndroidApps; // the Android Targeted Apps by the Campaign
                var result = updateTokensArrayWithDevicesTokens(targetedAppsObj, devices, registration_id_tokens, tokensUsersMap, currUserId);
                registration_id_tokens = result.registration_id_tokens;
                tokensUsersMap = result.tokensUsersMap;
            }

            if (targetedIOSApps != undefined && doc.ios_tokens != undefined) {
                // we check that there are apps targeted and that ther are exist in the current doc
                var devices = doc.ios_tokens; // get the devices
                var targetedAppsObj = targetedAndroidApps; // the Android Targeted Apps by the Campaign
                var result = updateTokensArrayWithDevicesTokens(targetedAppsObj, devices, registration_id_tokens, tokensUsersMap, currUserId);
                registration_id_tokens = result.registration_id_tokens;
                tokensUsersMap = result.tokensUsersMap;
            }
        }

    })
    var result = {
        registration_id_tokens: registration_id_tokens,
        tokensUsersMap: tokensUsersMap
    };
    return result;
}