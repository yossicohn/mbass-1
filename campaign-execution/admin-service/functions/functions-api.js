'use strict';
//const Logging = require('@google-cloud/logging');
//const logging = Logging();
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

admin.initializeApp({
    credential: admin.credential.cert(serviceAccountSDKoController),
    databaseURL: "https://mobilesdk-master-dev.firebaseio.com",

});


var rtDB = admin.database();

var CampaignStatus = {
    scheduled: 1,
    started: 2,
    halted: 3,
    completed: 4,
    aborted: 5,
    deleted: 6,
    failed: 7
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
// functions: getCampaignData
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
var getScheduledCampaign = function (createReq, deltaFromNow) {

    return new Promise(function (resolve, reject) {


        MongoClient.connect(url)
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
        var i = 0;
        for (i = 0; i < 10; i++) {
            console.log("count=" + i);

            if (campaignDoc.personalized == false) {
                var currPromis = processNonPersonalizedCampaignExecution(db, campaignDoc, clientAdmin, options);
                promises.push(currPromis);
                // handleNonPersonalizedCampaignExecutionPromised(db, campaignDoc, clientAdmin, options)
                //     .then((result) => {
                //         console.log(result);
                //         resolve(result);
                //     })
                //     .catch((error) => {
                //         reject(error);
                //     });

            } else if (campaignDoc.personalized == true) {
                handlePersonalizedCampaignExecution(db, campaignDoc, clientAdmin, options)
                    .then((result) => {
                        resolve(result);
                    })
                    .catch((error) => {
                        reject(error);
                    })
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
        }

    })
}

// ----------------------------------------------------------------
// function: handleNonPersonalizedCampaignExecution
// args: db,campaignDoc, clientAdmin, options
// return: response dataPayload.
// ----------------------------------------------------------------
var handleNonPersonalizedCampaignExecutionPromised = function (db, campaignDoc, clientAdmin, options) {

    return new Promise(function (resolve, reject) {

        var topicName = campaignDoc.data_queue_name;
        var subscription = "sub_" + topicName;
        getTargetedUserBulkArray(projectId, subscription, 2)
            .then(function (responses) {
                if (responses.receivedMessages.length > 0) {
                    var registartion_ids = [];
                    var users_ids = [];
                    var campaignPayload = buildNonPerolalizedCampaignPayload(campaignDoc);
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
                        getUsersTokens(db, campaignDoc, users_ids)
                            .then((registartion_ids) => {
                                sendPromissedPN(registartion_ids, campaignPayload, clientAdmin, options)
                                    .then((fcmResults) => {
                                        handlePNCampaignResults(fcmResults, campaignDoc)
                                            .then((updatedDoc) => {
                                                var resultedExecution = {
                                                    doc: updatedDoc.value,
                                                    numOfUsersMessages: responses.receivedMessages.length
                                                };
                                                resolve(resultedExecution);
                                            })
                                            .catch((error) => {
                                                console.log("handlePNCampaignResults: Failed errorResponse = " + error);
                                                reject(errorResponse);
                                            })

                                    })
                                    .catch((errorResponse) => {
                                        console.log("sendPromissedPN: Failed errorResponse = " + errorResponse);
                                        reject(errorResponse);
                                    })
                            })
                            .catch((error) => {
                                reject(errorResponse);
                            })


                    })
                } else {
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
// return: response dataPayload.
// ----------------------------------------------------------------
var handleNonPersonalizedCampaignExecutionPromised = function (db, campaignDoc, clientAdmin) {

    return new Promise(function (resolve, reject) {

        var topicName = campaignDoc.data_queue_name;
        var subscription = "sub_" + topicName;
        getTargetedUserBulkArray(projectId, subscription, 10)
            .then(function (results) {
                var responses = results.response;
                if (responses.receivedMessages.length > 0) {
                    var registartion_ids = [];
                    var users_ids = [];
                    var campaignPayload = buildNonPerolalizedCampaignPayload(campaignDoc);
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
                        getUsersTokens(db, campaignDoc, users_ids)
                            .then((registartion_ids) => {
                                sendPromissedPN(registartion_ids, campaignPayload, clientAdmin)
                                    .then((fcmResults) => {
                                        handlePNCampaignResults(db, fcmResults, campaignDoc)
                                            .then((updatedDoc) => {
                                                var resultedExecution = {
                                                    doc: updatedDoc.value,
                                                    numOfUsersMessages: responses.receivedMessages.length
                                                };
                                                resolve(resultedExecution);
                                            })
                                            .catch((error) => {
                                                console.log("handlePNCampaignResults: Failed errorResponse = " + error);
                                                reject(error);
                                            })

                                    })
                                    .catch((error) => {
                                        console.log("sendPromissedPN: Failed errorResponse = " + error);
                                        reject(errorResponse);
                                    })
                            })
                            .catch((error) => {
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
// function: handleNonPersonalizedCampaignExecution
// args: db, campaignDoc, clientAdmin
// return: response dataPayload.
// ----------------------------------------------------------------
var handleNonPersonalizedCampaignExecution = function (db, campaignDoc, clientAdmin) {

    var topicName = campaignDoc.data_queue_name;
    var subscription = "sub_" + topicName;
    getTargetedUserBulkArray(projectId, subscription, 10)
        .then(function (responses) {
            if (responses.receivedMessages.length > 0) {
                var registartion_ids = [];
                var users_ids = [];
                var campaignPayload = buildNonPerolalizedCampaignPayload(campaignDoc);
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
                    getUsersTokens(db, campaignDoc, users_ids)
                        .then((registartion_ids) => {
                            sendPromissedPN(registartion_ids, campaignPayload, clientAdmin)
                                .then((fcmResults) => {
                                    handlePNCampaignResults(db, fcmResults, campaignDoc)
                                        .then((updatedDoc) => {
                                            var resultedExecution = {
                                                doc: updatedDoc.value,
                                                numOfUsersMessages: responses.receivedMessages.length
                                            };
                                            resolve(resultedExecution);
                                        })
                                        .catch((error) => {
                                            console.log("handlePNCampaignResults: Failed errorResponse = " + error);
                                            reject(error);
                                        })

                                })
                                .catch((error) => {
                                    console.log("sendPromissedPN: Failed errorResponse = " + error);
                                    reject(errorResponse);
                                })
                        })
                        .catch((error) => {
                            reject(error);
                        })


                })
            } else {
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

}

// ----------------------------------------------------------------
// ----------------------------------------------------------------
// function: handlePersonalizedCampaignExecution
// args: db, campaignDoc, clientAdmin,options
// return: response dataPayload.
// ----------------------------------------------------------------
var handlePersonalizedCampaignExecution = function (db, campaignDoc, clientAdmin, options) {

    return new Promise(function (resolve, reject) {

        var topicName = campaignDoc.data_queue_name;
        var subscription = "sub_" + topicName;
        var shouldLoop = true;

        getTargetedUserBulkArray(projectId, subscription, 10, shouldLoop)
            .then(function (result) {
                var responses = result.reponse;
                shouldLoop = result.shouldLoop
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
                            var campaignPayload = buildPersonalizedCampaignPayload(campaignDoc);
                            var data = createPersonalizedPayload(campaignPayload, targetedUser);
                            usersPersonaizedPayload[targetedUser.Id] = data;
                        });
                        console.log("handlePersonalizedCampaignExecution: message: targetedUserDataArray Length = " + targetedUserDataArray.length);
                        getUsersTokensForPersonalizedCampaign(db, campaignDoc, usersPersonaizedPayload)
                            .then((usersPersonaizedPayload) => {
                                sendPromissedPersonalizedPN(usersPersonaizedPayload, clientAdmin, options)
                                    .then((fcmResults) => {
                                        handlePersonalizedPNCampaignResults(db, fcmResults, campaignDoc)
                                            .then((updatedDoc) => {
                                                var resultedExecution = {
                                                    doc: updatedDoc.value,
                                                    numOfUsersMessages: responses.receivedMessages.length
                                                };
                                                resolve({
                                                    resultedExecution: resultedExecution,
                                                    shouldLoop: shouldLoop
                                                });
                                            })
                                            .catch((error) => {
                                                console.log("handlePersonalizedCampaignExecution: Failed errorResponse = " + error);
                                                reject(error);
                                            })
                                    })
                                    .catch((error) => {
                                        console.log("handlePersonalizedCampaignExecution:: Failed errorResponse = " + error);
                                        reject(error);
                                    })
                            })
                            .catch((error) => {
                                console.log("handlePersonalizedCampaignExecution:: Failed errorResponse = " + errorResponse);
                                reject(error);
                            })
                    })
                } else {
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
// function: buildNonPerolalizedCampaignPayload
// args: exisitingCampaignDoc
// return: response dataPayload.
// ----------------------------------------------------------------
var buildNonPerolalizedCampaignPayload = function (campaignDoc) {
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
var buildPersonalizedCampaignPayload = function (campaignDoc) {
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
    dataPayload.data.dynamic_links = exisitingCampaignDoc.dynamic_links.toString();

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
var getDocId = function (createReq) {
    var docId = "tid-" + createReq.tenant_id +
        "-cid-" + createReq.campaign_id +
        "-acsl-" + createReq.action_serial +
        "-tplid-" + createReq.template_id +
        "-eng-" + createReq.engagement_id;
    return docId;
}


//-----------------------------------------------------------------------------
// functions: sendPromissedPN
// args: registrationTokens, payload
// Return: response/error
//-----------------------------------------------------------------------------
var sendPromissedPN = function (registrationTokens, payload, clientAdmin, options) {
    return new Promise(function (resolve, reject) {


        clientAdmin.messaging().sendToDevice(registrationTokens, payload, options)
            .then(function (fcmResults) {
                // See the MessagingDevicesResponse reference documentation for
                // the contents of response.
                console.log("sendPromissedPN: Successfully sent message:", fcmResults);
                resolve(fcmResults);
            })
            .catch(function (errorResponse) {
                console.log("sendPromissedPN: Error sending message:", errorResponse);
                reject(errorResponse);
            });

    });
}

// ----------------------------------------------------------------
// function: sendPromissedPersonalizedPN
// arguments: usersPersonaizedPayload, clientAdmin, options
// return: respons Array.
// ----------------------------------------------------------------
var sendPromissedPersonalizedPN = function (usersPersonaizedPayload, clientAdmin, options) {
    return new Promise(function (resolve, reject) {
        var failedCounter = 0;
        var fcmBulkResults = [];
        var promises = [];
        var userss_ids = Object.keys(usersPersonaizedPayload);
        userss_ids.forEach((userId) => {
            var userData = usersPersonaizedPayload[userId];
            if (userData.tokens != undefined) {
                var currPromise = sendMessagePromise(clientAdmin, userData.tokens, userData.payload, options);
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
// function: sendMessagePromise
// args: clientAdmin,tokens, payload, options
// return: fcmResult.
// this promissed is used in the Promis.all array
// ----------------------------------------------------------------
var sendMessagePromise = function (clientAdmin, tokens, payload, options) {
    return new Promise(function (resolve, reject) {
        var currPromise = clientAdmin.messaging().sendToDevice(tokens, payload, options)
            .then(function (fcmResults) {
                // See the MessagingDevicesResponse reference documentation for
                // the contents of response.
                console.log("sendPromissedPersonalizedPN: Successfully sent message:", fcmResults);
                resolve(fcmResults);
            })
            .catch(function (error) {
                console.log("sendPromissedPersonalizedPN: Error sending message:", error);
                reject(error);
            });
    });
}

// ----------------------------------------------------------------
// function: getTargetedUserBulkArray
// args: projectId, subscription, maxMessages
// return: respons Array.
// ----------------------------------------------------------------
var getTargetedUserBulkArray = function (projectId, subscription, maxMessages) {
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
                var shouldLoop = true;
                var response = responses[0];
                if (response.receivedMessages.length == 0) {
                    shouldLoop = false;
                } else {
                    shouldLoop = true;
                }
                resolve({
                    response: response,
                    shouldLoop: shouldLoop
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
var createCampaignSubscriber = function (topicName, subscriptionName) {
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
var getUsersTokensForPersonalizedCampaign = function (db, campaignDoc, usersPersonaizedPayload) {
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
var getUsersTokens = function (db, campaignDoc, users_ids) {
    return new Promise(function (resolve, reject) {
        if (users_ids.length == 0) {
            console.log("getUsersTokens: supplied users_ids is empty");
            reject(false);
        } else {
            if (campaignDoc.audience == 1) { // Cutomers

                getCustomersCampaignTokens(db, campaignDoc, users_ids)
                    .then((registration_id_tokens) => {
                        resolve(registration_id_tokens);
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
        usersCollectionName = tenantCustomersTokens + campaignDoc.tenant_id;
        var prefixDocId = "tid-" + campaignDoc.tenant_id + "-pcid-";
        var users_ids = Object.keys(usersPersonaizedPayload);
        var documentsIds = getDocumentsIdsByUsersIds(prefixDocId, users_ids, campaignDoc.audience);
        if (db != undefined) {
            try {
                var usersCollection = db.collection(usersCollectionName);
                getUsersBatchDocument(documentsIds, usersCollection)
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
        var registration_ids_tokens = undefined;
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

                            registration_ids_tokens = getTokensFromCustomerDoc(campaignDoc, result.data)
                            resolve(registration_ids_tokens);
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
var getDocumentsIdsByUsersIds = function (prefixDocId, users_ids, userType) {

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
var getUsersBatchDocument = function (documentsIds, usersCollection) {
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
// function: getTokensFromCustomerDoc
// args:campaignDoc, customersDocs
// return: the Tokens from the Customer Documents
// ----------------------------------------------------------------
var getTokensFromCustomerDoc = function (campaignDoc, customersDocs) {

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
        if (doc.opt_in == true) { // other wise we will not use tokens from this usersDocument
            if (targetedAndroidApps != undefined && doc.android_tokens != undefined) {
                // we check that there are apps targeted and that ther are exist in the current doc
                var devices = doc.android_tokens; // get the devices
                var targetedAppsObj = targetedAndroidApps; // the Android Targeted Apps by the Campaign
                registration_id_tokens = updateTokensArrayWithDevicesTokens(targetedAppsObj, devices, registration_id_tokens);
            }

            if (targetedIOSApps != undefined && doc.ios_tokens != undefined) {
                // we check that there are apps targeted and that ther are exist in the current doc
                var devices = doc.ios_tokens; // get the devices
                var targetedAppsObj = targetedAndroidApps; // the Android Targeted Apps by the Campaign
                registration_id_tokens = updateTokensArrayWithDevicesTokens(targetedAppsObj, devices, registration_id_tokens);
            }
        }

    })

    return registration_id_tokens;
}

// ----------------------------------------------------------------
// function: updateTokensArrayWithDevicesTokens
// args:targetedAppsObj, devicesIds, registration_id_tokens
// return: the Tokens from the Customer Documents
// ----------------------------------------------------------------
var updateTokensArrayWithDevicesTokens = function (targetedAppsObj, devices, registration_id_tokens) {
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
                        registration_id_tokens.push(token);
                    }
                }
            })
        })

        return registration_id_tokens;
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
                tenantCampaignsDataCollection.updateOne
                tenantCampaignsDataCollection.findOneAndUpdate({
                        _id: docId
                    }, {
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
var createPersonalizedPayload = function (campaignPayload, targetedUser) {

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
var UpdateCampaignStatus = function (db, campaignDoc, status) {

    return new Promise(function (resolve, reject) {

        var tenantId = campaignDoc.tenant_id;
        var tenantCampaignCollectionName = tenantCampaignsDataCollectionNameBase + tenantId;
        var tenantCampaignsDataCollection = db.collection(tenantCampaignCollectionName);
        var docId = campaignDoc._id;


        tenantCampaignsDataCollection.findOneAndUpdate({
                _id: docId
            }, {
                $set: {
                    "campaign_status": status
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
                reject(error);
            })
    });

}

//-----------------------------------------------------------------------------
// functions: prepareExecutionResources
// args: createReq, db, campaignDoc
// description: perpare Process Resources.
// //---------------------------------------------------------------------------
var prepareExecutionResources = function (createReq, db, campaignDoc) {
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
// functions: startExecuteCampaign
// args: db, campaignDoc, subscription, clientAdmin, options
// description: Main Process
// //---------------------------------------------------------------------------
var startExecuteCampaign = function (db, campaignDoc, subscription, clientAdmin, options) {
    return new Promise(function (resolve, reject) {
        console.log("startExecuteCampaign: Call  handleCampaignExecution : subscriptionName = " + subscription.name);
        handleCampaignExecution(db, campaignDoc, clientAdmin, options)
            .then((resultedExecutionArray) => {

                var updateMetrics = {
                    failurCount: resultedExecutionArray[0].doc.campaign_stats.successfull_push,
                    successCount: resultedExecutionArray[0].doc.campaign_stats.failed_push,
                    bulkSize: resultedExecutionArray[0].doc.campaign_stats.push_bulk_size
                }
                resultedExecutionArray.forEach((resultedExecution) => {
                    console.log("startExecuteCampaign: Succeeded Campaign Id = " + resultedExecution.doc._id)
                    console.log("startExecuteCampaign: Update  numOfUsersMessages = " + resultedExecution.numOfUsersMessages)

                })

                var result = {
                    updateMetrics: updateMetrics,
                    doc: resultedExecutionArray[0].doc
                };
                resolve(result);
            })
            .catch((error) => {
                console.log("executeCampaign: Failed " + error);
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
    var response = undefined;
    if (status == true) {
        UpdateCampaignStatus(db, updatedDoc, CampaignStatus.completed)
            .then((updatedDoc) => {
                response = createResponse(updatedDoc, updateMetrics, "completed", error);
                res.json(response);
            })
            .catch((error) => {
                response = createResponse(updatedDoc, updateMetrics, "completed", "Campaign Completed, but Failed Updating Campaign Status");
                res.status(400);
                res.json(response);
            });

    } else {
        res.status(400);
        if (db != undefined) {
            UpdateCampaignStatus(db, updatedDoc, CampaignStatus.failed)
                .then((updatedDoc) => {
                    response = createResponse(updatedDoc, updateMetrics, "failed", error);
                    res.json(response);
                })
                .catch((error) => {
                    response = createResponse(updatedDoc, updateMetrics, "failed", error);
                    res.json(response);
                });

        } else {
            response = createResponse(updatedDoc, updateMetrics, "failed", error);
        }

    }

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
    getScheduledCampaign(createReq, 10000)
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
            prepareExecutionResources(createReq, db, campaignDoc)
                .then((resources) => {
                    startExecuteCampaign(db, campaignDoc, resources.subscription, resources.clientAdmin, options)
                        .then((result) => {
                            UpdateCampaignStatusAndSendResponse(db, res, result.doc, result.updateMetrics, true, undefined);
                            cleanup(db);
                        })
                        .catch((error) => {
                            cleanup(db);
                            UpdateCampaignStatusAndSendResponse(db, res, campaignDoc, failedMetrics, false, undefined);
                        })
                })
                .catch((error) => {
                    cleanup(db);
                    UpdateCampaignStatusAndSendResponse(db, res, campaignDoc, failedMetrics, false, error);
                })
        })
        .catch(function (error) {
            console.log('getScheduledCampaign Failed');
            UpdateCampaignStatusAndSendResponse(db, res, createReq, failedMetrics, false, undefined);

        })

}