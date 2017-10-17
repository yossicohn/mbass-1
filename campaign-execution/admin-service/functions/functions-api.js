'use strict';
//const Logging = require('@google-cloud/logging');
//const logging = Logging();

var readJson = require('read-package-json');
var MongoClient = require('mongodb').MongoClient,
    assert = require('assert');
const uuidV4 = require('uuid/v4');
var url = 'mongodb://104.154.65.252:27017/mbassdb';
var tenantCampaignsDataCollectionNameBase = 'CampaignsData_';
var tenantCustomersTokens = 'CustomersTokens_';
var tenantVisitorsTokens = 'VisitorsTokens_';
var tenantCampaignsDataCollectionNameBase = 'CampaignsData_';
var processTimeDelta = 30000000000 // 1/2 Minute ago.
var dataBaseClient = undefined;

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

var serviceAccount = require("../mobilesdk-master-dev-firebase-adminsdk-etwd8-bb7913dce1.json");

// admin.initializeApp({
//     credential: admin.credential.cert(serviceAccount)

// });


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


var PNPayloadTemplate = {
    "data": {
        "title": "Notification Title",
        "content": "Notification Body",
        "dynamic_links": {
            "android": {},
            "ios": {}
        },
        "campaign_id": undefined,
        "action_serial": undefined,
        "template_id": undefined,
        "engagement_id": undefined,
        "is_optipush": true
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
        dataBaseClient = undefined;
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
exports.execute = function (req, res) {

    var err = undefined;
    var status = undefined;
    var registrationToken =
        "fPjdTmIPGwU:APA91bHwAb2KqSlGKi548LVbZDXsjYE0b7Kt-mktgPJ4dcYxA2Qw4ORk30KnB-3zhdY5j5_OQ-ayKxRRZTplZ9wVoOIQtt0ezRH9EQZJTgVmK-I4qETvaY_ebRMDUfTzV9p2zIdMQOd7";
    var payload = {
        data: {
            "uiTitle": "Unique Title",
            "uiBody": "Your money in my wallet",
            "dynamicLink": "https://bw4se.app.goo.gl/59IiDJZ8YaHheku83",
            "isOptipushMessage": "true"
        }

    };
    var createReq = req.body;

    // Send a message to the device corresponding to the provided
    // registration token.
    admin.messaging().sendToDevice(registrationToken, payload)
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

// var registrationToken =
// "fPjdTmIPGwU:APA91bHwAb2KqSlGKi548LVbZDXsjYE0b7Kt-mktgPJ4dcYxA2Qw4ORk30KnB-3zhdY5j5_OQ-ayKxRRZTplZ9wVoOIQtt0ezRH9EQZJTgVmK-I4qETvaY_ebRMDUfTzV9p2zIdMQOd7";
// var payload = {
// data: {
//     "uiTitle": "Unique Title",
//     "uiBody": "Your money in my wallet",
//     "dynamicLink": "https://bw4se.app.goo.gl/59IiDJZ8YaHheku83",
//     "isOptipushMessage": "true"
// }

// };
// //---------------------------------------------------------------------------
exports.executeCampaign = function (req, res) {

    var err = undefined;
    var status = undefined;

    var createReq = req.body;
    //First we take  the Campaign from the DB.
    getScheduledCampaign(createReq, 10000)
        .then(function (campaignDoc) {
            console.log('getScheduledCampaign' + campaignDoc._id);

            //Campaign was found, now we can get build the Payload.

            var topicName = campaignDoc.data_queue_name;
            var subscriptionName = "sub_" + topicName;
            createCampaignSubscriber(topicName, subscriptionName)
                .then(() => { // new we can get the data of the Users and extract it.
                    handleCampaignExecution(campaignDoc)
                        .then(() => {
                            console.log("executeCampaign: Succeeded subscriptionName = " + subscriptionName);
                        })
                        .catch((error) => {
                            console.log("executeCampaign: Failed " + error);
                        })
                })
                .catch((error) => {
                    console.log("executeCampaign: Failed " + error);
                });

        })
        .catch(function (error) {
            console.log('getScheduledCampaign Failed');
        })

}


// ----------------------------------------------------------------------------
// ----------------------------------------------------------------
// function: createResponse
// args: createReq, pn_campaign_id, status, error
// return: response object. 
// ----------------------------------------------------------------
// {
//     "command_name": "create_campaign",
//     "tenant_id": "int",
//     "campaign_id": "int",
//     "action_serial": "int",
//     "template_id": "int",
//     "template_type": "normal|personalized",
//     "schedule": "unix epic timestamp",
//     "response_status": "scheduled/failed",
//     "pn_campaign_id": "created db id",
//     "error": "campaign already exist"
//   }
// ---------------------------------------------------------------- 
var createResponse = function (createReq, status, error) {

    var response = {
        "command_name": "execute",
        "tenant_id": createReq.tenant_id,
        "campaign_id": createReq.campaign_id,
        "action_serial": createReq.action_serial,
        "template_id": createReq.template_id,
        "response_status": "executing",

        "error": error
    };

    return response;
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
                dataBaseClient = db;
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
                            cleanup(db);
                            reject("Campaign Don't Exisit");
                        } else {
                            resolve(exisitingDoc);
                        }
                    })
                    .catch(function (errorerror) {
                        cleanup(db);
                        reject(error);
                    })
            })
            .catch(function (error) {

                eject(error);
            })
    });

}


// ----------------------------------------------------------------
// ----------------------------------------------------------------
// function: handleCampaignExecution
// args: campaignDoc
// return: response dataPayload.
// ----------------------------------------------------------------
var handleCampaignExecution = function (campaignDoc) {

    return new Promise(function (resolve, reject) {

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
                        getUsersTokens(campaignDoc, users_ids)
                            .then((tokens) => {
                                sendPromissedPN(registartion_ids, campaignPayload)
                                    .then((response) => {
                                        resolve(response);
                                    })
                                    .catch((errorResponse) => {
                                        console.log("sendPromissedPN: Failed errorResponse = " + errorResponse);
                                        reject(errorResponse);
                                    })
                            })
                            .catch((error) => {

                            })


                    })
                }

                resolve(responses.receivedMessages.length);
            })
            .catch((error) => {
                console.log("handleCampaignExecution: failed:-" + error);
                reject(error);
            });


        // var topicName = exisitingDoc.data_queue_name;
        // var subscriptionName = "subs-" + topicName;
        //
        // pubsubClient.createSubscription(topicName, name)
        //     .then(function (data) {
        //         var subscription = data[0];
        //         var apiResponse = data[1];
        //         // Create an event handler to handle messages
        //         let messageCount = 0;
        //         const messageHandler = (message) => {
        //             console.log(`Received message ${message.id}:`);
        //             console.log(`\tData: ${message.data}`);
        //             console.log(`\tAttributes: ${message.attributes}`);
        //             messageCount += 1;
        //
        //             // "Ack" (acknowledge receipt of) the message
        //             message.ack();
        //         };
        //
        //         // Listen for new messages until timeout is hit
        //         subscription.on(`message`, messageHandler);
        //     setTimeout(() => {
        //         subscription.removeListener('message', messageHandler);
        //     console.log(`${messageCount} message(s) received.`);
        // }, 1 * 1000);

        // var bulkArray = getTargetedUserBulkArray(subscription)
        //     .then(function(error){
        //         var nonPersonalizedPayload = initNonPersonalizedrDataPayload(exisitingDoc);
        //
        //     })
        //     .catch(function(error){
        //
        //
        //     })
        // })
        // .catch(function (error) {
        //
        //
        // })


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

// ----------------------------------------------------------------------------
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
//             "is_optipush": true
//         },
//         "priority": "high",
//         "content_available": true,
//         "registration_ids": [/*...*/]
// ------------------------------------------------------------------
var initNonPersonalizedrDataPayload = function (exisitingCampaignDoc) {

    var dataPayload = Object.create(PNPayloadTemplate);
    dataPayload.campaign_id = exisitingCampaignDoc.campaign_id;
    dataPayload.action_serial = exisitingCampaignDoc.action_serial;
    dataPayload.template_id = exisitingCampaignDoc.template_id;
    dataPayload.engagement_id = exisitingCampaignDoc.engagement_id;
    // Template Content
    dataPayload.title = exisitingCampaignDoc.template_data.title;
    dataPayload.content = exisitingCampaignDoc.template_data.content;
    dataPayload.dynamic_links = exisitingCampaignDoc.dynamic_links;

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
var sendPromissedPN = function (registrationTokens, payload) {
    return new Promise(function (resolve, reject) {
        admin.messaging().sendToDevice(registrationTokens, payload)
            .then(function (response) {
                // See the MessagingDevicesResponse reference documentation for
                // the contents of response.
                console.log("sendPromissedPN: Successfully sent message:", response);
                resolve(response);
            })
            .catch(function (errorResponse) {
                console.log("sendPromissedPN: Error sending message:", error);
                reject(errorResponse);
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
            timeout: 10000
        };
        var request = {
            subscription: formattedSubscription,
            maxMessages: maxMessages,
            returnImmediately: false,

        };
        client.pull(request, options)
            .then(function (responses) {
                var response = responses[0];
                resolve(response);
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
// function: getUsersTokens
// args:campaignDoc, users_ids
// return: respons registration_ids for the PN.
// We first check if subscription exist if not we failed and then we create it.
// Process:
// we need to go to the appropriate users Database (Visitors/Customers).
// And find by the ID's the different Users Document.
// Go uver the Document and in the Targeted apps (in the devices) get the appropriate tokens.
// ----------------------------------------------------------------
var getUsersTokens = function (campaignDoc, users_ids) {
    return new Promise(function (resolve, reject) {

        if (users_ids.length == 0) {
            console.log("getUsersTokens: supplied users_ids is empty");
            reject(false);
        } else {
            if (campaignDoc.audience == 1) { // Cutomers

                getCustomersCampaignTokens(campaignDoc, users_ids);
            } else if (campaignDoc.audience == 2) { // Visitors

            }

        }
    });
}


// ----------------------------------------------------------------
// function: getCustomersCampaignTokens
// args:campaignDoc, users_ids
// return: respons registration_ids for the Customers PN Campaign.
// We first check if subscription exist if not we failed and then we create it.
// Process:
// we need to go to the appropriate users Database (Visitors/Customers).
// And find by the ID's the different Users Document.
// Go over the Document and in the Targeted apps (in the devices) get the appropriate tokens.
// ----------------------------------------------------------------
var getCustomersCampaignTokens = function (campaignDoc, users_ids) {
    return new Promise(function (resolve, reject) {
        var usersCollectionName = undefined;
        usersCollectionName = tenantCustomersTokens + campaignDoc.tenant_id;
        var prefixDocId = "tid-" + campaignDoc.tenant_id + "-pcid-";
        var documentsIds = getDocumentsIdsByUsersIds(prefixDocId, users_ids, campaignDoc.audience);
        if (dataBaseClient != undefined) {
            try {
                var usersCollection = dataBaseClient.collection(usersCollectionName);
                getUsersBatchDocument(documentsIds, usersCollection)
                    .then((result) => {
                        console.log(result.status);
                        if (result.status == 1 && result.data.length > 0) {

                            getTokensFromCustomerDoc(campaignDoc, result.data)
                            resolve(result.data.length);
                        }
                    })
                    .catch((error) => {
                        console.log(result.status);
                        reject(error);
                    })

            } catch (error) {
                console.log(error);
                reject(error);
            }

        } else {
            var error = "dataBaseClient is not defined";
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



var getTokensFromCustomerDoc = function (campaignDoc, customersDocs) {

    var androidApps = undefined;
    var iosApps = undefined;
    if (campaignDoc.apps != undefined) {
        if (campaignDoc.apps.android != undefined) {
            androidApps = campaignDoc.apps.android;
        }
        if (campaignDoc.apps.ios != undefined) {
            iosApps = campaignDoc.apps.ios;
        }
    }
   
    customersDocs.forEach((doc) =>{
        if(androidApps != undefined){
            var devicesIds = Object.keys(doc.android_tokens);
            devicesIds.forEach((key) => {
                var appsKeys =  Object.keys(doc.android_tokens[key].apps);
            })
        }

        if(iosApps != undefined){
            var devicesIds = Object.keys(doc.android_tokens);
            devicesIds.forEach((key) => {
                var appsKeys =  Object.keys(doc.android_tokens[key].apps);
            })
        }
    })


}