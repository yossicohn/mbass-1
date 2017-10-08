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
// functions: getVisitorDocId
// args: db
// description: get Visitor DocId.
//---------------------------------------------------------------------------
var getVisitorDocId = function (request){
    var docId = "tid-" + request.tenant_id + "-vid-" + request.visitor_id;
    return docId;
}

//-----------------------------------------------------------------------------
// functions: getCustomerDocId
// args: db
// description: get Customer DocId.
//---------------------------------------------------------------------------
var getCustomerDocId = function (request){
    var docId = "tid-" + request.tenant_id + "-pcid-" + request.public_customer_id;
    return docId;
}
    

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
        var app_ns = deviceGroup.app_ns;
        var needUpdated=false;
        var app = {};
        var exisitingDeviceGroup = {};
        if(groupType == 1){//android               
            exisitingDeviceGroup = existingDocument.android_tokens[deviceId];                            
            needUpdated = true;

        }else if(groupType == 2){ //ios                
            exisitingDeviceGroup = existingDocument.ios_tokens[deviceId];                          
            needUpdated = true;
        }
        
        if(needUpdated == true){   
            delete exisitingDeviceGroup.apps[app_ns];
            
            if(Object.keys(exisitingDeviceGroup.apps).length == 0) 
            {// if deveice has no apps then delete the device as well
                if(groupType == 1){
                    delete  existingDocument.android_tokens[deviceId]; 
                }else if(groupType == 2){
                    delete  existingDocument.ios_tokens[deviceId]; 
                }                    
            }               
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
// functions: findAndDeletExistVisitorDocument
// args: db, registrationCollection, tenantId, orig_visitor_id
// description: find and delete document visitor.
//---------------------------------------------------------------------------
var findAndDeletExistVisitorDocument = function(db, registrationCollection, tenantId, orig_visitor_id ){

    return new Promise( function (resolve, reject) {

        var register_data = {
            tenant_id: tenantId,
            visitor_id: orig_visitor_id
        };
        var docId = getVisitorDocId(register_data);
        registrationCollection.findOneAndDelete({"_id": docId}).then(function (foundDocument) {
            resolve(true);
        }).catch(function (error) {
            console.error("findAndDeletExistVisitorDocument:  Failed Deletion - " + {_id: docId});
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
    
    
// ----------------------------------- Opt In Out Protocol ---------------------------------------------

//-----------------------------------------------------------------------------
// functions: optInOutVisitor
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
exports.optInOutVisitor = functions.https.onRequest((req, res) => {
    
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

            var errMsg = "optInOutVisitor:opt_request is missing data Failed !!!";
            console.error(errMsg);
            var response = createVisitorOptInOutResponse(opt_request, opt_mode, false, errMsg);
            res.status(400);
            res.json(response);
            return;
        }

        //var validationResult = validateCustomerOptInOutData(registration_data);
        var validationResult = {status: true};

        if(validationResult.status == false){

            var errMsg = "optInOutVisitor:validateCustomerOptInOutData Failed " +validationResult.error;
            console.error(errMsg);
            var response = createVisitorOptInOutResponse(opt_request, opt_mode, false, errMsg);
            res.status(400);
            res.json(response);

        }

        var registrationCollectionName = visitorsRegistrationCollection  + '_' + opt_request.tenant_id;
        
        MongoClient.connect(url)
        .then(function(db){
            console.log("optInOutVisitor: Connected correctly to server");
            status = true;           
            var tenantId = opt_request.tenant_id;
            var visitorsRegistrationCollection = db.collection(registrationCollectionName);
            var docId = getVisitorDocId(opt_request);
            visitorsRegistrationCollection.findOne({_id: docId})
            .then(function(exisitingDoc){
                handleOptInOutUpdate(db, visitorsRegistrationCollection, docId, exisitingDoc, opt_mode, opt_request)
                .then(function(exisitingDoc){
                    db.close();                   
                    var response = createVisitorOptInOutResponse(opt_request, opt_mode, true, errMsg);                    
                    res.json(response);
                })
                .catch(function(error){
                    var errMsg = "optInOutVisitor:handleOptInOutUpdate Failed " + error;
                    console.error(errMsg);
                    var response = createVisitorOptInOutResponse(opt_request, opt_mode, false, errMsg);
                    res.status(400);
                    res.json(response);

                })
            })
            .catch(function(error){
                cleanup(db);
                var errMsg = "optInOutVisitor:customerRegistrationCollection.findOne Failed " + error;
                console.error(errMsg);
                var response = createVisitorOptInOutResponse(opt_request, opt_mode, false, errMsg);
                res.status(400);
                res.json(response);

            })                                          

        })
        .catch(function(error){
            
            var errMsg = "optInOutVisitor: Connected DB Server Failed  tenantId = " + opt_request.tenant_id + " visitor_id =  " + opt_request.visitor_id + " " + error;
            console.error(errMsg);
            var response = createVisitorOptInOutResponse(opt_request, opt_mode, false, errMsg);
            res.status(400);
            res.json(response);
        });
   
})
    


//-----------------------------------------------------------------------------
// functions: optInOutCustomer
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
exports.optInOutCustomer = functions.https.onRequest((req, res) => {
    
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

        var errMsg = "optInOutCustomer:opt_request is missing data Failed !!!";
        console.error(errMsg);
        var response = createCustomerOptInOutResponse(opt_request, opt_mode, false, errMsg);
        res.status(400);
        res.json(response);
        return;
    }

    //var validationResult = validateCustomerOptInOutData(registration_data);
    var validationResult = {status: true};

    
    if(validationResult.status == false){

        var errMsg = "optInOutCustomer:validateCustomerOptInOutData Failed " +validationResult.error;
        console.error(errMsg);
        var response = createCustomerOptInOutResponse(opt_request, opt_mode, false, errMsg);
        res.status(400);
        res.json(response);
        return;
    }

    var registrationCollectionName = customersRegistrationCollection  + '_' + opt_request.tenant_id;
    
    MongoClient.connect(url)
    .then(function(db){
        console.log("optInOutCustomer:Connected correctly to server");
        status = true;           
        var tenantId = opt_request.tenant_id;
        var customerRegistrationCollection = db.collection(registrationCollectionName);
        var docId = getCustomerDocId(opt_request);
        customerRegistrationCollection.findOne({_id: docId})
        .then(function(exisitingDoc){
            handleOptInOutUpdate(db, customerRegistrationCollection, docId, exisitingDoc, opt_mode, opt_request)
            .then(function(exisitingDoc){
                db.close();                   
                var response = createCustomerOptInOutResponse(opt_request, opt_mode, true, errMsg);                    
                res.json(response);
            })
            .catch(function(error){
                var errMsg = "optInOutCustomer:handleOptInOutUpdate Failed " + error;
                console.error(errMsg);
                var response = createCustomerOptInOutResponse(opt_request, opt_mode, false, errMsg);
                res.status(400);
                res.json(response);
            })
        })
        .catch(function(error){
            cleanup(db);
            var errMsg = "optInOutCustomer: customerRegistrationCollection.findOne Failed " + error;
            console.error(errMsg);
            var response = createCustomerOptInOutResponse(opt_request, opt_mode, false, errMsg);
            res.status(400);
            res.json(response);
        })                                          

    })
    .catch(function(error){
        
            var errMsg = "optInOutCustomer: Connected DB Server Failed  tenantId = " + opt_request.tenant_id + " public_customer_id =  " + opt_request.public_customer_id + " " + error;
            console.error(errMsg);
            var response = createCustomerOptInOutResponse(opt_request, opt_mode, false, errMsg);
            res.status(400);
            res.json(response);
    });
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
        var app_ns = undefined;
        var updatedDeviceId = undefined; 
        var existsingDeviceGroup = undefined;

        if(opt_request.ios_token != undefined){
                updatedDeviceId = opt_request.ios_token.device_id;
                devicePlatform = 2;
            if(existingDocument.ios_tokens != undefined && Object.keys(existingDocument.ios_tokens)[0] != undefined){
                existsingDeviceGroup = existingDocument.ios_tokens[updatedDeviceId];
                app_ns = opt_request.ios_token.app_ns;
                needUpdated = true;
            }else{
                reject("No existsingDeviceGroup");
            }
        }else if(opt_request.android_token != undefined){
                updatedDeviceId = opt_request.android_token.device_id;
                devicePlatform = 1;
                if(existingDocument.android_tokens != undefined && Object.keys(existingDocument.android_tokens)[0] != undefined){
                    existsingDeviceGroup = existingDocument.android_tokens[updatedDeviceId];
                    app_ns = opt_request.android_token.app_ns;
                    needUpdated = true
                }else{
                    reject("No existsingDeviceGroup");
                }
            }

        if(needUpdated == true){

            existsingDeviceGroup.apps[app_ns].opt_in = opt_mode;

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
    var opt_in_result = false;
    var androidDeviceGroup = existingDocument.android_tokens;
    var iosDeviceGroup = existingDocument.ios_tokens;    
    if(androidDeviceGroup != undefined){
        var androidKeys = Object.keys(androidDeviceGroup);
        if(androidKeys[0] != undefined){               
            androidKeys.forEach(function(key){
                var device = androidDeviceGroup[key];
                var apps = device.apps;
                var Apps_ns_Keys = Object.keys(apps);
                Apps_ns_Keys.forEach(function(app_ns){
                if(apps[app_ns].opt_in == true){                    
                    opt_in = true;
                    opt_in_result = true;
                    return;
                }
                    
                })                
            })
        }

    }
        
    if(opt_in == true && opt_in_result == true)
    {
        existingDocument.opt_in = true;
        return;
    }
        
    if(iosDeviceGroup != undefined){
        var iosKeys = Object.keys(iosDeviceGroup);
        if(iosKeys[0] != undefined){               
                iosKeys.forEach(function(key){
                    var device = iosDeviceGroup[key];
                    var apps = device.apps;
                    var Apps_ns_Keys = Object.keys(apps);
                    Apps_ns_Keys.forEach(function(app_ns){
                    if(apps[app_ns].opt_in == true){
                        existingDocument.opt_in = true;
                        opt_in_result = true;
                        return;
                    }                
                })
            })
        }   
    } 
    
    if(opt_in == false && opt_in_result == false)
    {
        existingDocument.opt_in = false;        
    }
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

        "opt_out_status": {
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
// functions: register-customer
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
exports.registerCustomer =  functions.https.onRequest((req, res) => {
    
    var err = undefined;
    var status = undefined;


    var registerReq = req.body;
    var registration_data = registerReq.registration_data;


    if(registration_data == undefined)
    {

        var errMsg = "registerCustomer:registration_data is missing Failed !!!";
        console.error(errMsg);
        var response = createCustomerRegisterResponse(registration_data, false, errMsg);
        res.status(400);
        res.json(response);
        return;
    }

    var validationResult = validateCustomerRegistrationData(registration_data);
    if(validationResult.status == false){

        var errMsg = "registerCustomer:validateCustomerRegistrationData Failed " +validationResult.error;
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
            console.log("registerCustomer: Connected correctly to server");
            status = true;

            var orig_visitor_id = registration_data.orig_visitor_id;
            var tenantId = registration_data.tenant_id;

            var customerRegistrationCollection = db.collection(registrationCollectionName);
            if(customerRegistrationCollection == undefined){
                var errMsg = "registerCustomer: failed connection to collection registrationCollectionName=" +registrationCollectionName;
                console.error(errMsg);
                var response = createCustomerRegisterResponse(registration_data, false, errMsg);
                res.status(400);
                res.json(response);
               
                return;
            }
           
            // check scenario:
            // 1. Is this Conversion of the visitor or update ==> new Customer Document
            // 2. is this an update of existing Customer ==> update Customer Document
             
            handleCustomerRegistration (db, customerRegistrationCollection, registration_data )
            .then(function (status){
                if(registration_data.is_conversion == true){ //Use Case 1 remove the Visitor Document
                    
                        var visitorsRegistrationCollection = db.collection(visitorsRegistrationCollectionName);
                    // check if customer already exist
                        status = findAndDeletExistVisitorDocument(db, visitorsRegistrationCollection, tenantId, orig_visitor_id )
                        .then(function (status){
                            console.log("registerCustomer: findAndDeletExistVisitorDocument() removed visitor = " + tenantId + " orig_visitor_id =  " + orig_visitor_id );
                        }).catch(function(error){

                            cleanup(db);
                            console.error("registerCustomer: findAndDeletExistVisitorDocument() Failed");
                            var errMsg = "registerCustomer: findAndDeletExistVisitorDocument() Failed tenantId = " + tenantId + " orig_visitor_id =  " + orig_visitor_id + " " + error;
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
                console.error("registerCustomer() Failed");
                var errMsg = "registerCustomer: handleCustomerRegistration() Failed tenantId = " + tenantId + " orig_visitor_id =  " + orig_visitor_id + " " + error;
                console.error(errMsg);
                var response = createCustomerRegisterResponse(registration_data, false, errMsg);
                res.status(400);
                res.json(response);

            })  
           
    })
    .catch(function(error){
        cleanup(db);
        var errMsg = "registerCustomer: Connected DB Server Failed  tenantId = " + tenantId + " orig_visitor_id =  " + orig_visitor_id + " " + error;
        console.error(errMsg);
        var response = createCustomerRegisterResponse(registration_data, false, errMsg);
        res.status(400);
        res.json(response);


    })
})


//-----------------------------------------------------------------------------
// functions: unregisterCustomer
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
exports.unregisterCustomer = functions.https.onRequest((req, res) => {
    
    var err = undefined;
    var status = undefined;


    var registerReq = req.body;
    var unregistration_data = registerReq.unregistration_data;


    if(unregistration_data == undefined)
    {

        var errMsg = "unregisterCustomer:unregistration_data is missing Failed !!!";
        console.error(errMsg);
        var response = createCustomerRegisterResponse(registration_data, false, errMsg);
        res.status(400);
        res.json(response);
        return;
    }

    var validationResult = validateCustomerUnRegistrationData(unregistration_data);
    if(validationResult.status == false){

        var errMsg = "unregisterCustomer:validateCustomerUnRegistrationData Failed " +validationResult.error;
        console.error(errMsg);
        var response = createCustomerUnRegisterResponse(unregistration_data, false, errMsg);
        res.status(400);
        res.json(response);
        return;
    }

    var registrationCollectionName = customersRegistrationCollection  + '_' + unregistration_data.tenant_id;
   
    MongoClient.connect(url)
        .then(function(db){
            console.log("unregisterCustomer: Connected correctly to server");
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
                console.error("unregisterCustomer() Failed");
                var errMsg = "unregisterCustomer: handleCustomerUnRegistration() Failed tenantId = " + tenantId + " public_customer_id =  " + public_customer_id + " " + error;
                console.error(errMsg);
                var response = createCustomerRegisterResponse(unregistration_data, false, errMsg);
                res.status(400);
                res.json(response);

            })  
           
    })
    .catch(function(error){
        cleanup(db);
        var errMsg = "unregisterCustomer: Connected DB Server Failed  tenantId = " + tenantId + " public_customer_id =  " + public_customer_id + " " + error;
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
        var docId = getCustomerDocId(registration_data);        
        checkIfCustomerDocumentExists(db, customerRegistrationCollection, registration_data.tenant_id, registration_data.public_customer_id, docId )
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
                    
                    console.error("handleCustomerRegistration: InsertNewCustomerDocument Failed  - " + {_id: docId});
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
        var docId = getCustomerDocId(registration_data);
        checkIfCustomerDocumentExists(db, customerRegistrationCollection, registration_data.tenant_id, registration_data.public_customer_id, docId )
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
// args: db, customerRegistrationCollection, tenantId, public_customer_id, docId
// description: find customer document.
//---------------------------------------------------------------------------
var checkIfCustomerDocumentExists = function(db, customerRegistrationCollection, tenantId, public_customer_id, docId){
    
    return new Promise( function (resolve, reject) {
       
        customerRegistrationCollection.findOne({"_id": docId})
        .then(function (foundDocument) {
            resolve(foundDocument);
        })
        .catch(function (error) {
            console.error("checkIfCustomerDocumentExists:  Failed Deletion - " + {_id: docId});
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
                console.log("insertNewCustomerDocument 3")
                resolve(true);   
            })
            .catch(function(reultInsert){
                console.error("insertNewCustomerDocument 1****");
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
//     "registration_data": {
//       "tenant_id": 85,
//       "public_customer_id": "32862a06-cdcd-4f75-ace4-a721aea02c98",
//       "is_conversion": false,
//       "orig_visitor_id": "ef3b6e8b-89c3-47fe-9d05-3b254e7e040f",
//       "android_token": {
//         "2b14fa8b-abcf-4347-aca9-ea3e03be657e": {
//           "apps": {
//             "app_ns.com": {
//               "opt_in": true,
//               "token": "152 Bytes"
//             }
//           },
//           "os_version": "7.02"
//         }
//       }
//     }
//   }
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
            if(registration_data.android_token != undefined){
                deviceType = 1;
                deviceGroup = registration_data.android_token;
                if(existingDocument.android_tokens == undefined){
                    existingDocument.android_tokens = {};
                }
                existingDeviceGroup = existingDocument.android_tokens;
            }  
            else if(registration_data.ios_token != undefined)
                {
                    deviceType = 2;
                    deviceGroup = registration_data.ios_token;
                    if(existingDocument.ios_tokens == undefined){
                        existingDocument.ios_tokens = {};
                    }
                    existingDeviceGroup = existingDocument.ios_tokens;
                }
    
                var addedDeviceId = Object.keys(deviceGroup)[0]; // getting the device
                addedDevice = deviceGroup[addedDeviceId];
                var  apps = addedDevice.apps; // getting the app Daty
                var app_ns = Object.keys(apps)[0];
                var app_data = apps[app_ns]; // app data = token, opt_in
                if(existingDeviceGroup[addedDeviceId] == undefined)
                {
                    existingDeviceGroup[addedDeviceId] = {};
                    existingDeviceGroup[addedDeviceId].apps = {};
                }
                existingDeviceGroup[addedDeviceId].apps[app_ns] = app_data;
                existingDeviceGroup[addedDeviceId].os_version = addedDevice.os_version; // update the OS Version.

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

    if(registration_data.is_conversion == true  && registration_data.orig_visitor_id == undefined ){
        err = 'validateCustomerRegistrationData: registration_data.orig_visitor_id  is missing';
        validationResult.error += "\n" + err;
        console.error(err);

        status = false;
    }

    if(registration_data.android_token == undefined && registration_data.ios_token == undefined){
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
//     "_id": "tid:85_pcid:eb3b6e8b-97b3-47fe-9d05-3b134e7e040f",
//     "tenant_id": 85,
//     "public_customer_id": "eb3b6e8b-97b3-47fe-9d05-3b134e7e040f",
//     "opt_in": "true",
//     "android_tokens": {
//       "2b14fa8b-abcf-4347-aca9-ea3e03be657e": {
//         "apps": {
//           "app_ns.org": {
//             "opt_in": "false",
//             "token": "152 Bytes"
//           }
//         },
//         "os_version": "7.002"
//       }
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
        var id = getCustomerDocId(registration_data);
        data._id = id;              
        console.log("id = " + data._id);

        if(registration_data.android_token != undefined){
        
            data.android_tokens = registration_data.android_token ;
           
        }else if(registration_data.ios_token != undefined){
           
            data.ios_tokens = registration_data.ios_token ;
        }

        updateDocumentOptInStatus(data);
        status.data = data;
        return status;
    }



// ----------------------------------- End  Register/unRegister Customer Protocol ---------------------------------------------

// ----------------------------------- End  Register/unRegister Visitor Protocol ---------------------------------------------

//-----------------------------------------------------------------------------
// functions: registerVisitor
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
exports.registerVisitor = functions.https.onRequest((req, res) => {
    var err = undefined;
    var status = undefined;

    var shouldDeleteVisitorDocument = false;
    var registerReq = req.body;
    var registration_data = registerReq.registration_data;


    if(registration_data == undefined)
    {

        var errMsg = "registerVisitor:registration_data is missing Failed !!!";
        console.error(errMsg);
        var response = createVisitorRegisterResponse(registration_data, false, errMsg);
        res.status(400);
        res.json(response);
        return;
    }

    var validationResult = validateVisitorRegistrationData(registration_data);
    if(validationResult.status == false){

        var errMsg = "registerVisitor:validateVisitorRegistrationData Failed " +validationResult.error;
        console.error(errMsg);
        var response = createVisitorRegisterResponse(registration_data, false, errMsg);
        res.status(400);
        res.json(response);
        return;
    }


    var registrationCollectionName = visitorsRegistrationCollection  + '_' + registration_data.tenant_id;

    MongoClient.connect(url)
        .then(function(db){
            console.log("registerVisitor: Connected correctly to server");
            status = true;

            var orig_visitor_id = registration_data.visitor_id;
            var tenantId = registration_data.tenant_id;

            var registrationCollection = db.collection(registrationCollectionName);
            status = findAndDeletExistVisitorDocument(db, registrationCollection, tenantId, orig_visitor_id )

                .then(function (status){

                if(status == true) {

                    var resultData = createVisitorRegisterData(registration_data);
                    registrationCollection.insertOne(resultData.data).then(function (r) {
                        console.log("registerVisitor: Insert One correctly to server");
                        db.close();

                        var response = createVisitorRegisterResponse(registration_data, true, undefined);
                        res.json(response);

                    })
                    .catch(function (error) {
                        cleanup(db);
                        var errMsg = "registerVisitor: InsertOne  DB Server Failed tenantId = " + tenantId + " orig_visitor_id =  " + orig_visitor_id + " " +error;
                        console.error(errMsg);
                        var response = createVisitorRegisterResponse(registration_data, false, errMsg);
                        res.status(400);
                        res.json(response);

                    })

                }

            }).catch(function(error){
                cleanup(db);
                console.error("findAndDeletExistVisitorDocument() Failed");
                var errMsg = "registerVisitor: findAndDeletExistVisitorDocument() Failed tenantId = " + tenantId + " orig_visitor_id =  " + orig_visitor_id + " " + error;
                console.error(errMsg);
                var response = createVisitorRegisterResponse(registration_data, false, errMsg);
                res.status(400);
                res.json(response);

                })

        })
        .catch(function(error){
            cleanup(db);
            var errMsg = "registerVisitor: Connected DB Server Failed  tenantId = " + tenantId + " orig_visitor_id =  " + orig_visitor_id + " " + error;
            console.error(errMsg);
            var response = createVisitorRegisterResponse(registration_data, false, errMsg);
            res.status(400);
            res.json(response);


        })
});


//-----------------------------------------------------------------------------
// functions: unregisterVisitor
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
exports.unregisterVisitor  = functions.https.onRequest((req, res) => {
    
    var err = undefined;
    var status = undefined;

    var shouldDeleteVisitorDocument = false;
    var registerReq = req.body;
    var unregistration_data = registerReq.unregistration_data;

    if(unregistration_data == undefined)
    {

        var errMsg = "unregisterVisitor:registration_data is missing Failed !!!";
        console.error(errMsg);
        var response = createVisitorRegisterResponse(unregistration_data, false, errMsg);
        res.status(400);
        res.json(response);
        return;
    }

    var validationResult = validateVisitorUnRegistrationData(unregistration_data);
    if(validationResult.status == false){

        var errMsg = "unregisterVisitor:validateVisitorUnRegistrationData Failed " +validationResult.error;
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
            findAndDeletExistVisitorDocument(db, registrationCollection, tenantId, orig_visitor_id )
            .then(function (status){

                cleanup(db);
                var response = createVisitorRegisterResponse(unregistration_data, true, undefined);
                res.json(response);

            }).catch(function(error){
                cleanup(db);
                console.error("unregisterVisitor: findAndDeletExistVisitorDocument() Failed");
                var errMsg = "unregisterVisitor: findAndDeletExistVisitorDocument() Failed tenantId = " + tenantId + " orig_visitor_id =  " + orig_visitor_id + " " + error;
                console.error(errMsg);
                var response = createVisitorRegisterResponse(unregistration_data, false, errMsg);
                res.status(400);
                res.json(response);

                })

        })
        .catch(function(error){
            cleanup(db);
            var errMsg = "unregisterVisitor: Connected DB Server Failed  tenantId = " + tenantId + " orig_visitor_id =  " + orig_visitor_id + " " + error;
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
        "is_visitor": "true"
    };

    var status = {status: true, data:undefined};

    var visitor_id = registration_data.visitor_id;
    var tenantId = registration_data.tenant_id;
    var id = getVisitorDocId(registration_data);
    data._id = id;
    data.tenant_id  = tenantId;
    data.visitor_id = visitor_id;
    if(registration_data.android_token != undefined){
        data.android_tokens = registration_data.android_token ;
    }else if(registration_data.ios_token != undefined){
        data.ios_tokens = registration_data.ios_token ;
    }
    //Updating the Opt-In Status
    updateDocumentOptInStatus(data);
    status.data = data;
    return status;
}

    