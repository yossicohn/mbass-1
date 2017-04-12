
const Logging = require('@google-cloud/logging');
var functions = require('firebase-functions');

// Instantiates a client
const logging = Logging();


var MongoClient = require('mongodb').MongoClient
  , assert = require('assert');
const uuidV4 = require('uuid/v4');
var url = 'mongodb://104.198.49.80:27017/mbassdb';
var registrationCollection = 'CustomerRegistrationTokens';




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
        var tokenDocument = [{
            "_id" : "tic:85_pci:" + currUUID,
            "tenant_id" : 85,
            "public_customer_id" : currUUID,
            "android_tokens" : [ 
                {
                    "device_id" : "2b14fa8b-abcf-4347-aca9-ea3e03be657e",
                    "token" : "152 Bytes",
                    "os_version" : "7.002"
                }
            ]
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