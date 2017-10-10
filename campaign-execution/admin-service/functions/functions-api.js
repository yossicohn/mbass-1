'use strict';
//const Logging = require('@google-cloud/logging');
//const logging = Logging();

var readJson = require('read-package-json');
var MongoClient = require('mongodb').MongoClient,
    assert = require('assert');
const uuidV4 = require('uuid/v4');
var url = 'mongodb://104.154.65.252:27017/mbassdb';
var tenantCampaignsDataCollectionNameBase = 'CampaignsData_';
var processTimeDelta = 30000000000 // 1/2 Minute ago.


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


var admin = require("firebase-admin");

var serviceAccount = require("../mobilesdk-master-dev-firebase-adminsdk-etwd8-bb7913dce1.json");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)

});



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

// Send a message to the device corresponding to the provided
// registration token.
    admin.messaging().sendToDevice(registrationToken, payload)
        .then(function(response) {
            // See the MessagingDevicesResponse reference documentation for
            // the contents of response.
            console.log("Successfully sent message:", response);
            var createReq = req.body;

            var errMsg = "execute:campaign not exist, please check campaign details";
            var response = createResponse(createReq, undefined, false, errMsg);
            res.json(response);
        })
        .catch(function(error) {
            console.log("Error sending message:", error);
        });



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
var getScheduledCampaign = function (tenantId, deltaFromNow) {


    MongoClient.connect(url)
        .then(function(db){
            console.log("getScheduledCampaign: Connected correctly to server");
            status = true;
            var tenantId = getCampaignData.tenant_id;
            var tenantCampaignCollectionName = tenantCampaignsDataCollectionNameBase + tenantId;
            var tenantCampaignsDataCollection = db.collection(tenantCampaignCollectionName);
            
            tenantCampaignsDataCollection.findOne({_id: docId})
                .then(function(exisitingDoc){
                    if(exisitingDoc == null){
                        cleanup(db);
                        res.status(400);
                        var errMsg = "getCampaignData:campaign not exist, please check campaign details";
                        var response = createResponse(getCampaignData, undefined, false, errMsg);
                        res.json(response);
                    }else{
                        cleanup(db);
                        exisitingDoc.command_name = "get_campaign_data";
                        delete exisitingDoc["schedule"];// we don't need this data sent
                        delete exisitingDoc["_id"]; // we don't need this data sent
                        var response = createResponse(exisitingDoc, undefined, true, errMsg);
                        res.json(response);
                    }
                })
                .catch(function(error){
                    cleanup(db);
                    var errMsg = "getCampaignData:" + tenantCampaignCollectionName +".findOne Failed " + error;
                    console.error(errMsg);
                    var response = createResponse(getCampaignData, undefined, false, errMsg);
                    res.status(400);
                    res.json(response);
                })

        })
        .catch(function(error){

            var errMsg = "getCampaignData: Connected DB Server Failed  tenantId = " + createReq.tenant_id + " visitor_id =  " + createReq.visitor_id + " " + error;
            console.error(errMsg);
            var response = createResponse(createReq, undefined, false, errMsg);
            res.status(400);
            res.json(response);
        })


}