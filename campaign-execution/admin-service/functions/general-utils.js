'use strict';
var pubsubUtil = require("./pubsub.js");
var admin = require("firebase-admin");
var adminClients = {};
var serviceAccountSDKoController = require("../mobilesdk-master-dev-firebase-adminsdk-etwd8-bb7913dce1.json");
var serviceAccountAppController = require("../appcontrollerproject-developer-firebase-adminsdk-xv10y-853771a0b1.json");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccountSDKoController),
    databaseURL: "https://mobilesdk-master-dev.firebaseio.com",

});

var rtDB = admin.database();

//-----------------------------------------------------------------------------
// functions: sendPromissedPN
// args: tokensData = {registrationTokens, mapping}, payload
// Return: response/error
//-----------------------------------------------------------------------------
exports.sendPromissedPN = function (tokensData, payload, clientAdmin, options) {
    return new Promise(function (resolve, reject) {

        var registrationTokens = tokensData.registration_id_tokens;
        clientAdmin.messaging().sendToDevice(registrationTokens, payload, options)
            .then(function (fcmResults) {
                // See the MessagingDevicesResponse reference documentation for
                // the contents of response.
                console.log("sendPromissedPN: Successfully sent message:", fcmResults);
                var result = {
                    fcmResults: fcmResults,
                    tokensData: tokensData
                };
                resolve(result);
            })
            .catch(function (errorResponse) {
                console.log("sendPromissedPN: Error sending message:", errorResponse);
                reject(errorResponse);
            });

    });
}


// ----------------------------------------------------------------
// function: sendPromissedPersonalizedMessages
// arguments: usersPersonaizedPayload, clientAdmin, options
// return: respons Array.
// ----------------------------------------------------------------
exports.sendPromissedPersonalizedMessages = function (usersPersonaizedPayload, clientAdmin, options) {
    return new Promise(function (resolve, reject) {
        var failedCounter = 0;
        var fcmBulkResults = [];
        var promises = [];
        var userss_ids = Object.keys(usersPersonaizedPayload);
        userss_ids.forEach((userId) => {
            var userData = usersPersonaizedPayload[userId];
            if (userData.tokens != undefined) {
                userData.userId = userId;
                var currPromise = sendSinglePersonalizedMessagePromise(clientAdmin, userData, options);
                promises.push(currPromise);
            }
        });
        Promise.all(promises)
            .then((fcmBulkResults) => {
                console.log(fcmBulkResults);
                resolve(fcmBulkResults);
            })
            .catch((error) => {
                console.log(error);
            })
    });
}

// ----------------------------------------------------------------
// function: sendSinglePersonalizedMessagePromise
// args: clientAdmin,userData, options
// return: fcmResult.
// this promissed is used in the Promis.all array
// ----------------------------------------------------------------
var sendSinglePersonalizedMessagePromise = function (clientAdmin, userData, options) {
    return new Promise(function (resolve, reject) {
        var currPromise = clientAdmin.messaging().sendToDevice(userData.tokens, userData.payload, options)
            .then(function (fcmResults) {
                // See the MessagingDevicesResponse reference documentation for
                // the contents of response.
                console.log("sendSinglePersonalizedMessagePromise: Successfully sent message:", JSON.stringify(fcmResults));
                var result = {
                    fcmResults: fcmResults,
                    userId: userData.userId,
                    userTokens: userData.tokens
                };
                resolve(result);
            })
            .catch(function (error) {
                console.log("sendSinglePersonalizedMessagePromise: Error sending message:", error);
                reject(error);
            });
    });
}



// ----------------------------------------------------------------
// function: getDocId
// args: request
// return: response object. 
// ----------------------------------------------------------------
//    "_id" : "tid-<int>_cid-<int>_acsl-<int>_tplid-<int>-eng-<int>",
// example : 
// "_id": "tid-85_cid-1004_acsl-13_tplid-123-eng-1234"
// ---------------------------------------------------------------- 
exports.getDocId = function (createReq) {
    var docId = "tid-" + createReq.tenant_id +
        "-cid-" + createReq.campaign_id +
        "-acsl-" + createReq.action_serial +
        "-tplid-" + createReq.template_id +
        "-eng-" + createReq.engagement_id;
    return docId;
}




// ----------------------------------------------------------------
// function: getFirebaseClientAdmin
// args: campaignDoc
// return: clientAdmin. 
// ----------------------------------------------------------------
var getFirebaseClientAdmin = function (campaignDoc) {
    return new Promise(function (resolve, reject) {

        try {
            var rtRefName = "tenants-data/tenant-" + campaignDoc.tenant_id;
            var clientName = "tenant-" + campaignDoc.tenant_id;
            var clientAdmin = undefined;
            clientAdmin = adminClients[clientName];
            if (clientAdmin != undefined) {
                resolve(clientAdmin);
            } else {
                var ref = rtDB.ref(rtRefName);
                // Attach an asynchronous callback to read the data at our posts reference
                ref.on("value", function (snapshot) {
                    var cred = snapshot.val();
                    clientAdmin = admin.initializeApp({
                        credential: admin.credential.cert(cred),

                    }, rtRefName);
                    if (clientAdmin != undefined) {
                        adminClients[clientName] = clientAdmin;
                        resolve(clientAdmin);
                    } else {
                        reject("getFirebaseClientAdmin: cannot create client admin for " + rtRefName);
                    }


                }, function (errorObject) {
                    console.log("getFirebaseClientAdmin: The from RealTime DB failed: rtRefName= " + rtRefName + "error obj:  " + errorObject.code);
                    reject(errorObject);
                });
            }
        } catch (error) {
            console.log("getFirebaseClientAdmin: The from RealTime DB failed: rtRefName= " + rtRefName + "error obj:  " + error);
            reject(error);
        }

    });

}


//-----------------------------------------------------------------------------
// functions: prepareExecutionResources
// args: createReq, db, campaignDoc
// description: perpare Process Resources.
// //---------------------------------------------------------------------------
exports.prepareExecutionResources = function (createReq, db, campaignDoc) {
    return new Promise(function (resolve, reject) {
        //Campaign was found, now we can get build the Payload.
        console.log('prepareExecutionResources : Started');
        getFirebaseClientAdmin(campaignDoc)
            .then((clientAdmin) => {
                var options = {
                    priority: "high",
                    contentAvailable: true,
                    timeToLive: campaignDoc.time_to_live,
                    dryRun: createReq.dryRun,
                    collapseKey: campaignDoc._id
                };
                var topicName = campaignDoc.data_queue_name;;
                var subscriptionName = "sub_" + topicName;
                pubsubUtil.createCampaignSubscriber(topicName, subscriptionName)
                    .then((subscription) => { // new we can get the data of the Users and extract it.

                        var resourcers = {
                            clientAdmin: clientAdmin,
                            subscription: subscription,
                            db: db
                        };
                        resolve(resourcers);
                    })
                    .catch((error) => {
                        reject(error);
                    });
            });
    });
}




// ----------------------------------------------------------------
// function: buildNonPerolalizedCampaignPayload
// args: exisitingCampaignDoc
// return: response dataPayload.
// ----------------------------------------------------------------
exports.buildNonPerolalizedCampaignPayload = function (campaignDoc) {
    var campaignPayload = undefined;
    try {

        campaignPayload = initNonPersonalizedrDataPayload(campaignDoc);
    } catch (error) {
        console.log("buildNonPerolalizedCampaignPayload Failed" + error);
    }


    return campaignPayload;
}


// ----------------------------------------------------------------
// function: buildPersonalizedCampaignPayload
// args: exisitingCampaignDoc
// return: response dataPayload.
// ----------------------------------------------------------------
exports.buildPersonalizedCampaignPayload = function (campaignDoc) {
    var campaignPayload = undefined;
    try {

        campaignPayload = initPersonalizedrDataPayload(campaignDoc);
    } catch (error) {
        console.log("initPersonalizedrDataPayload Failed" + error);
    }


    return campaignPayload;
}

// ----------------------------------------------------------------
// function: initPersonalizedrDataPayload
// args: exisitingCampaignDoc
// return: response dataPayload.
// ----------------------------------------------------------------
// ----------------------------------------------------------------
//
//         "data": {
//             "title": "Notification Title", // personalized
//             "content": "Notification Body",// personalized
//             "dynamic_links": {
//                 "android": {
//                     "apns1": "dynamic.link.url",
//                     "apns2": "dynamic.link.url",
//                     "apns3": "dynamic.link.url"
//                 },
//                 "ios": {
//                     "apns1": "dynamic.link.url",
//                     "apns2": "dynamic.link.url",
//                     "apns3": "dynamic.link.url"
//                 }
//             },
//             "campaign_id": undefined,
//             "action_serial": undefined,
//             "template_id": undefined,
//             "engagement_id": undefined,
//             "is_optipush": true,
//              "campaign_type" : 1/2 // Customer/Visitor
//         },
//         "priority": "high",
//         "content_available": true,
//         "registration_ids": [/*...*/]
// ------------------------------------------------------------------
var initPersonalizedrDataPayload = function (exisitingCampaignDoc) {

    var dataPayload = {};
    dataPayload.data = {};
    dataPayload.data.campaign_id = exisitingCampaignDoc.campaign_id.toString();
    dataPayload.data.action_serial = exisitingCampaignDoc.action_serial.toString();
    dataPayload.data.template_id = exisitingCampaignDoc.template_id.toString();
    dataPayload.data.engagement_id = exisitingCampaignDoc.engagement_id.toString();
    dataPayload.data.is_optipush = "true";

    // Template Content
    dataPayload.data.title = exisitingCampaignDoc.template_data.title.toString();
    dataPayload.data.content = exisitingCampaignDoc.template_data.content.toString();
    dataPayload.data.dynamic_links = exisitingCampaignDoc.dynamic_links.toString();

    if (exisitingCampaignDoc.audience == 1) { // 1 = Customers, 2 = Visitors

        dataPayload.data.campaign_type = "1"; // Customers
    } else {
        dataPayload.data.campaign_type = "2"; // Visitors

    }
    return dataPayload;
}


// ----------------------------------------------------------------
// function: initNonPersonalizedrDataPayload
// args: exisitingCampaignDoc
// return: response dataPayload.
// ----------------------------------------------------------------
// ----------------------------------------------------------------
//
//         "data": {
//             "title": "Notification Title",
//             "content": "Notification Body",
//             "dynamic_links": {
//                 "android": {
//                     "apns1": "dynamic.link.url",
//                     "apns2": "dynamic.link.url",
//                     "apns3": "dynamic.link.url"
//                 },
//                 "ios": {
//                     "apns1": "dynamic.link.url",
//                     "apns2": "dynamic.link.url",
//                     "apns3": "dynamic.link.url"
//                 }
//             },
//             "campaign_id": undefined,
//             "action_serial": undefined,
//             "template_id": undefined,
//             "engagement_id": undefined,
//             "is_optipush": true,
//              "campaign_type" : 1/2 // Customer/Visitor
//         },
//         "priority": "high",
//         "content_available": true,
//         "registration_ids": [/*...*/]
// ------------------------------------------------------------------
var initNonPersonalizedrDataPayload = function (exisitingCampaignDoc) {

    var dataPayload = {};
    dataPayload.data = {};
    dataPayload.data.campaign_id = exisitingCampaignDoc.campaign_id.toString();
    dataPayload.data.action_serial = exisitingCampaignDoc.action_serial.toString();
    dataPayload.data.template_id = exisitingCampaignDoc.template_id.toString();
    dataPayload.data.engagement_id = exisitingCampaignDoc.engagement_id.toString();
    dataPayload.data.is_optipush = "true";

    // Template Content
    dataPayload.data.title = exisitingCampaignDoc.template_data.title.toString();
    dataPayload.data.content = exisitingCampaignDoc.template_data.content.toString();
    dataPayload.data.dynamic_links = JSON.stringify(exisitingCampaignDoc.dynamic_links);

    if (exisitingCampaignDoc.audience == 1) { // 1 = Customers, 2 = Visitors

        dataPayload.data.campaign_type = "1"; // Customers
    } else {
        dataPayload.data.campaign_type = "2"; // Visitors

    }
    return dataPayload;
}



// ----------------------------------------------------------------
// function: createPersonalizedPayload
// args: campaignPayload, targetedUser
// return: response object.
// ----------------------------------------------------------------
exports.createPersonalizedPayload = function (campaignPayload, targetedUser) {

    var userId = targetedUser.Id;

    if (targetedUser.PersonalizeValues != undefined) {

        var personalizedKeys = Object.keys(targetedUser.PersonalizeValues);
        personalizedKeys.forEach(function (personalKey) {
            var value = targetedUser.PersonalizeValues[personalKey];
            var regpersonalKey = personalKey.replace("[%", "(\\[%"); //add left brackets (\[%
            regpersonalKey = regpersonalKey.replace("%]", "%\\])"); //add right brackets %\])
            var reg = new RegExp(regpersonalKey, "g"); //  /(\[%FIRST_NAME%\])+/g;

            campaignPayload.data.title = campaignPayload.data.title.replace(reg, value);
            campaignPayload.data.content = campaignPayload.data.content.replace(reg, value)
        });

        console.log("personalizedTitla =" + campaignPayload.data.title);
        console.log("personalizedContent =" + campaignPayload.data.content);
    }

    var data = {
        tokens: undefined,
        payload: campaignPayload
    };

    return data;
}



//-----------------------------------------------------------------------------
// functions: getNonPersonalizedCampaignProcessStats
// args: personalizedCampaignResults 
// description: updateMetrics
// personalizedCampaignResults = {
//     fcmSendResults: fcmResults,
//     tokensData: tokensResult,
//     numOfTargetedDevices: registration_ids.length,
//     numOfTargetedUsers: users_ids.length
// };
//---------------------------------------------------------------------------
exports.getNonPersonalizedCampaignProcessStats = function (personalizedCampaignResults) {
    var updateMetrics = {
        failureCount: 0,
        successCount: 0,
        bulkSize: 0,
        numOfDevices: 0,
        numOfTargetedUsers: 0
    }
    var resultsCount = personalizedCampaignResults.length;

    personalizedCampaignResults.forEach((sendMetaData) => {
        if (sendMetaData != undefined) {
            var tokens = sendMetaData.fcmSendResults.tokensData.registration_id_tokens;
            var fcmResult = sendMetaData.fcmSendResults.fcmResults;
            updateMetrics.failureCount += fcmResult.failureCount;
            updateMetrics.successCount += fcmResult.successCount
            updateMetrics.bulkSize += fcmResult.failureCount + fcmResult.successCounttoken; //tokens.length;
            updateMetrics.numOfDevices += sendMetaData.numOfTargetedDevices;
            updateMetrics.numOfTargetedUsers += sendMetaData.numOfTargetedUsers;
        }

    });

    return updateMetrics;
}



//-----------------------------------------------------------------------------
// functions: getPersonalizedCampaignProcessStats
// args: personalizedCampaignResults
// description: updateMetrics
// var resultedExecution = {
//     fcmSendResults: fcmResults,
//     numOfTargetedDevices: numOfDevices,
//     numOfTargetedUsers: users_ids.length
// };
//---------------------------------------------------------------------------
exports.getPersonalizedCampaignProcessStats = function (personalizedCampaignResults) {
    var updateMetrics = {
        failureCount: 0,
        successCount: 0,
        bulkSize: 0,
        numOfDevices: 0,
        numOfTargetedUsers: 0
    }
    var resultsCount = personalizedCampaignResults.length;

    personalizedCampaignResults.forEach((sendMetaData) => {

        var fcmResult = sendMetaData.fcmSendResults;
        if (fcmResult != undefined) {
            fcmResult.forEach((result) => {
                var currFCMResult = result.fcmResults;
                updateMetrics.failureCount += currFCMResult.failureCount;
                updateMetrics.successCount += currFCMResult.successCount
                updateMetrics.bulkSize += currFCMResult.failureCount + currFCMResult.successCount;
            });

        } else {
            console.error("getPersonalizedCampaignProcessStats: fcmResult is not defined")
        }

        updateMetrics.numOfDevices += sendMetaData.numOfTargetedDevices;
        updateMetrics.numOfTargetedUsers += sendMetaData.numOfTargetedUsers;
    });

    return updateMetrics;
}



// ----------------------------------------------------------------
// function: getDocumentsIdsByUsersIds
// args:prefixDocId, users_ids, userType
// return: the Documents Id's by the UsersIds and Type (Visitor/Customers)
// ----------------------------------------------------------------
exports.getDocumentsIdsByUsersIds = function (prefixDocId, users_ids, userType) {

    var docsIds = [];
    users_ids.forEach(function (userId) {
        docsIds.push(prefixDocId + userId);
    });
    return docsIds;
}

// ----------------------------------------------------------------
// function: createResponse
// args: campaignDoc, updateMetrics, status, error
// return: response object. 
// ----------------------------------------------------------------
// {
//    "id": "tid-85-cid-85-acsl-85-tplid-88-eng-1234",
//     "tenant_id": "int",
//     "campaign_id": "int",
//     "action_serial": "int",
//     "template_id": "int",
//     "template_type": "normal|personalized",
//     "schedule": "unix epic timestamp",
//     "response_status": "scheduled/failed",
//     "bulk_size" : "int",
//     "succeeded": "int",
//     "failed": "int",
//     "error": "campaign already exist"
//   }
// ---------------------------------------------------------------- 
exports.createResponse = function (campaignDoc, updateMetrics, status, error) {

    var response = {
        "id": campaignDoc._id,
        "tenant_id": campaignDoc.tenant_id,
        "campaign_id": campaignDoc.campaign_id,
        "action_serial": campaignDoc.action_serial,
        "template_id": campaignDoc.template_id,
        "engagement_id": campaignDoc.engagement_id,
        "schedule": campaignDoc.schedule,
        "response_status": status,
        "bulk_size": updateMetrics.bulkSize,
        "succeeded": updateMetrics.successCount,
        "failed": updateMetrics.failureCount,
        "error": error
    };


    return response;

}