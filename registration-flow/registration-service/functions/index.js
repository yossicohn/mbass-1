//const functions = require('firebase-functions');

// // Create and Deploy Your First Cloud Functions
// // https://firebase.google.com/docs/functions/write-firebase-functions
//
// exports.helloWorld = functions.https.onRequest((request, response) => {
//  response.send("Hello from Firebase!");
// });


const Logging = require('@google-cloud/logging');
var functions = require('firebase-functions');

// Instantiates a client
const logging = Logging();


var MongoClient = require('mongodb').MongoClient
  , assert = require('assert');
const uuidV4 = require('uuid/v4');
var url = 'mongodb://104.154.65.252:27017/mbassdb';
var registrationCollection = 'CustomersTokens';

var customersRegistrationCollection = 'CustomersTokens';
var visitorsRegistrationCollection = 'VisitorsTokens';



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
      type: 'cloud_function',
      labels: {
        function_name: 'registerDeviceToken'
      }
    }
  };

  // https://cloud.google.com/error-reporting/reference/rest/v1beta1/ErrorEvent
  const errorEvent = {
    message: err.stack,
    serviceContext: {
      service: `cloud_function:${'registerDeviceToken'}`,
      version: require('./package.json').version || 'unknown'
    }
  };

  // Write the error log entry
  log.write(log.entry(metadata, errorEvent), callback);
}

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
// functions: removeDeviceAndUpdateExistingDocument
// args: db, registrationCollection, registration_data, existingDocument, docId 
// return: boolean
// description: update customer document.
//---------------------------------------------------------------------------
var removeDeviceAndUpdateExistingDocument = function(db, registrationCollection, unregistration_data, existingDocument, docId ){
    
return new Promise( function (resolve, reject) {
    var groupType = -1;
    if(unregistration_data.android_token != undefined){
        groupType = 1;
        var deviceGroup = unregistration_data.android_token;
    }else{
        groupType = 2;
        deviceGroup = unregistration_data.ios_token;
    }

    var deviceId = deviceGroup.device_id;

    var needUpdated=false;
    if(groupType == 1){//android
        delete existingDocument.android_tokens[deviceId];
        needUpdated = true;

    }else if(groupType == 2){ //ios
        existingDocument.ios_tokens[deviceId] = undefined;
        needUpdated = true;
    }

    if(needUpdated == true){
        updateDocumentOptInStatus(existingDocument);
        registrationCollection.update({_id: docId}, existingDocument)
        .then(function(status){
            resolve(true);
        })
        .catch(function(error){
            reject(false);
        })
    }else{
        reject(false);
    }
    
});
}
//-----------------------------------------------------------------------------
// functions: findAndDeletExistDocument
// args: db, registrationCollection, tenantId, orig_visitor_id
// description: find and delete document visitor.
//---------------------------------------------------------------------------
var findAndDeletExistDocument = function(db, registrationCollection, tenantId, orig_visitor_id ){

return new Promise( function (resolve, reject) {
    var id = "tid:" + tenantId + "_vid:" + orig_visitor_id;
    registrationCollection.findOneAndDelete({"_id": id}).then(function (foundDocument) {
        resolve(true);
    }).catch(function (error) {
        console.error("findAndDeletExistDocument:  Failed Deletion - " + {_id: id});
        reject(false);
    });
});

}


//-----------------------------------------------------------------------------
// functions: checkDeviceIdExisitinData
// args: devicegroup
// description: validate register data.
//---------------------------------------------------------------------------
var checkDeviceIdExisitinData = function (devicegroup){

    var status = false;
    if(devicegroup != undefined){
        var deviceId =  Object.keys(devicegroup)[0];

        if(deviceId == undefined || devicegroup[deviceId] == undefined){
                var err = 'checkDeviceIdExisitinData: registration_data device is missing';
                console.error(err);
        
                status = false;
        }else{
            status = true;
        }
        return status;
        }
}
    

exports.registerDeviceTokenMoc = functions.https.onRequest((request, response) => {
    
// Use connect method to connect to the Server 
  MongoClient.connect(url, function(err, db) {
  if(err == undefined )
  {
        var collection = db.collection(registrationCollection);
        var currUUID = uuidV4(); // -> '110ec58a-a0f2-4ac4-8393-c866d813b8d1' 
        console.log("Connected correctly to server");
        // var tokenDocument = [{
        //     "_id" : "tic:85_pci:" + currUUID,
        //     "tenant_id" : 85,
        //     "public_customer_id" : currUUID,
        //     "android_tokens" : [ 
        //         {
        //             "device_id" : "2b14fa8b-abcf-4347-aca9-ea3e03be657e",
        //             "token" : "152 Bytes",
        //             "os_version" : "7.002"
        //         }
        //     ]
        // }];

        var tokenDocument = [{
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
        }];

        collection.insert(tokenDocument);
        db.close();
        response.send("Connected succeeded");
    }     
    else{

        console.error("Connected err ", err);
        response.send("Connected err");

        }
    
    });
})


// ----------------------------------- Opt In Out Protocol ---------------------------------------------

//-----------------------------------------------------------------------------
// functions: opt_in_out_visitor(optinoutvisitor)
// args: register device/user data in the body
// description:mock for the register
// format example:
// {
//     "opt_in": {
//         "tenant_id": 85,
//         "visitor_id": "32862a06-cdfd-4f75-ace4-a721aea02c98",,        
//         "ios_token\": {
//             "device_id": "5b14fa8b-abdd-4347-aca9-ea3e03be657e"                        
//         }
//     }
//  }
//---------------------------------------------------------------------------
exports.opt_in_out_visitor = functions.https.onRequest((req, res) => {
    
    var err = undefined;
    var status = undefined;


    var registerReq = req.body;
    var opt_mode = undefined;
    var opt_request = undefined;
    if(registerReq.opt_out != undefined){
        opt_mode = false;
        opt_request = registerReq.opt_out;
    }else  if(registerReq.opt_in != undefined){
        opt_mode = true;
        opt_request = registerReq.opt_in;
    }               

    if(opt_request == undefined)
    {

        var errMsg = "opt_in_out_visitor:opt_request is missing data Failed !!!";
        console.error(errMsg);
        var response = createVisitorOptInOutResponse(opt_request, opt_mode, false, errMsg);
        res.status(400);
        res.json(response);
        return;
    }

    //var validationResult = validateCustomerOptInOutData(registration_data);
    var validationResult = {status: true};

    if(validationResult.status == false){

        var errMsg = "opt_in_out_visitor:validateCustomerOptInOutData Failed " +validationResult.error;
        console.error(errMsg);
        var response = createVisitorOptInOutResponse(opt_request, opt_mode, false, errMsg);
        res.status(400);
        res.json(response);
        return;
    }

    var registrationCollectionName = visitorsRegistrationCollection  + '_' + opt_request.tenant_id;
    
    MongoClient.connect(url)
    .then(function(db){
        console.log("opt_in_out_visitor: Connected correctly to server");
        status = true;           
        var tenantId = opt_request.tenant_id;
        var visitorsRegistrationCollection = db.collection(registrationCollectionName);
        var docId = "tid:" + opt_request.tenant_id + "_vid:" + opt_request.visitor_id;
        visitorsRegistrationCollection.findOne({_id: docId})
        .then(function(exisitingDoc){
            handleOptInOutUpdate(db, visitorsRegistrationCollection, docId, exisitingDoc, opt_mode, opt_request)
            .then(function(exisitingDoc){
                db.close();                   
                var response = createVisitorOptInOutResponse(opt_request, opt_mode, true, errMsg);                    
                res.json(response);
            })
            .catch(function(error){
                var errMsg = "opt_in_out_visitor:handleOptInOutUpdate Failed " + error;
                console.error(errMsg);
                var response = createVisitorOptInOutResponse(opt_request, opt_mode, false, errMsg);
                res.status(400);
                res.json(response);
                return;
            })
        })
        .catch(function(error){
            cleanup(db);
            var errMsg = "opt_in_out_visitor:customerRegistrationCollection.findOne Failed " + error;
            console.error(errMsg);
            var response = createVisitorOptInOutResponse(opt_request, opt_mode, false, errMsg);
            res.status(400);
            res.json(response);
            return; 
        })                                          

    })
    .catch(function(error){
        
        var errMsg = "opt_in_out_visitor: Connected DB Server Failed  tenantId = " + opt_request.tenant_id + " visitor_id =  " + opt_request.visitor_id + " " + error;
        console.error(errMsg);
        var response = createVisitorOptInOutResponse(opt_request, opt_mode, false, errMsg);
        res.status(400);
        res.json(response);
    })         
   
})


//-----------------------------------------------------------------------------
// functions: opt_in_out_customer
// args: register device/user data in the body
// description:mock for the register
// format example:
// {
//     "opt_in": {
//         "tenant_id": 85,
//         "public_customer_id": "32862a06-cdfd-4f75-ace4-a721aea02c98",,        
//         "ios_token\": {
//             "device_id": "5b14fa8b-abdd-4347-aca9-ea3e03be657e"                        
//         }
//     }
//  }
//---------------------------------------------------------------------------
exports.opt_in_out_customer = functions.https.onRequest((req, res) => {
    
    var err = undefined;
    var status = undefined;


    var registerReq = req.body;
    var opt_mode = undefined;
    var opt_request = undefined;
    if(registerReq.opt_out != undefined){
        opt_mode = false;
        opt_request = registerReq.opt_out;
    }else  if(registerReq.opt_in != undefined){
        opt_mode = true;
        opt_request = registerReq.opt_in;
    }               

    if(opt_request == undefined)
    {

        var errMsg = "opt_in_out_customer:opt_request is missing data Failed !!!";
        console.error(errMsg);
        var response = createCustomerOptInOutResponse(opt_request, opt_mode, false, errMsg);
        res.status(400);
        res.json(response);
        return;
    }

    //var validationResult = validateCustomerOptInOutData(registration_data);
    var validationResult = {status: true};

    
    if(validationResult.status == false){

        var errMsg = "opt_in_out_customer:validateCustomerOptInOutData Failed " +validationResult.error;
        console.error(errMsg);
        var response = createCustomerOptInOutResponse(opt_request, opt_mode, false, errMsg);
        res.status(400);
        res.json(response);
        return;
    }

    var registrationCollectionName = customersRegistrationCollection  + '_' + opt_request.tenant_id;
    
    MongoClient.connect(url)
    .then(function(db){
        console.log("opt_in_out_visitor:Connected correctly to server");
        status = true;           
        var tenantId = opt_request.tenant_id;
        var customerRegistrationCollection = db.collection(registrationCollectionName);
        var docId = "tid:" + opt_request.tenant_id + "_pcid:" + opt_request.public_customer_id;
        customerRegistrationCollection.findOne({_id: docId})
        .then(function(exisitingDoc){
            handleOptInOutUpdate(db, customerRegistrationCollection, docId, exisitingDoc, opt_mode, opt_request)
            .then(function(exisitingDoc){
                db.close();                   
                var response = createCustomerOptInOutResponse(opt_request, opt_mode, true, errMsg);                    
                res.json(response);
            })
            .catch(function(error){
                var errMsg = "opt_in_out_customer:handleOptInOutUpdate Failed " + error;
                console.error(errMsg);
                var response = createCustomerOptInOutResponse(opt_request, opt_mode, false, errMsg);
                res.status(400);
                res.json(response);
                return;
            })
        })
        .catch(function(error){
            cleanup(db);
            var errMsg = "opt_in_out_customer: customerRegistrationCollection.findOne Failed " + error;
            console.error(errMsg);
            var response = createCustomerOptInOutResponse(opt_request, opt_mode, false, errMsg);
            res.status(400);
            res.json(response);
            return; 
        })                                          

    })
    .catch(function(error){
        
            var errMsg = "opt_in_out_customer: Connected DB Server Failed  tenantId = " + opt_request.tenant_id + " public_customer_id =  " + opt_request.public_customer_id + " " + error;
            console.error(errMsg);
            var response = createCustomerOptInOutResponse(opt_request, opt_mode, false, errMsg);
            res.status(400);
            res.json(response);
    })
})

//-----------------------------------------------------------------------------
// functions: handleOptInOutUpdate
// args: db, exisitingDoc, opt_mode, opt_request 
// description: update the Customer document for opt in/out.
//---------------------------------------------------------------------------
var handleOptInOutUpdate = function(db, registrationCollection, docId,existingDocument, opt_mode, opt_request){
    return new Promise( function (resolve, reject) {
        var deviceGroup = undefined;
        var needUpdated = false;
        var devicePlatform = -1;
        var updatedDeviceId = undefined; 
        var existsingDeviceGroup = undefined;

        if(opt_request.ios_token != undefined){
                updatedDeviceId = opt_request.ios_token.device_id;
                devicePlatform = 2;
            }else if(opt_request.android_token != undefined){
                updatedDeviceId = opt_request.android_token.device_id;
                devicePlatform = 1;
            }
            
        if(devicePlatform == 1){
            if(existingDocument.android_tokens != undefined && Object.keys(existingDocument.android_tokens)[0] != undefined){        
                existsingDeviceGroup = existingDocument.android_tokens[updatedDeviceId];
                needUpdated = true                           
            }else{
                reject("No existsingDeviceGroup");
            }
        }else if (devicePlatform == 2){
            if(existingDocument.ios_tokens != undefined && Object.keys(existingDocument.ios_tokens)[0] != undefined){        
                existsingDeviceGroup = existingDocument.ios_tokens[updatedDeviceId];
                needUpdated = true;
            }else{
                reject("No existsingDeviceGroup");
            }
        }           

        if(needUpdated == true){           
            existsingDeviceGroup.opt_in = opt_mode;
            if(opt_mode == false){
                updateDocumentOptInStatus(existingDocument);
            }else{
                existingDocument.opt_in = true;
            }
            registrationCollection.update({_id: docId}, existingDocument)
            .then(function(status){
                resolve(true);
            })
            .catch(function(error){
                reject(error);
            })
        }else{
            reject(false);
        }
    });
}


//-----------------------------------------------------------------------------
// functions: updateDocumentOptInStatus
// args: existingDocument
// description: update the general optin status.
// Go over all the opt-in keys if all are false set the root optin key to false.
// if one is true then root should be true.
//---------------------------------------------------------------------------
var updateDocumentOptInStatus = function (existingDocument){

    var opt_in = false;
    var androidDeviceGroup = existingDocument.android_tokens;
    var iosDeviceGroup = existingDocument.ios_tokens;    
    if(androidDeviceGroup != undefined){
        var androidKeys = Object.keys(androidDeviceGroup);
        if(androidKeys[0] != undefined){               
            androidKeys.forEach(function(key){
                if(androidDeviceGroup[key].opt_in == true){
                    existingDocument.opt_in = true;
                    return;
                }
            })
        }

    }
        
    if(iosDeviceGroup != undefined){
        var iosKeys = Object.keys(iosDeviceGroup);
        if(iosKeys[0] != undefined){               
            iosKeys.forEach(function(key){
                if(iosDeviceGroup[key].opt_in == true){
                    existingDocument.opt_in = true;
                    return;
                }
            })
        }
    }
    existingDocument.opt_in = false;

}

//-----------------------------------------------------------------------------
// functions: createCustomerOptInOutResponse
// args: opt_data, opt_mode, opt_status, error
// description: create optinout response for the  registration request.
// {
//     "unregistration_status": {
//     "tenant_id": "85",
//         "public_customer_id": "eb3b6e8b-97b3-47fe-9d05-3b134e7e040f",
//         “success_status”:  true
// }
//---------------------------------------------------------------------------
var  createCustomerOptInOutResponse = function (opt_data, opt_mode, opt_status, error){
    
    var response_status = undefined;
    var opt_out_status_response = {

        "opt-out_status": {
            "tenant_id": opt_data.tenant_id,
            "public_customer_id": opt_data.public_customer_id,
            "device_id": opt_data.device_id,
            "success_status": opt_status
        }
    };

    var opt_in_status_response = {
        
                "opt_in_status": {
                    "tenant_id": opt_data.tenant_id,
                    "public_customer_id": opt_data.public_customer_id,
                    "device_id": opt_data.device_id,
                    "success_status": opt_status
                }
            };
    

    if(opt_mode == false) {//opt_out
        response_status= opt_out_status_response;
    } else if(opt_mode == true){//opt_in
        response_status= opt_in_status_response;
    }

    if(error != undefined){
        response_status.error = error;
    }
    
    return response_status;
}


//-----------------------------------------------------------------------------
// functions: createVisitorOptInOutResponse
// args: opt_data, opt_mode, opt_status, error
// description: create optinout response for the  registration request.
// {
//     "unregistration_status": {
//     "tenant_id": "85",
//         "visitor_id": "eb3b6e8b-97b3-47fe-9d05-3b134e7e040f",
//         “success_status”:  true
// }
//---------------------------------------------------------------------------
var  createVisitorOptInOutResponse = function (opt_data, opt_mode, opt_status, error){
    
    var response_status = undefined;
    var opt_out_status_response = {

        "opt-out_status": {
            "tenant_id": opt_data.tenant_id,
            "visitor_id": opt_data.public_customer_id,
            "device_id": opt_data.device_id,
            "success_status": opt_status
        }
    };

    var opt_in_status_response = {
        
                "opt_in_status": {
                    "tenant_id": opt_data.tenant_id,
                    "visitor_id": opt_data.public_customer_id,
                    "device_id": opt_data.device_id,
                    "success_status": opt_status
                }
            };
    

    if(opt_mode == false) {//opt_out
        response_status= opt_out_status_response;
    } else if(opt_mode == true){//opt_in
        response_status= opt_in_status_response;
    }

    if(error != undefined){
        response_status.error = error;
    }
    
    return response_status;
    }
// ----------------------------------- End Opt/In Out Protocol ---------------------------------------------

// -----------------------------------  Register/unRegister Customer Protocol ---------------------------------------------

 //-----------------------------------------------------------------------------
// functions: register_customer
// args: register device/user data in the body
// description:mock for the register
// format example:
// {
//     "_id": "tid:1_pcid:" + currUUID,
//     "tenant_id": 1,
//     "public_customer_id ":  currUUID,
//     "opt_in": "true",
//     "is_visitor": "false",
//      "is_conversion": "false"
//      "orig_visitor_id": "eb3b6e8b-97b3-47fe-9d05-3b134e7e040f",
//
//     "android_tokens": {
//     "2b14fa8b-abcf-4347-aca9-ea3e03be657e": {
//         "opt_in": "true",
//             "token": "152 Bytes",
//             "os_version": "7.002"
//     }
// }
//---------------------------------------------------------------------------
exports.register_customer =  functions.https.onRequest((req, res) => {
    
        var err = undefined;
        var status = undefined;
    
    
        var registerReq = req.body;
        var registration_data = registerReq.registration_data;
    
    
        if(registration_data == undefined)
        {
    
            var errMsg = "register_customer:registration_data is missing Failed !!!";
            console.error(errMsg);
            var response = createCustomerRegisterResponse(registration_data, false, errMsg);
            res.status(400);
            res.json(response);
            return;
        }
    
        var validationResult = validateCustomerRegistrationData(registration_data);
        if(validationResult.status == false){
    
            var errMsg = "register_customer:validateCustomerRegistrationData Failed " +validationResult.error;
            console.error(errMsg);
            var response = createCustomerRegisterResponse(registration_data, false, errMsg);
            res.status(400);
            res.json(response);
            return;
        }
    
        var registrationCollectionName = customersRegistrationCollection  + '_' + registration_data.tenant_id;
        var visitorsRegistrationCollectionName = visitorsRegistrationCollection  + '_' + registration_data.tenant_id;
    
        MongoClient.connect(url)
            .then(function(db){
                console.log("register_customer: Connected correctly to server");
                status = true;
    
                var orig_visitor_id = registration_data.visitor_id;
                var tenantId = registration_data.tenant_id;
    
                var customerRegistrationCollection = db.collection(registrationCollectionName);
                
                // check scenario:
                // 1. Is this Conversion of the visitor or update ==> new Customer Document
                // 2. is this an update of existing Customer ==> update Customer Document
                 
                handleCustomerRegistration (db, customerRegistrationCollection, registration_data )
                .then(function (status){
                    if(registration_data.is_conversion == true){ //Use Case 1 remove the Visitor Document
                        
                        // check if customer already exist
                            var visitorsRegistrationCollection = db.collection(visitorsRegistrationCollectionName);
                            status = findAndDeletExistDocument(db, visitorsRegistrationCollection, tenantId, orig_visitor_id )
                            .then(function (status){
                                console.log("register_customer: findAndDeletExistDocument() removed visitor = " + tenantId + " orig_visitor_id =  " + orig_visitor_id );
                            }).catch(function(error){
    
                                cleanup(db);
                                console.error("register_customer: findAndDeletExistDocument() Failed");
                                var errMsg = "register_customer: findAndDeletExistDocument() Failed tenantId = " + tenantId + " orig_visitor_id =  " + orig_visitor_id + " " + error;
                                console.error(errMsg);
                                var response = createCustomerRegisterResponse(registration_data, false, errMsg);
                                res.status(400);
                                res.json(response);
                               
                                return;
            
                            })
                        }
                    db.close();
                    var response = createCustomerRegisterResponse(registration_data, true, undefined);
                    res.json(response);
    
                })
                .catch(function(error){
                    cleanup(db);
                    console.error("register_customer() Failed");
                    var errMsg = "register_customer: handleCustomerRegistration() Failed tenantId = " + tenantId + " orig_visitor_id =  " + orig_visitor_id + " " + error;
                    console.error(errMsg);
                    var response = createCustomerRegisterResponse(registration_data, false, errMsg);
                    res.status(400);
                    res.json(response);
    
                })  
               
        })
        .catch(function(error){
            cleanup(db);
            var errMsg = "register_customer: Connected DB Server Failed  tenantId = " + tenantId + " orig_visitor_id =  " + orig_visitor_id + " " + error;
            console.error(errMsg);
            var response = createCustomerRegisterResponse(registration_data, false, errMsg);
            res.status(400);
            res.json(response);
    
    
        })
    })
    
    
//-----------------------------------------------------------------------------
// functions: unregister_customer
// args: register device/user data in the body
// description:mock for the register
// format example:
// {
    
//     "unregistration_data": {
//         "tenant_id": "85",
//         "public_customer_id": "eb3b6e8b-97b3-47fe-9d05-3b134e7e040f",         
//         "android_token": {
//             “device_id”: "2b14fa8b-abcf-4347-aca9-ea3e03be657e"                  
//         }
//     }
// }
//---------------------------------------------------------------------------
exports.unregister_customer = functions.https.onRequest((req, res) => {
    
    var err = undefined;
    var status = undefined;


    var registerReq = req.body;
    var unregistration_data = registerReq.unregistration_data;


    if(unregistration_data == undefined)
    {

        var errMsg = "unregister_customer:unregistration_data is missing Failed !!!";
        console.error(errMsg);
        var response = createCustomerRegisterResponse(registration_data, false, errMsg);
        res.status(400);
        res.json(response);
        return;
    }

    var validationResult = validateCustomerUnRegistrationData(unregistration_data);
    if(validationResult.status == false){

        var errMsg = "unregister_customer:validateCustomerUnRegistrationData Failed " +validationResult.error;
        console.error(errMsg);
        var response = createCustomerUnRegisterResponse(unregistration_data, false, errMsg);
        res.status(400);
        res.json(response);
        return;
    }

    var registrationCollectionName = customersRegistrationCollection  + '_' + unregistration_data.tenant_id;
    
    MongoClient.connect(url)
        .then(function(db){
            console.log("unregister_customer: Connected correctly to server");
            status = true;

            
            var public_customer_id = unregistration_data.public_customer_id;
            var tenantId = unregistration_data.tenant_id;

            var customerRegistrationCollection = db.collection(registrationCollectionName);
            
            // check scenario:
            // 1. Is this Conversion of the visitor or update ==> new Customer Document
            // 2. is this an update of existing Customer ==> update Customer Document
                
            handleCustomerUnRegistration (db, customerRegistrationCollection, unregistration_data )
            .then(function (status){
                
                db.close();
                var response = createCustomerUnRegisterResponse(unregistration_data, true, undefined);
                res.json(response);

            })
            .catch(function(error){
                cleanup(db);
                console.error("unregister_customer() Failed");
                var errMsg = "unregister_customer: handleCustomerRegistration() Failed tenantId = " + tenantId + " public_customer_id =  " + public_customer_id + " " + error;
                console.error(errMsg);
                var response = createCustomerRegisterResponse(unregistration_data, false, errMsg);
                res.status(400);
                res.json(response);

            })  
            
    })
    .catch(function(error){
        cleanup(db);
        var errMsg = "unregister_customer: Connected DB Server Failed  tenantId = " + tenantId + " public_customer_id =  " + public_customer_id + " " + error;
        console.error(errMsg);
        var response = createCustomerRegisterResponse(unregistration_data, false, errMsg);
        res.status(400);
        res.json(response);

    })
})

    
        

//-----------------------------------------------------------------------------
// functions: createCustomerRegisterResponse
// args: registration_data, registration_status, error
// description: create Registration response for the  registration request.
// {
//
//     "registration_status": {
//     "tenant_id": "85",
//         "public_customer_id": "eb3b6e8b-97b3-47fe-9d05-3b134e7e040f",
//         “success_status”:  true
// }
//
// }
//---------------------------------------------------------------------------
var  createCustomerRegisterResponse = function (registration_data, registration_status, error){
    
        var registration_response = {
    
            "registration_status": {
                "tenant_id": registration_data.tenant_id,
                "public_customer_id": registration_data.public_customer_id,
                "success_status": registration_status
            }
        };
    
        if(error != undefined){
            registration_response.registration_status.error = error;
        }
    
        return registration_response;
    }
    
    
//-----------------------------------------------------------------------------
// functions: createCustomerUnRegisterResponse
// args: registration_data, registration_status, error
// description: create Registration response for the  registration request.
// {
//
//     "unregistration_status": {
//     "tenant_id": "85",
//         "public_customer_id": "eb3b6e8b-97b3-47fe-9d05-3b134e7e040f",
//         “success_status”:  true
// }
//
// }
//---------------------------------------------------------------------------
var  createCustomerUnRegisterResponse = function (registration_data, registration_status, error){
    
        var registration_response = {
    
            "unregistration_status": {
                "tenant_id": registration_data.tenant_id,
                "public_customer_id": registration_data.public_customer_id,
                "success_status": registration_status
            }
        };
    
        if(error != undefined){
            registration_response.unregistration_status.error = error;
        }
    
        return registration_response;
    }



//-----------------------------------------------------------------------------
// functions: handleCustomerRegistration
// args: db, customerRegistrationCollection, registration_data 
// description: find customer document.
//---------------------------------------------------------------------------
var handleCustomerRegistration = function(db, customerRegistrationCollection, registration_data ){
    
        return new Promise( function (resolve, reject) {
            var docId = "tid:" + registration_data.tenant_id + "_pcid:" + registration_data.public_customer_id;
            checkIfCustomerDocumentExists(db, customerRegistrationCollection, registration_data.tenant_id, registration_data.public_customer_id )
            .then(function(foundCustomerDocument){

                if(foundCustomerDocument != undefined){ //customer Exist! shoud update
                    
                    updateDeviceInExistingCustomerDocument(db, customerRegistrationCollection, registration_data, foundCustomerDocument, docId)
                    .then(function(status){
                        resolve(true);
                    })
                    .catch(function(statusError){
                        console.error("handleCustomerRegistration: updateDeviceInExistingCustomerDocument:  Failed update Customer Document - " + {_id: id} + statusError);
                        reject(statusError);
                    });
                }else{//customer Not Exist! shoud Insert new Document
                    insertNewCustomerDocument(db, customerRegistrationCollection, registration_data )
                    .then(function(status){
                        resolve(true);
                    })
                    .catch(function(status){
                        
                        console.error("handleCustomerRegistration: insertNewCustomerDocument Failed  " + {_id: docId});
                        reject(false);
                    });
                }
            })
            .catch(function (error) {
                console.error("handleCustomerRegistration:checkIfCustomerDocumentExists:  Failed Deletion - " + {_id: docId});
                reject(false);
            });
        });
    
    }

//-----------------------------------------------------------------------------
// functions: handleCustomerUnRegistration
// args: db, customerRegistrationCollection, registration_data 
// description: find customer document.
//---------------------------------------------------------------------------
var handleCustomerUnRegistration = function(db, customerRegistrationCollection, registration_data ){
    
    return new Promise( function (resolve, reject) {
        var docId = "tid:" + registration_data.tenant_id + "_pcid:" + registration_data.public_customer_id;
        checkIfCustomerDocumentExists(db, customerRegistrationCollection, registration_data.tenant_id, registration_data.public_customer_id )
        .then(function(foundCustomerDocument){

            if(foundCustomerDocument != undefined){ //customer Exist! shoud update
                
                removeDeviceAndUpdateExistingDocument(db, customerRegistrationCollection, registration_data, foundCustomerDocument, docId)
                .then(function(status){
                    resolve(true);
                })
                .catch(function(statusError){
                    console.error("handleCustomerRegistration: updateDeviceInExistingCustomerDocument:  Failed update Customer Document - " + {_id: id} + statusError);
                    reject(statusError);
                });
            }else{//customer Not Exist! shoud Insert new Document
                var warnError = "Customer Document Not Exist";
                console.warn(warnError);
                reject(warnError);
            }
        })
        .catch(function (error) {
            console.error("handleCustomerRegistration:checkIfCustomerDocumentExists:  Failed Deletion - " + {_id: docId});
            reject(false);
        });
    });

}


//-----------------------------------------------------------------------------
// functions: checkIfCustomerDocumentExists
// args: db, customerRegistrationCollection, tenantId, public_customer_id
// description: find customer document.
//---------------------------------------------------------------------------
var checkIfCustomerDocumentExists = function(db, customerRegistrationCollection, tenantId, public_customer_id ){
    
        return new Promise( function (resolve, reject) {
            var id = "tid:" + tenantId + "_pcid:" + public_customer_id;
            customerRegistrationCollection.findOne({"_id": id}).then(function (foundDocument) {
                resolve(foundDocument);
            }).catch(function (error) {
                console.error("checkIfCustomerDocumentExists:  Failed Deletion - " + {_id: id});
                reject(false);
            });
        });
    
    }

        
//-----------------------------------------------------------------------------
// functions: insertNewCustomerDocument
// args: db, customerRegistrationCollection, registration_data 
// return: boolean
// description: insert new customer document.
//---------------------------------------------------------------------------
var insertNewCustomerDocument = function(db, customerRegistrationCollection, registration_data ){
    
        return new Promise( function (resolve, reject) {
            var dataResult = createCustomerRegisterData(registration_data);
            if(dataResult.status == true){
                customerRegistrationCollection.insertOne(dataResult.data)
                .then(function(reultInsert){
                    resolve(true);   
                })
                .catch(function(reultInsert){
                    reject(false);
                    });
            }
        });
    
    }
    
//-----------------------------------------------------------------------------
// functions: updateDeviceInExistingCustomerDocument
// args: db, customerRegistrationCollection, registration_data, existingDocument, docId 
// return: boolean
// description: update customer document.
//---------------------------------------------------------------------------
var updateDeviceInExistingCustomerDocument = function(db, customerRegistrationCollection, registration_data, existingDocument, docId ){
    
    return new Promise( function (resolve, reject) {
        var dataResult = createCustomerRegisterDocumentFromExisting(registration_data, existingDocument);
        if(dataResult.status == true){
            updateDocumentOptInStatus(dataResult.data);
            customerRegistrationCollection.update({_id: docId}, dataResult.data)
            .then(function(status){
                resolve(true);
            })
            .catch(function(error){
                reject(false);
            })
            
        }
    });

}


    
//-----------------------------------------------------------------------------
// functions: createCustomerRegisterDocumentFromExisting
// args: registration_data, existingDocument
// description: create Registration Document from existing One.
// { 
//     "_id": "tid:1_pcid:eb3b6e8b-97b3-47fe-9d05-3b134e7e040f", 
//     "tenant_id": 1, 
//     "public_customer_id": "eb3b6e8b-97b3-47fe-9d05-3b134e7e040f", 
//     "opt_in": "true",
//     "is_visitor": "false",
	
//     "android_tokens": {
//         "2b14fa8b-abcf-4347-aca9-ea3e03be657e": { 
//         "opt_in": "true",        
//         "token": "152 Bytes", 
//         "os_version": "7.002" 
//         }, 

//         "3c14fa8b-abcf-4347-aca9-fg4de03be657e":{         
//         "token": "152 Bytes", 
//         "os_version": "7.002" 
//         }
//     }, 
//     "ios_tokens": { 
//          "opt_in": "false",        
//          "5b14fa8b-abcf-4347-aca9-ea3e03be657e":{         
//         "token": "152 Bytes", 
//         "os_version": "7.002" 
//         }
//     } 
// }
//---------------------------------------------------------------------------
var createCustomerRegisterDocumentFromExisting= function (registration_data, existingDocument){
    
    var dataResult = {status : false, data: undefined};

    try{
        if(existingDocument != undefined){
            //check the device type and if itis already exist
            var deviceType = -1; // 1 = and, 2 = ios, 3 = web
            var deviceGroup = undefined;
            var addedDevice = undefined;
            var existingDeviceGroup = undefined;
            if(registration_data.android_token){
                deviceType = 1;
                deviceGroup = registration_data.android_token;
                existingDeviceGroup = existingDocument.android_tokens;
            }  
            else if(registration_data.ios_token)
                {
                    deviceType = 2;
                    deviceGroup = registration_data.ios_token;
                    existingDeviceGroup = existingDocument.ios_tokens;
                }
    
                var addedDeviceId = Object.keys(deviceGroup)[0]; // getting the device
                addedDevice = deviceGroup[addedDeviceId];
                existingDeviceGroup[addedDeviceId] = addedDevice;
                dataResult.status = true;
                dataResult.data = existingDocument;
                return  dataResult;
            }
    }catch(error){
        dataResult.status = false;
        dataResult.data = undefined;
        daraResult.error = error;
        return  dataResult;
    }
    
}
   
//-----------------------------------------------------------------------------
// functions: validateCustomerRegistrationData
// args: registration_data
// description: validate register data.
//---------------------------------------------------------------------------
var validateCustomerRegistrationData = function (registration_data){
    
        var status = true;
        var err = undefined;
        var  deviceGroup = undefined; 
        var validationResult = {status: false, error: undefined};
    
        if(registration_data.public_customer_id == undefined){
        
            err = 'validateCustomerRegistrationData: registration_data.public_customer_id is missing';
            validationResult.error += "\n" + err;
            console.error(err);
    
            status = false;
        }
    
        if(registration_data.tenant_id == undefined || typeof registration_data.tenant_id != 'number'){
        
            err = 'validateCustomerRegistrationData: registration_data.tenant_id is missing';
            validationResult.error += "\n" + err;
            console.error(err);
    
            status = false;
        }
    
        if(registration_data.is_conversion == undefined ){
        
            err = 'validateCustomerRegistrationData: registration_data.is_conversion  is missing';
            validationResult.error += "\n" + err;
            console.error(err);
    
            status = false;
        }
    
        if(registration_data.orig_visitor_id == undefined ){
            err = 'validateCustomerRegistrationData: registration_data.orig_visitor_id  is missing';
            validationResult.error += "\n" + err;
            console.error(err);
    
            status = false;
        }
    
        if(registration_data.android_token == undefined && registration_data.ios_token == unefined){
                err = 'validateCustomerRegistrationData: registration_data device is missing';
                validationResult.error += "\n" + err;
                console.error(err);
        
                status = false;
            }else{
                if(registration_data.android_token != undefined){
                    deviceGroup = registration_data.android_token;
                }  
                else{
                    deviceGroup = registration_data.ios_token;
                }
                    
               var status =  checkDeviceIdExisitinData(deviceGroup);
               if( status == false){
                err = 'validateCustomerRegistrationData: registration_data device data is missing';
                validationResult.error += "\n" + err;
                console.error(err);
               }
            }
            validationResult.status = status;
            
            return validationResult;
        }



//-----------------------------------------------------------------------------
// functions: validateCustomerUnRegistrationData
// args: unregistration_data
// description: validate register data.
// {
    
//     "unregistration_data": {
//         "tenant_id": "85",
//         "public_customer_id": "eb3b6e8b-97b3-47fe-9d05-3b134e7e040f",
//         "android_token": {
//             “device_id”: "2b14fa8b-abcf-4347-aca9-ea3e03be657e"                  
//         }
//     }
// }

//---------------------------------------------------------------------------
var validateCustomerUnRegistrationData = function (unregistration_data){
    
        var status = true;
        var err = undefined;
    
        var validationResult = {status: false, error: undefined};
    
        if(unregistration_data.public_customer_id == undefined)
        {
            err = 'validateCustomerUnRegistrationData: unregistration_data.public_customer_id is missing';
            validationResult.error += "\n" + err;
            console.error(err);
    
            status = false;
        }
    
    
    
        if(unregistration_data.tenant_id == undefined || typeof unregistration_data.tenant_id != 'number')
        {
            err = 'validateCustomerUnRegistrationData: unregistration_data.tenant_id is missing';
            validationResult.error += "\n" + err;
            console.error(err);
    
            status = false;
        }
    
        if(unregistration_data.android_token == undefined && unregistration_data.ios_token== undefined)
            {
                err = 'validateCustomerUnRegistrationData: unregistration_data device is missing';
                validationResult.error += "\n" + err;
                console.error(err);
        
                status = false;
            }else{
                var devicegroup = undefined;
                if(unregistration_data.android_token!== undefined)
                    devicegroup = unregistration_data.android_token;
                else
                    devicegroup = unregistration_data.ios_token;
                var statusDevId =  checkDeviceIdExisitinData(devicegroup)
               if( statusDevId == false){
                var err = 'validateCustomerUnRegistrationData: unregistration_data device data is missing';
                validationResult.error += "\n" + err;
                status = false;
                console.error(err);
               }
            }
       
    
        validationResult.status = status;
    
        return validationResult;
    }
    


//-----------------------------------------------------------------------------
// functions: createCustomerRegisterData
// args: registration_data
// description: create Registration Data for the Customer Collection.
// { 
//     "_id": "tid:1_pcid:eb3b6e8b-97b3-47fe-9d05-3b134e7e040f", 
//     "tenant_id": 1, 
//     "public_customer_id": "eb3b6e8b-97b3-47fe-9d05-3b134e7e040f", 
//     "opt_in": "true",
//     "is_visitor": "false",
	
//     "android_tokens": {
//         "2b14fa8b-abcf-4347-aca9-ea3e03be657e": { 
//         "opt_in": "true",        
//         "token": "152 Bytes", 
//         "os_version": "7.002" 
//         }, 

//         "3c14fa8b-abcf-4347-aca9-fg4de03be657e":{         
//         "token": "152 Bytes", 
//         "os_version": "7.002" 
//         }
//     }, 
//     "ios_tokens": { 
//          "opt_in": "false",        
//          "5b14fa8b-abcf-4347-aca9-ea3e03be657e":{         
//         "token": "152 Bytes", 
//         "os_version": "7.002" 
//         }
//     } 
// }
//---------------------------------------------------------------------------
var  createCustomerRegisterData = function (registration_data){
   
    var data = {
        
        "_id": undefined, 
        "tenant_id": undefined, 
        "public_customer_id": undefined, 
        "opt_in": true,

    };

    var status = {status: true, data:undefined};

    data.public_customer_id = registration_data.public_customer_id;
    data.tenant_id = registration_data.tenant_id;
    var id = "tid:"+ data.tenant_id + "_pcid:" + data.public_customer_id;
    data._id = id;
   
   

    if(registration_data.android_token != undefined){
        
        data.android_tokens = registration_data.android_token ;
    }else if(registration_data.ios_token != undefined){
       
        data.ios_tokens = registration_data.ios_token ;
    }
        
    status.data = data;
    return status;
}
// ----------------------------------- End  Register/unRegister Customer Protocol ---------------------------------------------

// ----------------------------------- End  Register/unRegister Visitor Protocol ---------------------------------------------

//-----------------------------------------------------------------------------
// functions: register_visitor
// args: register device/user data in the body
// description:mock for the register
// format example:
// {
//
//     "registration_data": {
//     "tenant_id": "85",
//     "visitor_id": "ef3b6e8b-89c3-47fe-9d05-3b254e7e040f",
//     "is_visitor": "true"
//     "android_token": {
//         "2b14fa8b-abcf-4347-aca9-ea3e03be657e": {
//             "opt-in" : true,        
//             "token": "152 Bytes",
//              "os_version": "7.002"
//         }
//     }
// }
// }
//---------------------------------------------------------------------------
exports.register_visitor = functions.https.onRequest((req, res) => {
    
    var err = undefined;
    var status = undefined;

    var shouldDeleteVisitorDocument = false;
    var registerReq = req.body;
    var registration_data = registerReq.registration_data;


    if(registration_data == undefined)
    {

        var errMsg = "register_visitor:registration_data is missing Failed !!!";
        console.error(errMsg);
        var response = createVisitorRegisterResponse(registration_data, false, errMsg);
        res.status(400);
        res.json(response);
        return;
    }

    var validationResult = validateVisitorRegistrationData(registration_data);
    if(validationResult.status == false){

        var errMsg = "register_visitor:validateVisitorRegistrationData Failed " +validationResult.error;
        console.error(errMsg);
        var response = createVisitorRegisterResponse(registration_data, false, errMsg);
        res.status(400);
        res.json(response);
        return;
    }


    var registrationCollectionName = visitorsRegistrationCollection  + '_' + registration_data.tenant_id;

    MongoClient.connect(url)
        .then(function(db){
            console.log("register_Visitor: Connected correctly to server");
            status = true;

            var orig_visitor_id = registration_data.visitor_id;
            var tenantId = registration_data.tenant_id;

            var registrationCollection = db.collection(registrationCollectionName);
            status = findAndDeletExistDocument(db, registrationCollection, tenantId, orig_visitor_id )

                .then(function (status){

                if(status == true) {

                    var resultData = createVisitorRegisterData(registration_data);
                    registrationCollection.insertOne(resultData.data).then(function (r) {
                        console.log("register_visitor: Insert One correctly to server");
                        db.close();

                        var response = createVisitorRegisterResponse(registration_data, true, undefined);
                        res.json(response);

                    })
                    .catch(function (error) {
                        cleanup(db);
                        var errMsg = "register_visitor: InsertOne  DB Server Failed tenantId = " + tenantId + " orig_visitor_id =  " + orig_visitor_id + " " +error;
                        console.error(errMsg);
                        var response = createVisitorRegisterResponse(registration_data, false, errMsg);
                        res.status(400);
                        res.json(response);

                    })

                }

            }).catch(function(error){
                cleanup(db);
                console.error("findAndDeletExistDocument() Failed");
                var errMsg = "register_visitor: findAndDeletExistDocument() Failed tenantId = " + tenantId + " orig_visitor_id =  " + orig_visitor_id + " " + error;
                console.error(errMsg);
                var response = createVisitorRegisterResponse(registration_data, false, errMsg);
                res.status(400);
                res.json(response);

                })

        })
        .catch(function(error){
            cleanup(db);
            var errMsg = "register_visitor: Connected DB Server Failed  tenantId = " + tenantId + " orig_visitor_id =  " + orig_visitor_id + " " + error;
            console.error(errMsg);
            var response = createVisitorRegisterResponse(registration_data, false, errMsg);
            res.status(400);
            res.json(response);


        })
});

//-----------------------------------------------------------------------------
// functions: unregister_visitor
// args: register device/user data in the body
// description:mock for the register
// format example:
//     
//      "unregistration_data": {
//          "tenant_id": "85",
//          "visitor_id": "ef3b6e8b-89c3-47fe-9d05-3b254e7e040f",
//          "is_visitor": "true"
//          "android_token": {
//              “device_id”: "2b14fa8b-abcf-4347-aca9-ea3e03be657e"                  
//          }
//      }
//  }
//---------------------------------------------------------------------------
exports.unregister_visitor  = functions.https.onRequest((req, res) => {
    
    var err = undefined;
    var status = undefined;

    var shouldDeleteVisitorDocument = false;
    var registerReq = req.body;
    var unregistration_data = registerReq.unregistration_data;

    if(unregistration_data == undefined)
    {

        var errMsg = "unregister_visitor:registration_data is missing Failed !!!";
        console.error(errMsg);
        var response = createVisitorRegisterResponse(unregistration_data, false, errMsg);
        res.status(400);
        res.json(response);
        return;
    }

    var validationResult = validateVisitorUnRegistrationData(unregistration_data);
    if(validationResult.status == false){

        var errMsg = "unregister_visitor:validateVisitorUnRegistrationData Failed " +validationResult.error;
        console.error(errMsg);
        var response = createVisitorRegisterResponse(unregistration_data, false, errMsg);
        res.status(400);
        res.json(response);
        return;
    }
    
    var registrationCollectionName = visitorsRegistrationCollection  + '_' + unregistration_data.tenant_id;

    MongoClient.connect(url)
        .then(function(db){
            console.log("Connected correctly to server");
            status = true;

            var orig_visitor_id = unregistration_data.visitor_id;
            var tenantId = unregistration_data.tenant_id;

            var registrationCollection = db.collection(registrationCollectionName);
            status = findAndDeletExistDocument(db, registrationCollection, tenantId, orig_visitor_id )    
            .then(function (status){

                    db.close();                        
                    var response = createVisitorRegisterResponse(unregistration_data, true, undefined);
                    res.json(response);

            }).catch(function(error){
                cleanup(db);
                console.error("unregister_visitor: findAndDeletExistDocument() Failed");
                var errMsg = "unregister_visitor: findAndDeletExistDocument() Failed tenantId = " + tenantId + " orig_visitor_id =  " + orig_visitor_id + " " + error;
                console.error(errMsg);
                var response = createVisitorRegisterResponse(unregistration_data, false, errMsg);
                res.status(400);
                res.json(response);

                })

        })
        .catch(function(error){
            cleanup(db);
            var errMsg = "unregister_visitor: Connected DB Server Failed  tenantId = " + tenantId + " orig_visitor_id =  " + orig_visitor_id + " " + error;
            console.error(errMsg);
            var response = createVisitorRegisterResponse(registration_data, false, errMsg);
            res.status(400);
            res.json(response);


        })
});




//-----------------------------------------------------------------------------
// functions: validateVisitorRegistrationData
// args: registration_data
// description: validate register data..
//---------------------------------------------------------------------------
var validateVisitorRegistrationData = function (registration_data){
    
    var status = true;
    var err = undefined;

    var validationResult = {status: false, error: undefined};

    if(registration_data.tenant_id == undefined || typeof registration_data.tenant_id != 'number')
    {
        err = 'validateVisitorRegistrationData: registration_data.tenant_id is missing';
        validationResult.error += "\n" + err;
        console.error(err);

        status = false;
    }


    if(registration_data.visitor_id == undefined)
    {
        err = 'validateVisitorRegistrationData: registration_data.public_customer_id is missing';
        validationResult.error += "\n" + err;
        console.error(err);

        status = false;
    }


    if(registration_data.android_token == undefined && registration_data.ios_token == undefined  )
    {
        err = 'validateVisitorRegistrationData: registration_data.android_token || ios_token  is missing';
        validationResult.error += "\n" + err;
        console.error(err);

        status = false;
    }


    validationResult.status = status;

    return validationResult;

}
    

//-----------------------------------------------------------------------------
// functions: validateVisitorUnRegistrationData
// args: unregistration_data
// description: validate register data.
// {    
//      "unregistration_data": {
//          "tenant_id": 85,
//          "visitor_id": "ef3b6e8b-89c3-47fe-9d05-3b254e7e040f",          
//          "android_token": {
//              “device_id”: "2b14fa8b-abcf-4347-aca9-ea3e03be657e"                  
//          }
//      }
//  } 
//---------------------------------------------------------------------------
var validateVisitorUnRegistrationData = function (unregistration_data){
    
    var status = true;
    var err = undefined;

    var validationResult = {status: false, error: undefined};

    if(unregistration_data.visitor_id == undefined)
    {
        err = 'validateVisitorUnRegistrationData: unregistration_data.visitor_id is missing';
        validationResult.error += "\n" + err;
        console.error(err);

        status = false;
    }



    if(unregistration_data.tenant_id == undefined || typeof unregistration_data.tenant_id != 'number')
    {
        err = 'validateVisitorUnRegistrationData: unregistration_data.tenant_id is missing';
        validationResult.error += "\n" + err;
        console.error(err);

        status = false;
    }

    if(unregistration_data.android_token == undefined && unregistration_data.ios_token== undefined)
        {
            err = 'validateVisitorUnRegistrationData: unregistration_data device is missing';
            validationResult.error += "\n" + err;
            console.error(err);
    
            status = false;
        }else{
            var devicegroup = undefined;
            if(unregistration_data.android_token!== undefined)
                devicegroup = unregistration_data.android_token;
            else
                devicegroup = unregistration_data.ios_token;
            var statusDevId =  checkDeviceIdExisitinData(devicegroup)
            if( statusDevId == false){
            err = 'validateVisitorUnRegistrationData: unregistration_data device data is missing';
            validationResult.error += "\n" + err;
            status = false;
            console.error(err);
            }
        }
    

    validationResult.status = status;

    return validationResult;
}

//-----------------------------------------------------------------------------
// functions: createVisitorRegisterResponse
// args: registration_data, registration_status, error
// description: create Registration response for the  registration request.
// {
//
//     "registration_status": {
//     "tenant_id": "85",
//         "visitor_id": "eb3b6e8b-97b3-47fe-9d05-3b134e7e040f",
//         “success_status”:  true
// }
//
// }
//---------------------------------------------------------------------------
var  createVisitorRegisterResponse = function (registration_data, registration_status, error){

    var registration_response = {

        "registration_status": {
            "tenant_id": registration_data.tenant_id,
            "visitor_id": registration_data.visitor_id,
            "success_status": registration_status
        }
    };

    if(error != undefined){
        registration_response.registration_status.error = error;
    }

    return registration_response;
}
    
    

//-----------------------------------------------------------------------------
// functions: createVisitorRegisterData
// args: registration_data
// description: create Registration Data for the visitors Collection.
// {
//
//     "registration_data": {
//     "tenant_id": "85",
//     "visitor_id": "ef3b6e8b-89c3-47fe-9d05-3b254e7e040f",
//     "is_visitor": "true"
//     "android_token": {
//         "2b14fa8b-abcf-4347-aca9-ea3e03be657e": {
//             "token": "152 Bytes",
//                 "os_version": "7.002"
//         }
//     }
// }
// }
//---------------------------------------------------------------------------
var  createVisitorRegisterData = function (registration_data){
    
    var data = {
        "_id": undefined,
        "tenant_id": undefined,
        "visitor_id":undefined,
        "opt_in": "true",
        "is_visitor": "true",

        "android_token": {

        }
    };

    var status = {status: true, data:undefined};

    var visitor_id = registration_data.visitor_id;
    var tenantId = registration_data.tenant_id;
    var id = "tid:"+ tenantId + "_vid:" + visitor_id;
    data._id = id;
    data.tenant_id  = tenantId;
    data.visitor_id = visitor_id;
    if(registration_data.android_token != undefined){
        data.android_token = registration_data.android_token ;
    }else if(registration_data.ios_token != undefined){
        data.android_token = registration_data.ios_token ;
    }

    status.data = data;
    return status;
}
    
    