'use strict';
//const Logging = require('@google-cloud/logging');
//const logging = Logging();
var dbModule = require("./dbmodule.js");
var pubsubUtil = require("./pubsub.js");
var utils = require("./general-utils.js");
var tokenUtils = require("./tokens-utils.js");
var sleep = require('sleep');
var readJson = require('read-package-json');

const gcpProjectId = 'mobilepush-161510';

var CampaignStatus = {
    scheduled: 1,
    started: 2,
    halted: 3,
    completed: 4,
    aborted: 5,
    deleted: 6,
    failed: 7
};


var failedMetrics = {
    failureCount: -1,
    successCount: -1,
    bulkSize: -1
};


// -------------------------------------- Functions -----------------------------------

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
        pubsubUtil.getTargetedUserBulkArray(subscription, 10)
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
// function: processNonPersonalizedCampaignExecution
// args: db, campaignDoc, clientAdmin, options
// return: results of the Execution:
// ----------------------------------------------------------------
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
// function: processPersonalizedCampaignExecution
// args: db, campaignDoc, clientAdmin,options
// return: response dataPayload.
// ----------------------------------------------------------------
var processPersonalizedCampaignExecution = function (db, campaignDoc, clientAdmin, options) {

    return new Promise(function (resolve, reject) {

        var topicName = campaignDoc.data_queue_name;
        var subscription = "sub_" + topicName;
        pubsubUtil.getTargetedUserBulkArray(subscription, 10)
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
                    dbModule.cleanup(db);
                    response = utils.createResponse(updatedDoc, updateMetrics, "completed", error);
                    res.json(response);

                })
                .catch((error) => {
                    dbModule.cleanup(db);
                    response = utils.createResponse(updatedDoc, updateMetrics, "completed", "Campaign Completed, but Failed Updating Campaign Status");
                    res.status(400);
                    res.json(response);

                });

        } else {
            res.status(400);
            if (db != undefined && db != undefined) {
                dbModule.UpdateCampaignStatus(db, updatedDoc, CampaignStatus.failed)
                    .then((updatedDoc) => {
                        dbModule.cleanup(db);
                        response = utils.createResponse(updatedDoc, updateMetrics, "failed", error);
                        res.json(response);
                    })
                    .catch((error) => {
                        dbModule.cleanup(db);
                        response = utils.createResponse(updatedDoc, updateMetrics, "failed", error);
                        res.json(response);
                    });

            } else {
                response = utils.createResponse(updatedDoc, updateMetrics, "failed", error);
                res.json(response);
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
    pubsubUtil.setProjectId(gcpProjectId);
    var db = undefined;
    //First we take  the Campaign from the DB.
    dbModule.getScheduledCampaign(createReq, 10000)
        .then(function (result) {
            db = result.db;
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