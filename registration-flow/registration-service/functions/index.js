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



exports.registerDeviceTokenMocPromised = functions.https.onRequest((request, response) => {
    
// Use connect method to connect to the Server 
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
        var collection = db.collection(registrationCollection)
        collection.insertOne(tokenDocument).then(function(r) {           
            console.log("Insert One correctly to server");
            db.close();
            response.send("registerDeviceTokenMocPrimised: Connected succeeded " );
        })
        .catch(function(error){
            console.error("InsertOne  DB Server Failed");
            response.send("registerDeviceTokenMocPrimised: Connected Failed Exiting  " ); 
    
        })
            
       
    })
    .catch(function(error){
        console.error("Connected DB Server Failed");
        response.send("registerDeviceTokenMocPrimised: Connected Failed Exiting  " ); 

    })
})

exports.registerDeviceToken = functions.https.onRequest((request, response) => {
    
// Use connect method to connect to the Server 
    try{
        MongoClient.connect(url, function(err, db) {
        if(err == undefined )
        {
                console.log("Connected correctly to server");
                var collection = db.collection(registrationCollection);       
            
                var tokenDocument = JSON.stringify(request.body)
                console.log("tokenDocument=", tokenDocument);
                collection.insert(request.body);
                db.close();
               
            }     
            else{

                console.error("registerDeviceToken: Connected err ", err);
                //response.send("registerDeviceToken: Connected err Exiting");
                const error = new Error('Only GET requests are accepted!');
                error.code = 405;
                throw error;
                
            } 
         response.send("registerDeviceToken: Connected succeeded Exiting");   
            
        });


    }catch(err){
        // Report the error
        reportError(err, () => {
        // Now respond to the HTTP request
        res.status(err.code || 500).send(err.message);
        });
    }
  

})


exports.registerDeviceTokenPromised = functions.https.onRequest((request, response) => {
    
// Use connect method to connect to the Server 
    try{
        MongoClient.connect(url)
            .then(function(db){
                console.log("Connected correctly to server");
                var collection = db.collection(registrationCollection);       
            
                var tokenDocument = JSON.stringify(request.body)
                console.log("tokenDocument=", tokenDocument);
                collection.insert(request.body);
                db.close();
                response.send("registerDeviceToken: Connected succeeded Exiting"); 

            })
            .catch(function(error){
                console.error("registerDeviceToken: Connected err ", error);
                //response.send("registerDeviceToken: Connected err Exiting");
                 var error2 = new Error('Only GET requests are accepted!');
                error2.code = 405;
                response.send("registerDeviceToken: Connected Failed Exiting " + error); 

            })                

    }catch(err){
        // Report the error
        reportError(err, () => {
        // Now respond to the HTTP request
        res.status(err.code || 500).send(err.message);
        });
    }
})

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
    
    


