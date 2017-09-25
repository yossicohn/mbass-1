'use strict';
const Logging = require('@google-cloud/logging');
const logging = Logging();


var MongoClient = require('mongodb').MongoClient
, assert = require('assert');
const uuidV4 = require('uuid/v4');
var url = 'mongodb://104.154.65.252:27017/mbassdb';
var tenantCampaignsDataCollectionNameBase = 'CampaignsData_';
var processTimeDelta = 30000000000 // 1/2 Minute ago.


/**
 * Report an error to StackDriver Error Reporting. Writes the minimum data
 * required for the error to be picked up by StackDriver Error Reporting.
 *
 * @param {Error} err The Error object to report.
 * @param {Function} callback Callback function.
 */
var reportError = function (err, callback) {
    // This is the name of the StackDriver log stream that will receive the log
    // entry. This name can be any valid log stream name, but must contain "err"
    // in order for the error to be picked up by StackDriver Error Reporting.
    const logName = 'errors';
    const log = logging.log(logName);
  
    const metadata = {
      // https://cloud.google.com/logging/docs/api/ref_v2beta1/rest/v2beta1/MonitoredResource
      resource: {
        type: 'client_campaign_api',
        labels: {
          function_name: 'createCampaign'
        }
      }
    };
  
    // https://cloud.google.com/error-reporting/reference/rest/v1beta1/ErrorEvent
    const errorEvent = {
      message: err.stack,
      serviceContext: {
        service: `client_campaign_api:${'createCampaign'}`,
        version: require('./package.json').version || 'unknown'
      }
    };
  
    // Write the error log entry
    log.write(log.entry(metadata, errorEvent), callback);
  }
  
 
  
// -------------------------------------- Functions -----------------------------------

 // --------------------------- Utilitu member functions -----------------------
  //-----------------------------------------------------------------------------
  // functions: cleanup
  // args: db
  // description: Clean up.
  //---------------------------------------------------------------------------
  var  cleanup = function (db){
    if(db != undefined){
        db.close();
    }
}
//-----------------------------------------------------------------------------
// functions: createCampaign
// args: campaign meta data
// description:mock for the register
// format example:
// {
//     "request": {
//      "_id" : "tid:<int>_cid:<int>_acsl:<int>_tplid:<int>",
//     "campaign_status": "scheduled/started/stopped/completed/aborted/failed",
//     "campaign_type" : "push_notification",
//     "campaign_mode" : "schedule/realtime ",
//     "target_types" : "all|ios|and|webpush",
//     "tenant_id" : "int",
//     "campaign_id" : "int",
//     "action_serial" : "int",
//     "template_id" : "int",
//     "personalized" : false,
//     "tgt_group_size" : "int",
//     "schedule" : "unix epic timestamp",
//     "time_to_live" : "X seconds",
//     "template_type" : "simple|rich",
//     "template_data" : {
//     "title" : "CustomView Text Title",
//         "content" : "1 The quick brown fox jumps over the lazy dog",
//         "type" : "simple/customView"
// },
// "dynamic_links" : {
//     "ios" : {
//         "app_ns_1" : "www.dynamiclinkns1.com",
//             "app_ns_2" : "www.dynamiclinkns2.com"
//     },
//     "android" : {
//         "app_ns_3" : "www.dynamiclinkns1.com",
//             "app_ns_4" : "www.dynamiclinkns2.com"
//     }
// }
// }
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
            var response = createResponse(createCampaignData, pn_campaign_queue_id, false, errMsg);
            res.status(400);
            res.json(response);
            return;
        }

        var validationResult = validateCreateCampaignData(createCampaignData);

        if(validationResult.status == false){

            var errMsg = "createCampaign:validateCreateCampaignData Failed " +validationResult.error;
            console.error(errMsg);
            var response = createResponse(createReq, pn_campaign_queue_id, false, errMsg);
            res.status(400);
            res.json(response);
            return;
        } 
        
        MongoClient.connect(url)
        .then(function(db){
            console.log("createCampaign: Connected correctly to server");
            status = true;           
            var tenantId = createCampaignData.tenant_id;
            var tenantCampaignCollectionName = tenantCampaignsDataCollectionNameBase + tenantId;
            var tenantCampaignsDataCollection = db.collection(tenantCampaignCollectionName);
            var docId = getDocId(createCampaignData);
            tenantCampaignsDataCollection.findOne({_id: docId})
            .then(function(exisitingDoc){
                if(exisitingDoc != undefined){
                    cleanup(db);
                    res.status(400);
                    var errMsg = "createCampaign:campaign already exist, please delete campaign";              db.close();                   
                    var response = createResponse(createCampaignData, undefined, false, errMsg);                    
                    res.json(response);
                }else{
                    handleCreateCampaign(db, tenantCampaignsDataCollection,createCampaignData, docId)
                    .then(function (doc){
                        cleanup(db);
                        var response = createResponse(createCampaignData, undefined, true, undefined);                    
                        res.json(response);
                    })
                    .catch(function(error){
                        cleanup(db);
                        res.status(400);
                        var errMsg = "createCampaign:handleCreateCampaign failed";                  
                        var response = createResponse(createCampaignData, undefined, false, errMsg);                    
                        res.json(response);

                    })
                }
               
            })
            .catch(function(error){
                cleanup(db);
                var errMsg = "createCampaign:" + tenantCampaignCollectionName +".findOne Failed " + error;                console.error(errMsg);
                var response = createResponse(createCampaignData, undefined, false, errMsg);
                res.status(400);
                res.json(response);
                return; 
            })                                          

        })
        .catch(function(error){
            
            var errMsg = "createCampaign: Connected DB Server Failed  tenantId = " + createReq.tenant_id + " visitor_id =  " + createReq.visitor_id + " " + error;
            console.error(errMsg);
            var response = createResponse(createReq, undefined, false, errMsg);
            res.status(400);
            res.json(response);
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
var createResponse = function(createReq, pn_campaign_id, status, error){

    var response = {
        "command_name": undefined,
        "tenant_id": createReq.tenant_id,
        "campaign_id": createReq.campaign_id,
        "action_serial": createReq.action_serial,
        "template_id": createReq.template_id,
        "schedule": createReq.schedule,
        "response_status": "scheduled",
        
        "error": error
      };


      switch (createReq.command_name){
        case 'create_campaign':
         response =  getCreateCampaignResponse(response, createReq, pn_campaign_id, status, error);
        break;
        case 'abort_campaign': 
        response =  getAbortCampaignResponse(response);
        break;
        case 'delete_campaign': 
        response =  getDeleteCampaignResponse(response);
        break;
        case 'reschedule_campaign': 
        response =  getRescheduleCampaignResponse(response);
        break;
        case 'stop_campaign': 
        response =  getStopCampaignResponse(response);
        break;
        case 'update_campaign': 
        response =  getUpdateCampaignResponse(response);
        break;
      }
    
      return response;

}


// ----------------------------------------------------------------
// function: getCreateCampaignResponse
// args: createReq, pn_campaign_id, status, error
// return: response object. 
// ----------------------------------------------------------------
// {
//     "command_name": "create_campaign",
//     "tenant_id": "int",
//     "campaign_id": "int",
//     "action_serial": "int",
//     "template_id": "int",
//     "personalized": "bool",
//     "template_type": "simple|rich",
//     "schedule": "unix epic timestamp",
//     "response_status": "scheduled/failed",
//     "pn_campaign_id": "created db id",
//     "error": "campaign already exist"
//   }
// ----------------------------------------------------------------
var getCreateCampaignResponse = function (response, createReq, pn_campaign_id, status, error){

    response["command_name"] = "create_campaign";
    response["personalized"]= createReq.personalized;
    if(status == true){
        response["pn_campaign_id"]= createReq.pn_campaign_id;
        response["response_status"]= "scheduled";
    }else{
        response["error"] = error;
        response["response_status"]= "failed";
    }
    
    return response;
    
}


// ----------------------------------------------------------------
// function: getAbortCampaignResponse
// args: createReq, pn_campaign_id, status, error
// return: response object. 
// ----------------------------------------------------------------
// {
//     "command_name": "abort_campaign",
//     "tenant_id": "int",
//     "campaign_id": "int",
//     "action_serial": "int",
//     "template_id": "int",
//     "response_status": "aborted/failed",
//     "error": "failed to abort campaign"
//   }  
// ---------------------------------------------------------------- 
 var getAbortCampaignResponse = function (response, createReq, status, error){
    
    response["command_name"] = "abort_campaign";
    if(status == true){
        response["response_status"]= "aborted";
    }else{
        response["error"] = error;
        response["response_status"]= "failed";
    }
    
    return response;
    
}
  

// ----------------------------------------------------------------
// function: getRescheduleCampaignResponse
// args: createReq, pn_campaign_id, status, error
// return: response object. 
// ----------------------------------------------------------------
// {
//     "command_name": "reschdule_campaign",
//      "tenant_id": 	"int",  
// 	    "campaign_id": "int",  
// 	    "action_serial": "int",
//      "template_id": 	"int",   
// 	    "response_status": "scheduled/failed",
// 	    "error": "campaign already exist"	
// }	
// ---------------------------------------------------------------- 
var getRescheduleCampaignResponse = function (response, createReq, status, error){
    
    response["command_name"] = "reschdule_campaign";
    if(status == true){
        response["response_status"]= "scheduled";
    }else{
        response["error"] = error;
        response["response_status"]= "failed";
    }
    
    return response;
    
}


// ----------------------------------------------------------------
// function: getDeleteCampaignResponse
// args: createReq, pn_campaign_id, status, error
// return: response object. 
// ----------------------------------------------------------------
// {
//     "command_name": "delete_campaign",
//     "tenant_id": "int",
//     "campaign_id": "int",
//     "action_serial": "int",
//     "template_id": "int",
//     "response_status": "deleted/failed",
//     "error": "campaign already running, please abort/campaign not exist"
//   }    
// ---------------------------------------------------------------- 
var getDeleteCampaignResponse = function (response, createReq, status, error){
    
    response["command_name"] = "delete_campaign";
    if(status == true){
        response["response_status"]= "deleted";
    }else{
        response["error"] = error;
        response["response_status"]= "failed";
    }
    
    return response;
    
}


// ----------------------------------------------------------------
// function: getStopCampaignResponse
// args: createReq, pn_campaign_id, status, error
// return: response object. 
// // ----------------------------------------------------------------
// {
//     "command_name": "stop_campaign",
//     "tenant_id": "int",
//     "campaign_id": "int",
//     "action_serial": "int",
//     "template_id": "int",
//     "response_status": "stopped/failed",
//     "error": "campaign already running, please abort/campaign not exist"
//   }  
// ---------------------------------------------------------------- 
var getStopCampaignResponse = function (response, createReq, status, error){
    
    response["command_name"] = "stop_campaign";
    if(status == true){
        response["response_status"]= "stopped";
    }else{
        response["error"] = error;
        response["response_status"]= "failed";
    }
    
    return response;
    
}


// ----------------------------------------------------------------
// function: getUpdateCampaignResponse
// args: createReq, pn_campaign_id, status, error
// return: response object. 
// // ----------------------------------------------------------------
// {
//     "command_name": "update_campaign",
//     "tenant_id": "int",
//     "campaign_id": "int",
//     "action_serial": "int",
//     "template_id": "int",
//     "response_status": "updated/failed",
//     "error": "campaign already running, please abort/campaign not exist"
//   }
// ---------------------------------------------------------------- 
var getUpdateCampaignResponse = function (response, createReq, status, error){
    
    response["command_name"] = "update_campaign";
    if(status == true){
        response["response_status"]= "updated";
    }else{
        response["error"] = error;
        response["response_status"]= "failed";
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
    
         var isValid = {
            status: true,
            error: undefined
         };

          var status = true;
          var error = "";

          if(createReq.command_name != "create_campaign")
          {
            error = "command_name should be create_campaign\n";
            status = false;
          }


          if(createReq.apps == undefined)
          {
            error = "crearte campaign should have targeted apps.\n";
            status = false;
          }else{
              var foundApp = false;
            createReq.apps.forEach(function(element) {
                foundApp = true;
            });
            if(foundApp == false){
                error = "crearte campaign should have targeted apps.\n";
                status = false;
            }
          }


          if(typeof createReq.campaign_id != "number")
          {
            error += "campaign_id should be type number\n";
            status = false;
          }else if(createReq.campaign_id <= 0){
            error += "campaign_id should be positive number\n";
            status = false;
          }

          if(typeof createReq.tenant_id != "number")
          {
            error += "tenant_id should be type number\n";
            status = false;
          }else if(createReq.tenant_id <= 0){
            error += "tenant_id should be positive number\n";
            status = false;
          }

          if(typeof createReq.action_serial != "number")
          {
            error += "action_serial should be type number\n";
            status = false;
          }else if(createReq.action_serial <= 0){
            error += "action_serial should be positive number\n";
            status = false;
          }

          if(typeof createReq.template_id != "number")
          {
            error += "template_id should be type number\n";
            status = false;
          }else if(createReq.template_id <= 0){
            error += "template_id should be positive number\n";
            status = false;
          }

          var currTime = new Date().getTime();
          if(typeof createReq.schedule != "number")
          {
            error += "template_id should be type number\n";
            status = false;
          }else if(createReq.schedule <= currTime - processTimeDelta){
            error += "schedule should be from now on to the futurer\n";
            status = false;
          }

          if(status == false){
            isValid.status = false;
            isValid.error = error;
          }
        
          return isValid;
    
    }



// ----------------------------------------------------------------
// function: getDocId
// args: request
// return: response object. 
// ----------------------------------------------------------------
//    "_id" : "tid:<int>_cid:<int>_acsl:<int>_tplid:<int>",
// example : 
// "_id": "tid:85_cid:1004_acsl:13_tplid:123"
// ---------------------------------------------------------------- 
var getDocId = function(createReq){
    var docId = "tid:" + createReq.tenant_id +
     "_cid:" + createReq.campaign_id +
     "_acsl:" + createReq.action_serial +
      "_tplid:" + createReq.template_id;
      return docId;
}
    



//-----------------------------------------------------------------------------
// functions: createCampaignDocData
// args: createReq
// return :document
// description: create Registration Data for the visitors Collection.
// {
//     "_id" : "tid:<int>_cid:<int>_acsl:<int>_tplid:<int>",
//     "campaign_status": "scheduled/started/stopped/completed/aborted/failed",
//     "campaign_type" : "push_notification",
//     "campaign_mode" : "schedule/realtime ",
//     "target_types" : "all|ios|and|webpush",
//     "tenant_id" : "int",
//     "campaign_id" : "int",
//     "action_serial" : "int",
//     "template_id" : "int",
//     "personalized" : "bool",
//     "tgt_group_size" : "int",
//     "schedule" : "unix epic timestamp",
//     "time_to_live" : "X seconds",
//     "template_type" : "simple|rich",
//     "template_data" : {
//         "title" : "CustomView Text Title",
//         "content" : "1 The quick brown fox jumps over the lazy dog",
//         "type" : "simple/customView"
//     },
//     "apps" :["app_ns_1",  "app_ns_2", "app_ns_4"],
//     "dynamic_links" : {
//         "ios" : {
//             "app_ns_1" : "www.dynamiclinkns1.com",
//             "app_ns_2" : "www.dynamiclinkns2.com"
//         },
//         "android" : {
//             "app_ns_3" : "www.dynamiclinkns1.com",
//             "app_ns_4" : "www.dynamiclinkns2.com"
//         }
//     }
// }
//---------------------------------------------------------------------------
var  createCampaignDocData = function (createReq, docId){
    
    var document = {status: true, data:undefined};

    var data =
     {
        "_id" : docId,
        "campaign_status": "scheduled",
        "campaign_type" : createReq.campaign_type,
        "campaign_mode" : createReq.campaign_mode,
        "target_types" : createReq.target_types,
        "tenant_id" : createReq.tenant_id,
        "campaign_id" : createReq.campaign_id,
        "action_serial" : createReq.action_serial,
        "template_id" : createReq.template_id,
        "personalized" : createReq.personalized,
        "apps": createReq.apps,
        "tgt_group_size" : createReq.tgt_group_size,
        "schedule" : createReq.schedule,
        "time_to_live" : createReq.time_to_live,
        "template_type" : createReq.template_type,
        "template_data" : createReq.template_data,
        "dynamic_links" :createReq.dynamic_links
     };

     document.data = data;
    return document;
}



//-----------------------------------------------------------------------------
// functions: handleCreateCampaign
// args: db, tenantCampaignsDataCollection, createReq, docId 
// return: boolean/ error
// description: create and Insert campaign document.
//---------------------------------------------------------------------------
var handleCreateCampaign = function(db, tenantCampaignsDataCollection, createReq, docId){
    
        return new Promise( function (resolve, reject) {
            var document = createCampaignDocData(createReq, docId)
            tenantCampaignsDataCollection.insertOne(document.data)
            .then(function(doc){
                resolve(doc);
            }) 
            .catch(function(error){
                reject(error);
            })    
            
        });
    }
   
    


//-----------------------------------------------------------------------------
// functions: Promise Template
// args: db, createReq, docId 
// return: boolean/ error
// description: create and Insert campaign document.
//---------------------------------------------------------------------------
var PromiseTemplate = function(db, createReq, docId){
    
        return new Promise( function (resolve, reject) {
           
                
            
        });
    }
