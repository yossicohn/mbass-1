'use strict';
//const Logging = require('@google-cloud/logging');
//const logging = Logging();
var dbModule = require("./dbmodule.js");
var pubsubUtil = require("./pubsub.js");
var utils = require("./general-utils.js");
var tokenUtils = require("./tokens-utils.js");
var sleep = require('sleep');
var readJson = require('read-package-json');
var MongoClient = require('mongodb').MongoClient,
    assert = require('assert');
const uuidV4 = require('uuid/v4');


var url = 'mongodb://104.198.223.2:27017/mbassdb';

var dbRef = undefined;
//var url = 'mongodb://104.198.223.2:27017,35.202.175.206:27017,146.148.105.234:27017/mbassdb?replicaSet=mbass&slaveOk=true&connectTimeoutMS=2000&socketTimeoutMS=0';

var tenantCampaignsDataCollectionNameBase = 'CampaignsData_';
var tenantCustomersTokens = 'CustomersTokens_';
var tenantVisitorsTokens = 'VisitorsTokens_';
var tenantCampaignsDataCollectionNameBase = 'CampaignsData_';


const campaignControlTopicName = "campaign-control";
const campaignQueueTopicName = "campaign-queue";
// Imports the Google Cloud client library
const PubSub = require('@google-cloud/pubsub');

// Your Google Cloud Platform project ID
const projectId = 'mobilepush-161510';

// Instantiates a client
const pubsubClient = PubSub({
    projectId: projectId
});

var pubsubV1 = require('@google-cloud/pubsub').v1({
    // optional auth parameters.
});

var admin = require("firebase-admin");
var adminClients = {};

var serviceAccountSDKoController = require("../mobilesdk-master-dev-firebase-adminsdk-etwd8-bb7913dce1.json");
var serviceAccountAppController = require("../appcontrollerproject-developer-firebase-adminsdk-xv10y-853771a0b1.json");

// admin.initializeApp({
//     credential: admin.credential.cert(serviceAccountSDKoController),
//     databaseURL: "https://mobilesdk-master-dev.firebaseio.com",

// });


//var rtDB = admin.database();

var CampaignStatus = {
    scheduled: 1,
    started: 2,
    halted: 3,
    completed: 4,
    aborted: 5,
    deleted: 6,
    failed: 7
};


var mongoDBOptions = {
    keepAlive: 10000,
    poolSize: 10,
    connectTimeoutMS: 50000
};
/**
 * Report an error to StackDriver Error Reporting. Writes the minimum data
 * required for the error to be picked up by StackDriver Error Reporting.
 *
 * @param {Error} err The Error object to report.
 * @param {Function} callback Callback function.
 */
// var reportError = function (err, callback) {
//     // This is the name of the StackDriver log stream that will receive the log
//     // entry. This name can be any valid log stream name, but must contain "err"
//     // in order for the error to be picked up by StackDriver Error Reporting.
//     const logName = 'errors';
//     const log = logging.log(logName);

//     const metadata = {
//       // https://cloud.google.com/logging/docs/api/ref_v2beta1/rest/v2beta1/MonitoredResource
//       resource: {
//         type: 'client_campaign_api',
//         labels: {
//           function_name: 'createCampaign'
//         }
//       }
//     };

//     // https://cloud.google.com/error-reporting/reference/rest/v1beta1/ErrorEvent
//     const errorEvent = {
//       message: err.stack,
//       serviceContext: {
//         service: `client_campaign_api:${'createCampaign'}`,
//         version: '1.0.0'//require('package.json').version || 'unknown'
//       }
//     };

//     // Write the error log entry
//     log.write(log.entry(metadata, errorEvent), callback);
//   }
var failedMetrics = {
    failureCount: -1,
    successCount: -1,
    bulkSize: -1
};

var PNPayloadTemplate = {
    "data": {
        "campaign_id": undefined,
        "action_serial": undefined,
        "template_id": undefined,
        "engagement_id": undefined,
        "is_optipush": true,
        "title": "Notification Title",
        "content": "Notification Body",
        "dynamic_links": {
            "android": {},
            "ios": {}
        }
    },
    "priority": "high",
    "content_available": true,
};

// -------------------------------------- Functions -----------------------------------

// --------------------------- Utilitu member functions -----------------------
//-----------------------------------------------------------------------------
// functions: cleanup
// args: db
// description: Clean up.
//---------------------------------------------------------------------------
var cleanup = function (db) {
    if (db != undefined) {
        db.close();
        db = undefined;
    }
}


//-----------------------------------------------------------------------------
// functions: executeTest
// args: campaign meta data
// description:mock for the register
// format example:
// {
//     "command_name": "get_campaign_data",
//     "tenant_id": "int",
//     "campaign_id": "int",
//     "action_serial": "int",
//     "template_id": "int"
//   }
//---------------------------------------------------------------------------
exports.executeTest = function (req, res) {

    var err = undefined;
    var status = undefined;
    var registrationToken =
        "fxLfMsBvDZo:APA91bEj5ywui1jCe3siFYnbkY_ruNJoB37ZhxwEx_qH33AHKf6TbrmNTewZ1KDVMzweQC2JwaDaOS5gvm9cDGbg477vLaTsM_ldKEgGtrQumrJGO4zVofAjlo6mhrVatees4jG9DAwh";
    var payload = {
        // notification: {
        //     title: "My title",
        //     body: "My description", // <= CHANGE
        //     sound : "default"
        // },
        data: {
            "title": "Unique Title",
            "content": "Your money in my wallet",
            "dynamicLink": "https://bw4se.app.goo.gl/59IiDJZ8YaHheku83",
            "is_optipush": "true"
        }

    };
    var createReq = req.body;


    var adminTest = admin.initializeApp({
        credential: admin.credential.cert(serviceAccountAppController),

    }, "test");

    // Send a message to the device corresponding to the provided
    // registration token.
    var options = {
        priority: "high",
        contentAvailable: true,
        timeToLive: 60 * 60 * 24
    };
    adminTest.messaging().sendToDevice(registrationToken, payload, options)
        .then(function (response) {
            // See the MessagingDevicesResponse reference documentation for
            // the contents of response.
            console.log("Successfully sent message:", response);


            var errMsg = "execute:campaign not exist, please check campaign details";
            var response = createResponse(createReq, undefined, false, errMsg);
            res.json(response);
        })
        .catch(function (error) {
            console.log("Error sending message:", error);
        });


}


// ----------------------------------------------------------------------------
// ----------------------------------------------------------------
// function: getScheduledCampaign
// args: deltaFromNow
// return: response campaign document.
// ----------------------------------------------------------------
// ----------------------------------------------------------------
var getScheduledCampaignOrg = function (createReq, deltaFromNow) {

    return new Promise(function (resolve, reject) {


        MongoClient.connect(url, mongoDBOptions)
            .then(function (db) {
                console.log("getScheduledCampaign: Connected correctly to server");
                var status = true;
                var tenantId = createReq.tenant_id;
                var tenantCampaignCollectionName = tenantCampaignsDataCollectionNameBase + tenantId;
                var tenantCampaignsDataCollection = db.collection(tenantCampaignCollectionName);
                var docId = getDocId(createReq);
                tenantCampaignsDataCollection.findOne({
                        _id: docId
                    })
                    .then(function (exisitingDoc) {
                        if (exisitingDoc == null) {
                            reject("Campaign Don't Exisit");
                        } else {
                            resolve({
                                db: db,
                                doc: exisitingDoc
                            });
                        }
                    })
                    .catch(function (error) {
                        console.log("getScheduledCampaign: findOne Failed error= " + error);
                        reject(error);
                    })
            })
            .catch(function (error) {
                console.log("connection Failed error= " + error)
                reject(error);
            })
    });

}


var processNonPersonalizedCampaignExecution = function (db, campaignDoc, clientAdmin, options) {
    return new Promise(function (resolve, reject) {

        handleNonPersonalizedCampaignExecutionPromised(db, campaignDoc, clientAdmin, options)
            .then((result) => {
                //console.log(result);
                resolve(result);
            })
            .catch((error) => {
                reject(error);
            });
    });
}



// ----------------------------------------------------------------
// function: handleCampaignExecution
// args: db, campaignDoc, clientAdmin, options
// return: response dataPayload.
// ----------------------------------------------------------------
var handleCampaignExecution = function (db, campaignDoc, clientAdmin, options) {

    return new Promise(function (resolve, reject) {
        var promises = [];
        var bulkCounter = 0;
        var numOfDataMessages = campaignDoc.campaign_process.number_of_data_messages;
        for (bulkCounter = 0; bulkCounter < numOfDataMessages; bulkCounter++) {
            console.log("count=" + bulkCounter);

            if (campaignDoc.personalized == false) {
                var currPromis = processNonPersonalizedCampaignExecution(db, campaignDoc, clientAdmin, options);
                promises.push(currPromis);

            } else if (campaignDoc.personalized == true) {
                var currPromis = processPersonalizedCampaignExecution(db, campaignDoc, clientAdmin, options);
                promises.push(currPromis);
            }
        }
        Promise.all(promises)
            .then((results) => {
                //  console.log(results);
                resolve(results);
            })
            .catch((error) => {
                //console.log(error);
                reject(error);
            })
    })
}

// ----------------------------------------------------------------
// function: handleNonPersonalizedCampaignExecution
// args: db,campaignDoc, clientAdmin, options
// return: response dataPayload.
// ----------------------------------------------------------------
var handleNonPersonalizedCampaignExecutionPromised2 = function (db, campaignDoc, clientAdmin, options) {

    return new Promise(function (resolve, reject) {

        var topicName = campaignDoc.data_queue_name;
        var subscription = "sub_" + topicName;
        pubsubUtil.getTargetedUserBulkArray(projectId, subscription, 2)
            .then(function (results) {
                var responses = results.response;
                if (responses.receivedMessages.length > 0) {
                    var registartion_ids = [];
                    var users_ids = [];
                    var campaignPayload = utils.buildNonPerolalizedCampaignPayload(campaignDoc);
                    responses.receivedMessages.forEach(function (response) {
                        console.log("attributes.description = " + response.message.attributes.description);
                        console.log("messageId = " + response.message.messageId);
                        console.log("byteLength = " + response.message.data.byteLength);
                        var message = Buffer.from(response.message.data, 'base64').toString();
                        var targetedUserDataArray = JSON.parse(message);
                        targetedUserDataArray.forEach(function (targetedUser) {
                            users_ids.push(targetedUser.Id);
                        });
                        console.log("message: targetedUserDataArray Length = " + targetedUserDataArray.length);
                        tokenUtils.getNonPersonalizedUsersTokens(db, campaignDoc, users_ids)
                            .then((registartion_ids) => {
                                utils.sendPromissedPN(registartion_ids, campaignPayload, clientAdmin, options)
                                    // .then((fcmResults) => {
                                    //     resolve(fcmResults);
                                    // })
                                    .then((fcmResults) => {
                                        var numOfDevices = tokensData.registration_id_tokens.length;
                                        var resultedExecution = {
                                            fcmSendResults: fcmResults,
                                            numOfTargetedDevices: numOfDevices,
                                            numOfTargetedUsers: users_ids.length
                                        };
                                        resolve(resultedExecution);
                                    })
                                    .catch((error) => {
                                        console.log("sendPromissedPN: Failed errorResponse = " + error);
                                        reject(error);
                                    })
                            })
                            .catch((error) => {
                                console.log("getNonPersonalizedUsersTokens: Failed errorResponse = " + error);
                                reject(error);
                            })


                    })
                } else {
                    console.log("getTargetedUserBulkArray: Returened with no messages");
                    var resultedExecution = {
                        doc: updatedDoc,
                        numOfUsersMessages: responses.receivedMessages.length
                    };
                    resolve(resultedExecution);
                }


            })
            .catch((error) => {
                console.log("handleCampaignExecution: failed:-" + error);
                reject(error);
            });

    })

}


// ----------------------------------------------------------------
// function: handleNonPersonalizedCampaignExecution
// args: db, campaignDoc, clientAdmin
// return: results of the Execution:
// var resultedExecution = {
//     fcmResults: fcmResults,
//     tokensResult: tokensResult,                                    
//     numOfTargetedDevices: responses.receivedMessages.length,
//     numOfTargetedUsers: users_ids.length
// };
// 
// ----------------------------------------------------------------
var handleNonPersonalizedCampaignExecutionPromised = function (db, campaignDoc, clientAdmin, options) {

    return new Promise(function (resolve, reject) {

        var topicName = campaignDoc.data_queue_name;
        var subscription = "sub_" + topicName;
        pubsubUtil.getTargetedUserBulkArray(projectId, subscription, 10)
            .then(function (results) {
                var responses = results.response;
                if (responses.receivedMessages.length > 0) {
                    var registartion_ids = [];
                    var users_ids = [];
                    var campaignPayload = utils.buildNonPerolalizedCampaignPayload(campaignDoc);
                    responses.receivedMessages.forEach(function (response) {
                        console.log("attributes.description = " + response.message.attributes.description);
                        console.log("messageId = " + response.message.messageId);
                        console.log("byteLength = " + response.message.data.byteLength);
                        var message = Buffer.from(response.message.data, 'base64').toString();
                        var targetedUserDataArray = JSON.parse(message);
                        targetedUserDataArray.forEach(function (targetedUser) {
                            users_ids.push(targetedUser.Id);
                        });

                        console.log("message: targetedUserDataArray Length = " + targetedUserDataArray.length);
                        tokenUtils.getNonPersonalizedUsersTokens(db, campaignDoc, users_ids)
                            .then((tokensData) => {
                                utils.sendPromissedPN(tokensData, campaignPayload, clientAdmin, options)
                                    .then((fcmResults) => {
                                        var numOfDevices = tokensData.registration_id_tokens.length;
                                        console.log(JSON.stringify(fcmResults));
                                        var resultedExecution = {
                                            fcmSendResults: fcmResults,
                                            numOfTargetedDevices: numOfDevices,
                                            numOfTargetedUsers: users_ids.length
                                        };
                                        resolve(resultedExecution);

                                    })
                                    .catch((error) => {
                                        console.log("sendPromissedPN: Failed errorResponse = " + error);
                                        reject(error);
                                    })
                            })
                            .catch((error) => {
                                reject(error);
                            })


                    });
                } else {
                    var resultedExecution = {
                        numOfUsersMessages: responses.receivedMessages.length
                    };
                    resolve(resultedExecution);
                }


            })
            .catch((error) => {
                console.log("handleCampaignExecution: failed:-" + error);
                reject(error);
            });

    })

}





// ----------------------------------------------------------------
// ----------------------------------------------------------------
// function: processPersonalizedCampaignExecution
// args: db, campaignDoc, clientAdmin,options
// return: response dataPayload.
// ----------------------------------------------------------------
var processPersonalizedCampaignExecution = function (db, campaignDoc, clientAdmin, options) {

    return new Promise(function (resolve, reject) {

        var topicName = campaignDoc.data_queue_name;
        var subscription = "sub_" + topicName;
        pubsubUtil.getTargetedUserBulkArray(projectId, subscription, 10)
            .then(function (result) {
                var responses = result.response;
                if (responses.receivedMessages.length > 0) {
                    var registartion_ids = [];
                    var usersPersonaizedPayload = {};
                    responses.receivedMessages.forEach(function (response) {
                        console.log("attributes.description = " + response.message.attributes.description);
                        console.log("messageId = " + response.message.messageId);
                        console.log("byteLength = " + response.message.data.byteLength);
                        var message = Buffer.from(response.message.data, 'base64').toString();
                        var targetedUserDataArray = JSON.parse(message);
                        targetedUserDataArray.forEach(function (targetedUser) {
                            var campaignPayload = utils.buildPersonalizedCampaignPayload(campaignDoc);
                            var data = utils.createPersonalizedPayload(campaignPayload, targetedUser);
                            usersPersonaizedPayload[targetedUser.Id] = data;
                        });
                        console.log("processPersonalizedCampaignExecution: message: targetedUserDataArray Length = " + targetedUserDataArray.length);
                        tokenUtils.getUsersTokensForPersonalizedCampaign(db, campaignDoc, usersPersonaizedPayload)
                            .then((usersPersonaizedPayload) => {
                                utils.sendPromissedPersonalizedMessages(usersPersonaizedPayload, clientAdmin, options)
                                    .then((fcmResults) => {
                                        var numOfDevices = 0;
                                        var usersIds = Object.keys(usersPersonaizedPayload);
                                        usersIds.forEach((currUserId) => {
                                            numOfDevices += usersPersonaizedPayload[currUserId].tokens.length;
                                        });
                                        var resultedExecution = {
                                            fcmSendResults: fcmResults,
                                            numOfTargetedDevices: numOfDevices,
                                            numOfTargetedUsers: usersIds.length
                                        };
                                        resolve(resultedExecution);
                                    })
                                    .catch((error) => {
                                        console.log("processPersonalizedCampaignExecution:: Failed errorResponse = " + error);
                                        reject(error);
                                    })
                            })
                            .catch((error) => {
                                console.log("processPersonalizedCampaignExecution:: Failed errorResponse = " + error);
                                reject(error);
                            })
                    })
                } else {
                    var resultedExecution = {
                        doc: campaignDoc,
                        numOfUsersMessages: responses.receivedMessages.length
                    };
                    resolve(resultedExecution);
                }


            })
            .catch((error) => {
                console.log("handleCampaignExecution: failed:-" + error);
                reject(error);
            });
    })
}

// ----------------------------------------------------------------
// function: buildNonPerolalizedCampaignPayload
// args: exisitingCampaignDoc
// return: response dataPayload.
// ----------------------------------------------------------------
var buildNonPerolalizedCampaignPayloadOrg = function (campaignDoc) {
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
var buildPersonalizedCampaignPayloadOrg = function (campaignDoc) {
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
var initPersonalizedrDataPayloadOrg = function (exisitingCampaignDoc) {

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
var initNonPersonalizedrDataPayloadOrg = function (exisitingCampaignDoc) {

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
// function: getDocId
// args: request
// return: response object. 
// ----------------------------------------------------------------
//    "_id" : "tid-<int>_cid-<int>_acsl-<int>_tplid-<int>-eng-<int>",
// example : 
// "_id": "tid-85_cid-1004_acsl-13_tplid-123-eng-1234"
// ---------------------------------------------------------------- 
var getDocIdOrg = function (createReq) {
    var docId = "tid-" + createReq.tenant_id +
        "-cid-" + createReq.campaign_id +
        "-acsl-" + createReq.action_serial +
        "-tplid-" + createReq.template_id +
        "-eng-" + createReq.engagement_id;
    return docId;
}


//-----------------------------------------------------------------------------
// functions: sendPromissedPN
// args: tokensData = {registrationTokens, mapping}, payload
// Return: response/error
//-----------------------------------------------------------------------------
var sendPromissedPNOrg = function (tokensData, payload, clientAdmin, options) {
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
var sendPromissedPersonalizedMessagesOrg = function (usersPersonaizedPayload, clientAdmin, options) {
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
var sendSinglePersonalizedMessagePromiseOrg = function (clientAdmin, userData, options) {
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
// function: getTargetedUserBulkArray
// args: projectId, subscription, maxMessages
// return: respons Array.
// ----------------------------------------------------------------
var getTargetedUserBulkArrayOrg = function (projectId, subscription, maxMessages) {
    return new Promise(function (resolve, reject) {
        var client = pubsubV1.subscriberClient();
        var formattedSubscription = client.subscriptionPath(projectId, subscription);
        //var maxMessages = 0;

        var options = {
            timeout: 10
        };
        var request = {
            subscription: formattedSubscription,
            maxMessages: maxMessages,
            returnImmediately: true

        };
        client.pull(request, options)
            .then(function (responses) {

                var response = responses[0];
                if (response.receivedMessages.length == 0) {
                    console.log("receivedMessages=0");
                } else {

                }
                resolve({
                    response: response,

                });
            })
            .catch(function (err) {
                console.error(err);
            });
    });
}


// ----------------------------------------------------------------
// function: createCampaignSubscriber
// args:topicName, subscriptionName
// return: respons Array.
// We first check if subscription exist if not we failed and then we create it.
// ----------------------------------------------------------------
var createCampaignSubscriberOrg = function (topicName, subscriptionName) {
    return new Promise(function (resolve, reject) {

        var client = pubsubV1.subscriberClient();
        var formattedSubscription = client.subscriptionPath(projectId, subscriptionName);
        client.getSubscription({
                subscription: formattedSubscription
            })
            .then(function (data) {
                var subscription = data[0];
                resolve(subscription);
            })
            .catch(function (err) {
                // Not Exist hence we need to create
                pubsubClient.createSubscription(topicName, subscriptionName)
                    .then(function (data) {
                        var subscription = data[0];
                        var apiResponse = data[1];
                        resolve(subscription);
                    })
                    .catch((error) => {
                        console.log("createCampaignSubscriber Failed " + error)
                        reject(error);
                    });
            });
        ``

    });
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
var getUsersTokensForPersonalizedCampaignOrg = function (db, campaignDoc, usersPersonaizedPayload) {
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
// function: getUsersTokens
// args:db, campaignDoc, users_ids
// return: respons registration_ids for the PN.
// We first check if subscription exist if not we failed and then we create it.
// Process:
// we need to go to the appropriate users Database (Visitors/Customers).
// And find by the ID's the different Users Document.
// Go uver the Document and in the Targeted apps (in the devices) get the appropriate tokens.
// ----------------------------------------------------------------
var getUsersTokensOrg = function (db, campaignDoc, users_ids) {
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
// function: getCustomersPersonalizedCampaignTokens
// args:db, campaignDoc, usersPersonaizedPayload
// return: respons registration_ids for the Customers PN Campaign.
// We first check if subscription exist if not we failed and then we create it.
// Process:
// we need to go to the appropriate users Database (Visitors/Customers).
// And find by the ID's the different Users Document.
// Go over the Document and in the Targeted apps (in the devices) get the appropriate tokens.
// ----------------------------------------------------------------
var getCustomersPersonalizedCampaignTokensOrg = function (db, campaignDoc, usersPersonaizedPayload) {
    return new Promise(function (resolve, reject) {
        var usersCollectionName = undefined;
        var registration_ids_tokens = undefined;
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
                            usersPersonaizedPayload = tokenUtils.getTokensFromCustomerDocForPersonalizedCampaign(campaignDoc, result.data, usersPersonaizedPayload)
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
        usersCollectionName = tenantCustomersTokens + campaignDoc.tenant_id;
        var prefixDocId = "tid-" + campaignDoc.tenant_id + "-pcid-";
        var documentsIds = getDocumentsIdsByUsersIds(prefixDocId, users_ids, campaignDoc.audience);
        if (db != undefined) {
            try {
                var usersCollection = db.collection(usersCollectionName);
                getUsersBatchDocument(documentsIds, usersCollection)
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
// function: getDocumentsIdsByUsersIds
// args:prefixDocId, users_ids, userType
// return: the Documents Id's by the UsersIds and Type (Visitor/Customers)
// ----------------------------------------------------------------
var getDocumentsIdsByUsersIdsOrg = function (prefixDocId, users_ids, userType) {

    var docsIds = [];
    users_ids.forEach(function (userId) {
        docsIds.push(prefixDocId + userId);
    });
    return docsIds;
}


// ----------------------------------------------------------------
// function: getUsersBatchDocument
// args:documentsIds, usersCollection
// return: the Documents  by the documentsIds
// ----------------------------------------------------------------
var getUsersBatchDocumentOrg = function (documentsIds, usersCollection) {
    return new Promise(function (resolve, reject) {
        var usersDocuments = undefined;
        var cursor = usersCollection.find({
            _id: {
                $in: documentsIds //["tid-85-pcid-yossi", "tid-85-pcid-yossi1", "tid-85-pcid-yossi2"] 
            }
        });
        cursor.toArray(function (err, docs) {
            console.log(docs.length)
            usersDocuments = docs;
            docs.forEach(function (doc) {
                console.log("_id = " + doc._id);
            });
            var result = {
                data: usersDocuments,
                status: 1
            }
            resolve(result);
        });
    });

}

// ----------------------------------------------------------------
// function: getTokensFromCustomerDocForPersonalizedCampaign
// args:campaignDoc, customersDocs, usersPersonaizedPayload
// return: the Tokens from the Customer Documents
// We add all the relevant Tokensof a user to the array
// ----------------------------------------------------------------
var getTokensFromCustomerDocForPersonalizedCampaignOrg = function (campaignDoc, customersDocs, usersPersonaizedPayload) {
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
                userData.tokens = tokenUtils.updateTokensArrayWithDevicesTokens(targetedAppsObj, devices, userData.tokens);
            }

            if (targetedIOSApps != undefined && doc.ios_tokens != undefined) {
                if (userData.tokens == undefined) {
                    userData.tokens = [];
                }
                // we check that there are apps targeted and that ther are exist in the current doc
                var devices = doc.ios_tokens; // get the devices
                var targetedAppsObj = targetedAndroidApps; // the Android Targeted Apps by the Campaign
                userData.tokens = tokenUtils.updateTokensArrayWithDevicesTokens(targetedAppsObj, devices, userData.tokens);
            }
        }

    })

    return usersPersonaizedPayload;
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
var getTokensFromCustomerDocOrg = function (campaignDoc, customersDocs) {

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

// ----------------------------------------------------------------
// function: updateTokensArrayWithDevicesTokens
// args:targetedAppsObj, devicesIds, registration_id_tokens, tokensUsersMap, currUserId
// return: the Tokens from the Customer Documents
// ----------------------------------------------------------------
var updateTokensArrayWithDevicesTokensOrg = function (targetedAppsObj, devices, registration_id_tokens, tokensUsersMap, currUserId) {
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
// function: handlePNResults
// args:fcmResults, campaignDoc
// return: fcmResults
// description:
// This function should go over the results and update the
// Campaign Doc Statistics.
// We should update: successfull_push, failed_push, push_bulk_size, sleep_time_between_bulks
//
// Campaign Document Statistics Section:
// "campaign_stats" : {
//     "successfull_push" : -1,
//     "failed_push" : -1,
//     "successfull_push_retries" : -1,
//     "failed_push_retries" : -1,
//     "push_bulk_size" : -1,
//     "sleep_time_between_bulks" : -1
// }
// ----------------------------------------------------------------
var handlePNCampaignResults = function (db, fcmResults, campaignDoc) {

    return new Promise(function (resolve, reject) {
        console.log(fcmResults);
        console.log("fcmResults.failureCount = " + fcmResults.failureCount);
        console.log("fcmResults.successCount = " + fcmResults.successCount);
        var bulkSize = parseInt(fcmResults.successCount) + parseInt(fcmResults.failureCount);
        console.log("BulkSize = " + bulkSize);

        var updateMetrics = {
            failureCount: fcmResults.failureCount,
            successCount: fcmResults.successCount,
            bulkSize: bulkSize
        }
        console.log("updateMetrics:" + JSON.stringify(updateMetrics));
        UpdateCampaignExecutionMetrics(db, campaignDoc, updateMetrics)
            .then((doc) => {
                resolve(doc);
            })
            .catch((error) => {

                reject(error);
            })
    });
}


// ----------------------------------------------------------------
// function: handlePersonalizedPNCampaignResults
// args:db, fcmResults, campaignDoc
// return: fcmResults
// description:
// This function should go over the results and update the
// Campaign Doc Statistics.
// We should update: successfull_push, failed_push, push_bulk_size, sleep_time_between_bulks
//
// Campaign Document Statistics Section:
// "campaign_stats" : {
//     "successfull_push" : -1,
//     "failed_push" : -1,
//     "successfull_push_retries" : -1,
//     "failed_push_retries" : -1,
//     "push_bulk_size" : -1,
//     "sleep_time_between_bulks" : -1
// }
// ----------------------------------------------------------------
var handlePersonalizedPNCampaignResults = function (db, fcmResults, campaignDoc) {

    return new Promise(function (resolve, reject) {
        var failureCount = 0;
        var successCount = 0;
        var totalBulkSize = 0;
        fcmResults.forEach((fcmResult) => {
            console.log(fcmResult);
            console.log("fcmResults.failureCount = " + fcmResult.failureCount);
            console.log("fcmResults.successCount = " + fcmResult.successCount);
            var bulkSize = parseInt(fcmResult.successCount) + parseInt(fcmResult.failureCount);
            console.log("BulkSize = " + bulkSize);
            successCount += parseInt(fcmResult.successCount);
            failureCount += parseInt(fcmResult.failureCount);
            totalBulkSize += bulkSize;
        });
        var updateMetrics = {
            failureCount: failureCount,
            successCount: successCount,
            bulkSize: totalBulkSize
        }

        console.log("updateMetrics:" + JSON.stringify(updateMetrics));
        UpdateCampaignExecutionMetrics(db, campaignDoc, updateMetrics)
            .then((doc) => {
                resolve(doc);
            })
            .catch((error) => {

                reject(error);
            })
    });
}

// ----------------------------------------------------------------
// function: UpdateCampaignExecutionMetrics
// args:db, fcmResults, campaignDoc
// return: fcmResults
// description:
// This function should go over the results and update the
// Campaign Doc Statistics.
// We should update: successfull_push, failed_push, push_bulk_size, sleep_time_between_bulks
//
// Campaign Document Statistics Section:
// "campaign_stats" : {
//     "successfull_push" : -1,
//     "failed_push" : -1,
//     "successfull_push_retries" : -1,
//     "failed_push_retries" : -1,
//     "push_bulk_size" : -1,
//     "sleep_time_between_bulks" : -1
// }
// ----------------------------------------------------------------
var UpdateCampaignExecutionMetrics = function (db, campaignDoc, updateMetrics) {

    return new Promise(function (resolve, reject) {
        if (db != undefined) {
            try {
                var status = true;
                var tenantId = campaignDoc.tenant_id;
                var tenantCampaignCollectionName = tenantCampaignsDataCollectionNameBase + tenantId;
                var tenantCampaignsDataCollection = db.collection(tenantCampaignCollectionName);
                var docId = campaignDoc._id;
                var now = new Date().getTime();
                tenantCampaignsDataCollection.findOneAndUpdate({
                        _id: docId
                    }, {
                        $set: {
                            timestamp: now
                        },
                        $inc: {
                            "campaign_stats.successfull_push": updateMetrics.successCount,
                            "campaign_stats.failed_push": updateMetrics.failureCount,
                        },
                        $max: {
                            "campaign_stats.push_bulk_size": updateMetrics.bulkSize
                        }
                    }, {
                        returnNewDocument: true
                    })
                    .then(function (exisitingDoc) {
                        if (exisitingDoc == null) {

                            reject("Campaign Don't Exisit");
                        } else {
                            resolve(exisitingDoc);
                        }
                    })
                    .catch(function (error) {

                        reject(error);
                    })


            } catch (error) {
                reject("UpdateCampaignExecutionMetrics: Failed error = " + error);
            }
        } else {
            reject("UpdateCampaignExecutionMetrics: db is undefined")
        }


    });
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

// ----------------------------------------------------------------
// function: createPersonalizedPayload
// args: campaignPayload, targetedUser
// return: response object.
// ----------------------------------------------------------------
var clonePayload = function (campaignPayload) {

    var clone = {};

    return clone;
}

// ----------------------------------------------------------------
// function: createPersonalizedPayload
// args: campaignPayload, targetedUser
// return: response object.
// ----------------------------------------------------------------
var createPersonalizedPayloadOrg = function (campaignPayload, targetedUser) {

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
var createResponse = function (campaignDoc, updateMetrics, status, error) {

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


// ----------------------------------------------------------------
// function: UpdateCampaignStatus
// args: db, campaignDoc, status
// return: response object. 
// ----------------------------------------------------------------
var UpdateCampaignStatusOrg = function (db, campaignDoc, updateMetrics, status) {

    return new Promise(function (resolve, reject) {

        var tenantId = campaignDoc.tenant_id;
        var tenantCampaignCollectionName = tenantCampaignsDataCollectionNameBase + tenantId;
        var tenantCampaignsDataCollection = db.collection(tenantCampaignCollectionName);
        var docId = campaignDoc._id;
        if (status == "completed") {
            var successCount = Number(updateMetrics.successCount);
            var failureCount = Number(updateMetrics.failureCount);
            var numOfDevices = Number(updateMetrics.numOfDevices);
            var numOfTargetedUsers = Number(updateMetrics.numOfTargetedUsers);
        } else {
            var successCount = 0;
            var failureCount = 0;
            var numOfDevices = 0;
            var numOfTargetedUsers = 0;
        }


        tenantCampaignsDataCollection.findOneAndUpdate({
                _id: docId
            }, {
                $set: {
                    "campaign_status": status
                },
                $inc: {
                    "campaign_stats.successfull_push": successCount,
                    "campaign_stats.failed_push": failureCount,
                    "campaign_stats.numOfTargetedDevices": numOfDevices,
                    "campaign_stats.numOfTargetedUsers": numOfTargetedUsers
                },
                $max: {
                    "campaign_stats.push_bulk_size": updateMetrics.bulkSize
                }
            }, {
                returnNewDocument: true
            })
            .then(function (exisitingDoc) {
                if (exisitingDoc == null) {
                    reject("Campaign Don't Exist");
                } else {
                    resolve(exisitingDoc);
                }
            })
            .catch(function (error) {
                console.log(error);
                reject(error);
            })
    });

}

//-----------------------------------------------------------------------------
// functions: prepareExecutionResources
// args: createReq, db, campaignDoc
// description: perpare Process Resources.
// //---------------------------------------------------------------------------
var prepareExecutionResourcesOrg = function (createReq, db, campaignDoc) {
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
                createCampaignSubscriber(topicName, subscriptionName)
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
var getNonPersonalizedCampaignProcessStatsOrg = function (personalizedCampaignResults) {
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
var getPersonalizedCampaignProcessStatsOrg = function (personalizedCampaignResults) {
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

//-----------------------------------------------------------------------------
// functions: startExecuteCampaign
// args: db, campaignDoc, subscription, clientAdmin, options
// description: Main Process
//---------------------------------------------------------------------------
var startExecuteCampaign = function (db, campaignDoc, subscription, clientAdmin, options) {
    return new Promise(function (resolve, reject) {
        console.log("startExecuteCampaign: Call  handleCampaignExecution : subscriptionName = " + subscription.name);
        handleCampaignExecution(db, campaignDoc, clientAdmin, options)
            .then((resultedExecutionArray) => {
                var updateMetrics = {
                    failurCount: 0,
                    successCounresultedExecutionArrayt: 0,
                    bulkSize: 0
                }
                if (campaignDoc.personalized == true) {
                    console.log("startExecuteCampaign: Finished Personalized Campaign Calculting Metrics ");
                    updateMetrics = utils.getPersonalizedCampaignProcessStats(resultedExecutionArray);
                } else {
                    console.log("startExecuteCampaign: Finished Non-Personalized Campaign Calculting Metrics ");
                    updateMetrics = utils.getNonPersonalizedCampaignProcessStats(resultedExecutionArray);
                }

                var result = {
                    updateMetrics: updateMetrics,
                    doc: campaignDoc
                };
                resolve(result);
            })
            .catch((error) => {
                console.log("startExecuteCampaign: Failed " + error);
                reject(error);

            })
    });

}

//-----------------------------------------------------------------------------
// functions: UpdateCampaignStatusAndSendResponse
// args: db, res, updatedDoc, updateMetrics, status, error
// description: Main Process
// //---------------------------------------------------------------------------
var UpdateCampaignStatusAndSendResponse = function (db, res, updatedDoc, updateMetrics, status, error) {

    return new Promise(function (resol, reject) {
        var response = undefined;
        if (status == true) {
            dbModule.UpdateCampaignStatus(db, updatedDoc, updateMetrics, CampaignStatus.completed)
                .then((updatedDoc) => {
                    cleanup(db);
                    response = createResponse(updatedDoc, updateMetrics, "completed", error);
                    res.json(response);

                })
                .catch((error) => {
                    cleanup(db);
                    response = createResponse(updatedDoc, updateMetrics, "completed", "Campaign Completed, but Failed Updating Campaign Status");
                    res.status(400);
                    res.json(response);

                });

        } else {
            res.status(400);
            if (db != undefined) {
                dbModule.UpdateCampaignStatus(db, updatedDoc, CampaignStatus.failed)
                    .then((updatedDoc) => {
                        cleanup(db);
                        response = createResponse(updatedDoc, updateMetrics, "failed", error);
                        res.json(response);
                    })
                    .catch((error) => {
                        cleanup(db);
                        response = createResponse(updatedDoc, updateMetrics, "failed", error);
                        res.json(response);
                    });

            } else {
                response = createResponse(updatedDoc, updateMetrics, "failed", error);
            }

        }

    })

}


//-----------------------------------------------------------------------------
// functions: executeCampaign
// args: campaign meta data
// description:mock for the register
// format example:
// {
//     "command_name": "get_campaign_data",
//     "tenant_id": "int",
//     "campaign_id": "int",
//     "action_serial": "int",
//     "template_id": "int"
//   }
// //---------------------------------------------------------------------------
exports.executeCampaign = function (req, res) {

    var err = undefined;
    var status = undefined;

    var createReq = req.body;
    //First we take  the Campaign from the DB.
    dbModule.getScheduledCampaign(createReq, 10000)
        .then(function (result) {
            var db = result.db;
            dbRef = db;
            var campaignDoc = result.doc;
            console.log('getScheduledCampaign Succeeded' + campaignDoc._id);

            var options = {
                priority: "high",
                contentAvailable: true,
                timeToLive: campaignDoc.time_to_live,
                dryRun: createReq.dryRun,
                collapseKey: campaignDoc._id
            };
            utils.prepareExecutionResources(createReq, db, campaignDoc)
                .then((resources) => {
                    startExecuteCampaign(db, campaignDoc, resources.subscription, resources.clientAdmin, options)
                        .then((result) => {
                            console.log("executeCampaign:Call UpdateCampaignStatusAndSendResponse updateMetrics=" + JSON.stringify(result.updateMetrics));
                            UpdateCampaignStatusAndSendResponse(db, res, result.doc, result.updateMetrics, true, undefined);

                        })
                        .catch((error) => {
                            console.log("executeCampaign:Call Failed on UpdateCampaignStatusAndSendResponse updateMetrics=" + JSON.stringify(result.updateMetrics));
                            UpdateCampaignStatusAndSendResponse(db, res, campaignDoc, failedMetrics, false, undefined);

                        })
                })
                .catch((error) => {

                    UpdateCampaignStatusAndSendResponse(db, res, campaignDoc, failedMetrics, false, error);

                })
        })
        .catch(function (error) {
            console.log('getScheduledCampaign Failed');
            UpdateCampaignStatusAndSendResponse(db, res, createReq, failedMetrics, false, undefined);

        })

}