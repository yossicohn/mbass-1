'use strict';
//const Logging = require('@google-cloud/logging');
//const logging = Logging();
var dbModule = require('./dbmodule.js');
var readJson = require('read-package-json');
var MongoClient = require('mongodb').MongoClient,
    assert = require('assert');
const uuidV4 = require('uuid/v4');
var url = 'mongodb://104.198.223.2:27017/mbassdb';

var tenantCampaignsDataCollectionNameBase = 'CampaignsData_';
var tenantCustomersTokens = 'CustomersTokens_';
var tenantVisitorsTokens = 'VisitorsTokens_';
var tenantCampaignsDataCollectionNameBase = 'CampaignsData_';

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

var serviceAccountSDKoController = require("../mobilesdk-master-dev-firebase-adminsdk-etwd8-bb7913dce1.json");
var serviceAccountAppController = require("../appcontrollerproject-developer-firebase-adminsdk-xv10y-853771a0b1.json");
admin.initializeApp({
    credential: admin.credential.cert(serviceAccountSDKoController),
    databaseURL: "https://mobilesdk-master-dev.firebaseio.com",

});
var rtDB = admin.database();



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
// functions: scheduleCampaign
// args: campaign meta data
// description:mock for the register
// format example:
// {
//     "command_name": "schedule_campaign",
//     "tenant_id": "int",
//     "campaign_id": "int",
//     "action_serial": "int",
//     "template_id": "int"
//   }
//---------------------------------------------------------------------------
exports.scheduleCampaign = function (req, res) {

    var err = undefined;
    var status = undefined;
    var createReq = req.body;
    var response;
    dbModule.getScheduledCampaign(createReq)
        .then((result) => {
            console.log(result);
        })
        .catch((error) => {
            console.log(error);
        })
    res.json(response);

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

//-----------------------------------------------------
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