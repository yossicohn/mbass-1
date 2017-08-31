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


