'use strict';

var MongoClient = require('mongodb').MongoClient
, assert = require('assert');
const uuidV4 = require('uuid/v4');
var url = 'mongodb://104.154.65.252:27017/mbassdb';
var customersRegistrationCollection = 'CustomersTokens';
var visitorsRegistrationCollection = 'VisitorsTokens';



// -------------------------------------- Functions -----------------------------------

//-----------------------------------------------------------------------------
// functions:
// args:
// description:
//---------------------------------------------------------------------------
    exports.getregisterMock = function (req, res) {

        var currUUID = uuidV4(); // -> '110ec58a-a0f2-4ac4-8393-c866d813b8d1'
        var tokenDocument = {
            "_id": "tid:1_pcid:" + currUUID,
            "tenant_id": 1,
            "public_customer_id ":  currUUID,
            "opt_in": "true",
            "is_visitor": "false",

            "android_tokens": {
                "2b14fa8b-abcf-4347-aca9-ea3e03be657e": {
                    "opt_in": "true",
                    "token": "152 Bytes",
                    "os_version": "7.002"
                },

                "3c14fa8b-abcf-4347-aca9-fg4de03be657e":{
                    "opt_in": "false",
                    "token": "152 Bytes",
                    "os_version": "7.002"
                }
            },
            "ios_tokens": {
                "opt_in": "false",
                "5b14fa8b-abcf-4347-aca9-ea3e03be657e":{
                    "token": "152 Bytes",
                    "os_version": "7.002"
                }
            }
        };

        MongoClient.connect(url)
            .then(function(db){
                console.log("Connected correctly to server");
                var collection = db.collection(customersRegistrationCollection)
                collection.insertOne(tokenDocument).then(function(r) {
                    console.log("Insert One correctly to server");
                    db.close();
                    response.send("registerDeviceTokenMocPrimised: Connected succeeded " );
                })
                    .catch(function(error){
                        cleanup(db);
                        console.error("InsertOne  DB Server Failed");
                        response.send("registerDeviceTokenMocPrimised: Connected Failed Exiting  " );

                    })

            })
            .catch(function(error){
                console.error("Connected DB Server Failed");
                response.send("registerDeviceTokenMocPrimised: Connected Failed Exiting  " );

            })
    };

//-----------------------------------------------------------------------------
// functions: createCampaign
// args: campaign meta data
// description:mock for the register
// format example:
// {
//     "request": {
//       "command_name": "create_campaign",
//       "campaign_type": "push_notification",
//       "campaign_mode": "schedule/realtime ",
//       "target_types": "all|ios|and|webpush",
//       "tenant_id": "int",
//       "campaign_id": "int",
//       "action_serial": "int",
//       "template_id": "int",
//       "tgt_group_size": "int",
//       "schedule": "unix epic timestamp",
//       "time_to_live": "X seconds",
//       "template_type": "normal|personalized",
//       "template_data": {
//         "title": "CustomView Text Title",
//         "content": "1 The quick brown fox jumps over the lazy dog",
//         "type": "simple/customView"
//       },
//       "dynamic_links": {
//         "ios": {
//           "app_ns_1": "www.dynamiclinkns1.com",
//           "app_ns_2": "www.dynamiclinkns2.com"
//         },
//         "android": {
//           "app_ns_3": "www.dynamiclinkns1.com",
//           "app_ns_4": "www.dynamiclinkns2.com"
//         }
//       }
//     }
//   }
//---------------------------------------------------------------------------
exports.createCampaign = function (req, res){
    
        var err = undefined;
        var status = undefined;


        var createReq = req.body;
        var createCampaignData = createReq.request;
        var pn_campaign_queue_id = undefined;
        if(createReq == undefined)
        {

            var errMsg = "createCampaign:createReq is missing data Failed !!!";
            console.error(errMsg);
            var response = createVisitorOptInOutResponse(createCampaignData, pn_campaign_queue_id, false, errMsg);
            res.status(400);
            res.json(response);
            return;
        }

        var validationResult = validateCreateCampaignData(createCampaignData);
        var validationResult = {status: true};

        if(validationResult.status == false){

            var errMsg = "createCampaign:validateCustomerOptInOutData Failed " +validationResult.error;
            console.error(errMsg);
            var response = createVisitorOptInOutResponse(createReq, pn_campaign_queue_id, false, errMsg);
            res.status(400);
            res.json(response);
            return;
        }

        var registrationCollectionName = visitorsRegistrationCollection  + '_' + createReq.tenant_id;
        
        MongoClient.connect(url)
        .then(function(db){
            console.log("createCampaign: Connected correctly to server");
            status = true;           
            var tenantId = createReq.tenant_id;
            var visitorsRegistrationCollection = db.collection(registrationCollectionName);
            var docId = "tid:" + createReq.tenant_id + "_vid:" + createReq.visitor_id;
            visitorsRegistrationCollection.findOne({_id: docId})
            .then(function(exisitingDoc){
                handleOptInOutUpdate(db, visitorsRegistrationCollection, docId, exisitingDoc, opt_mode, createReq)
                .then(function(exisitingDoc){
                    db.close();                   
                    var response = createVisitorOptInOutResponse(createReq, opt_mode, true, errMsg);                    
                    res.json(response);
                })
                .catch(function(error){
                    var errMsg = "createCampaign:handleOptInOutUpdate Failed " + error;
                    console.error(errMsg);
                    var response = createVisitorOptInOutResponse(createReq, opt_mode, false, errMsg);
                    res.status(400);
                    res.json(response);
                    return;
                })
            })
            .catch(function(error){
                cleanup(db);
                var errMsg = "createCampaign:customerRegistrationCollection.findOne Failed " + error;
                console.error(errMsg);
                var response = createVisitorOptInOutResponse(createReq, opt_mode, false, errMsg);
                res.status(400);
                res.json(response);
                return; 
            })                                          

        })
        .catch(function(error){
            
            var errMsg = "createCampaign: Connected DB Server Failed  tenantId = " + createReq.tenant_id + " visitor_id =  " + createReq.visitor_id + " " + error;
            console.error(errMsg);
            var response = createVisitorOptInOutResponse(createReq, opt_mode, false, errMsg);
            res.status(400);
            res.json(response);
        })         
   
}
    

// ----------------------------------------------------------------------------
// ----------------------------------------------------------------
// function: createVisitorOptInOutResponse
// args: createReq, pn_campaign_id, status, error
// return: response object. 
// ----------------------------------------------------------------
// {
//     "command_name": "create-campaign",
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
var createVisitorOptInOutResponse = function(createReq, pn_campaign_id, status, error){

    var response = {
        "command_name": "create-campaign",
        "tenant_id": createReq.tenant_id,
        "campaign_id": createReq.campaign_id,
        "action_serial": createReq.action_serial,
        "template_id": createReq.template_id,
        "schedule": createReq.schedule,
        "response_status": "scheduled",
        "pn_campaign_id": pn_campaign_id,
        "error": error
      };

      if(status == false){
        response.response_status = "failed";
      }
    
      return response;

}


// ----------------------------------------------------------------
// function: validateCreateCampaignData
// args: create campaign request
// return: response object. 
// ----------------------------------------------------------------
// {
//     "command_name": "create-campaign",
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
 var validateCreateCampaignData = function(createReq){
    
        var response = {
            "command_name": "create-campaign",
            "tenant_id": createReq.tenant_id,
            "campaign_id": createReq.campaign_id,
            "action_serial": createReq.action_serial,
            "template_id": createReq.template_id,
            "schedule": createReq.schedule,
            "response_status": "scheduled",
            "pn_campaign_id": pn_campaign_id,
            "error": error
          };
    
          if(status == false){
            response.response_status = "failed";
          }
        
          return response;
    
    }