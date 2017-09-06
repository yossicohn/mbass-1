'use strict';

var MongoClient = require('mongodb').MongoClient
, assert = require('assert');
const uuidV4 = require('uuid/v4');
var url = 'mongodb://104.154.65.252:27017/mbassdb';
var customersRegistrationCollection = 'CustomersTokens';
var visitorsRegistrationCollection = 'VisitorsTokens';


var registration_response = {

    "registration_status": {
        "tenant_id": -1,
        "success_status": false
    }
};


var unregistration_response = {

    "registration_status": {
        "tenant_id": -1,
        "success_status": false
    }
};

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
// functions: postregisterCustomer
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
exports.postregisterCustomer = function (req, res) {

    var err = undefined;
    var status = undefined;


    var registerReq = req.body;
    var registration_data = registerReq.registration_data;


    if(registration_data == undefined)
    {

        var errMsg = "postregisterCustomer:registration_data is missing Failed !!!";
        console.error(errMsg);
        var response = createCustomerRegisterResponse(registration_data, false, errMsg);
        res.status(400);
        res.json(response);
        return;
    }

    var validationResult = validateCustomerRegistrationData(registration_data);
    if(validationResult.status == false){

        var errMsg = "postregisterCustomer:validateCustomerRegistrationData Failed " +validationResult.error;
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
            console.log("Connected correctly to server");
            status = true;

            var orig_visitor_id = registration_data.visitor_id;
            var tenantId = registration_data.tenant_id;

            var customerRegistrationCollection = db.collection(registrationCollectionName);
            var visitorsRegistrationCollection = db.collection(visitorsRegistrationCollectionName);
            // check scenario:
            // 1. Is this Conversion of the visitor or update ==> new Customer Document
            // 2. is this an update of existing Customer ==> update Customer Document
             
            handleCustomerRegistration (db, customerRegistrationCollection, registration_data )
            .then(function (status){
                if(registration_data.is_conversion == true){ //Use Case 1 remove the Visitor Document
                    
                    // check if customer already exist
                        status = findAndDeletExistDocument(db, registrationCollection, tenantId, orig_visitor_id )
                        .then(function (status){
                            console.log("findAndDeletExistDocument() removed visitor = " + tenantId + " orig_visitor_id =  " + orig_visitor_id );
                        }).catch(function(error){

                            cleanup(db);
                            console.error("findAndDeletExistDocument() Failed");
                            var errMsg = "postregisterVisitor: findAndDeletExistDocument() Failed tenantId = " + tenantId + " orig_visitor_id =  " + orig_visitor_id + " " + error;
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
                console.error("postregisterCustomer() Failed");
                var errMsg = "postregisterCustomer: handleCustomerRegistration() Failed tenantId = " + tenantId + " orig_visitor_id =  " + orig_visitor_id + " " + error;
                console.error(errMsg);
                var response = createCustomerRegisterResponse(registration_data, false, errMsg);
                res.status(400);
                res.json(response);

            })  
           
    })
    .catch(function(error){
        cleanup(db);
        var errMsg = "postregisterVisitor: Connected DB Server Failed  tenantId = " + tenantId + " orig_visitor_id =  " + orig_visitor_id + " " + error;
        console.error(errMsg);
        var response = createCustomerRegisterResponse(registration_data, false, errMsg);
        res.status(400);
        res.json(response);


    })
}

//-----------------------------------------------------------------------------
// functions: postunregisterCustomer
// args: register device/user data in the body
// description:mock for the register
// format example:
// {
    
//     "unregistration_data": {
//         "tenant_id": "85",
//         "public_customer_id": "eb3b6e8b-97b3-47fe-9d05-3b134e7e040f",
//         "is_visitor": "false"
//         "android_token": {
//             “device_id”: "2b14fa8b-abcf-4347-aca9-ea3e03be657e"                  
//         }
//     }
// }
//---------------------------------------------------------------------------
exports.postunregisterCustomer = function (req, res) {
    
        var err = undefined;
        var status = undefined;
    
    
        var registerReq = req.body;
        var unregistration_data = registerReq.unregistration_data;
    
    
        if(unregistration_data == undefined)
        {
    
            var errMsg = "postunregisterCustomer:unregistration_data is missing Failed !!!";
            console.error(errMsg);
            var response = createCustomerRegisterResponse(registration_data, false, errMsg);
            res.status(400);
            res.json(response);
            return;
        }
    
        var validationResult = validateCustomerUnRegistrationData(unregistration_data);
        if(validationResult.status == false){
    
            var errMsg = "postregisterCustomer:validateCustomerUnRegistrationData Failed " +validationResult.error;
            console.error(errMsg);
            var response = createCustomerUnRegisterResponse(unregistration_data, false, errMsg);
            res.status(400);
            res.json(response);
            return;
        }
    
        var registrationCollectionName = customersRegistrationCollection  + '_' + unregistration_data.tenant_id;
       
        MongoClient.connect(url)
            .then(function(db){
                console.log("Connected correctly to server");
                status = true;
    
               
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
                    console.error("postregisterCustomer() Failed");
                    var errMsg = "postregisterCustomer: handleCustomerRegistration() Failed tenantId = " + tenantId + " orig_visitor_id =  " + orig_visitor_id + " " + error;
                    console.error(errMsg);
                    var response = createCustomerRegisterResponse(unregistration_data, false, errMsg);
                    res.status(400);
                    res.json(response);
    
                })  
               
        })
        .catch(function(error){
            cleanup(db);
            var errMsg = "postregisterVisitor: Connected DB Server Failed  tenantId = " + tenantId + " orig_visitor_id =  " + orig_visitor_id + " " + error;
            console.error(errMsg);
            var response = createCustomerRegisterResponse(unregistration_data, false, errMsg);
            res.status(400);
            res.json(response);
    
    
        })
    }

    
//-----------------------------------------------------------------------------
// functions: postregisterVisitor
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
//             "token": "152 Bytes",
//                 "os_version": "7.002"
//         }
//     }
// }
// }
//---------------------------------------------------------------------------
exports.postregisterVisitor = function (req, res) {

    var err = undefined;
    var status = undefined;

    var shouldDeleteVisitorDocument = false;
    var registerReq = req.body;
    var registration_data = registerReq.registration_data;


    if(registration_data == undefined)
    {

        var errMsg = "postregisterVisitor:registration_data is missing Failed !!!";
        console.error(errMsg);
        var response = createVisitorRegisterResponse(registration_data, false, errMsg);
        res.status(400);
        res.json(response);
        return;
    }

    var validationResult = validateVisitorRegistrationData(registration_data);
    if(validationResult.status == false){

        var errMsg = "postregisterVisitor:validateVisitorRegistrationData Failed " +validationResult.error;
        console.error(errMsg);
        var response = createVisitorRegisterResponse(registration_data, false, errMsg);
        res.status(400);
        res.json(response);
        return;
    }


    var registrationCollectionName = visitorsRegistrationCollection  + '_' + registration_data.tenant_id;

    MongoClient.connect(url)
        .then(function(db){
            console.log("Connected correctly to server");
            status = true;

            var orig_visitor_id = registration_data.visitor_id;
            var tenantId = registration_data.tenant_id;

            var registrationCollection = db.collection(registrationCollectionName);
            status = findAndDeletExistDocument(db, registrationCollection, tenantId, orig_visitor_id )

                .then(function (status){

                if(status == true) {

                    var resultData = createVisitorRegisterData(registration_data);
                    registrationCollection.insertOne(resultData.data).then(function (r) {
                        console.log("postregisterVisitor: postregisterVisitorMock: Insert One correctly to server");
                        db.close();

                        var response = createVisitorRegisterResponse(registration_data, true, undefined);
                        res.json(response);

                    })
                    .catch(function (error) {
                        cleanup(db);
                        var errMsg = "postregisterVisitor: InsertOne  DB Server Failed tenantId = " + tenantId + " orig_visitor_id =  " + orig_visitor_id + " " +error;
                        console.error(errMsg);
                        var response = createVisitorRegisterResponse(registration_data, false, errMsg);
                        res.status(400);
                        res.json(response);

                    })

                }

            }).catch(function(error){
                cleanup(db);
                console.error("findAndDeletExistDocument() Failed");
                var errMsg = "postregisterVisitor: findAndDeletExistDocument() Failed tenantId = " + tenantId + " orig_visitor_id =  " + orig_visitor_id + " " + error;
                console.error(errMsg);
                var response = createVisitorRegisterResponse(registration_data, false, errMsg);
                res.status(400);
                res.json(response);

                })

        })
        .catch(function(error){
            cleanup(db);
            var errMsg = "postregisterVisitor: Connected DB Server Failed  tenantId = " + tenantId + " orig_visitor_id =  " + orig_visitor_id + " " + error;
            console.error(errMsg);
            var response = createVisitorRegisterResponse(registration_data, false, errMsg);
            res.status(400);
            res.json(response);


        })
};


//-----------------------------------------------------------------------------
// functions: removeVisitorTokenRegistrationDocument
// args: db, tenantId, orig_visitor_id
// description: delete a single document from the visitors collection
//---------------------------------------------------------------------------
    var removeVisitorTokenRegistrationDocument = function(db, tenantId, orig_visitor_id){
        var status = false;
        var visitorCollection = visitorsRegistrationCollection + '_' + tenantId;
        var collection = db.collection(visitorCollection);
        var docId = "tid:" + tenantId + "_vid:" + orig_visitor_id;

        if(collection != undefined){

            status = removeTokenRegistrationDocument(db,collection, docId )

            return status;
        }else{

            console.error("removeVisitorTokenRegistrationDocument: Ccollection = ${collection.toString()} not exist" );
            return status;
        }


    }




//-----------------------------------------------------------------------------
// functions: removeTokenRegistrationDocument
// args: db, collection, id
// description: delete a single document from the collection by given id.
//---------------------------------------------------------------------------
var updateCustomerDocument = function(db, collection, id, document ){

    try{


    }catch(error){
        console.error("failed deletion of collection = ${collection.toString()} document id = ${id}" )
    }

}


//-----------------------------------------------------------------------------
// functions: removeTokenRegistrationDocument
// args: db, collection, id
// description: delete a single document from the collection by given id.
//---------------------------------------------------------------------------
var removeTokenRegistrationDocument = function(db, collection, id ){

    try{
        collection.deleteOne({ "_id" : id });

    }catch(error){
        console.error("failed deletion of collection = ${collection.toString()} document id = ${id}" )
    }

}



//-----------------------------------------------------------------------------
// functions: validateVisitorRegistrationData
// args: registration_data
// description: validate register data..
//---------------------------------------------------------------------------
var validateVisitorRegistrationData = function (registration_data){

    var status = true;
    var err = undefined;

    var validationResult = {status: false, error: undefined};

    if(registration_data.is_visitor == undefined || registration_data.is_visitor == false)
    {
        err = 'validateVisitorRegistrationData: registration_data.is_visitor is missing';
        validationResult.error += "\n" + err;
        console.error(err);

        status = false;
    }


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
// functions: checkDeviceIdExisitinData
// args: devicegroup
// description: validate register data.
//---------------------------------------------------------------------------
var checkDeviceIdExisitinData = function (devicegroup){

    var status = false;
    if(devicegroup != undefined){
        var deviceId =  Object.keys(devicegroup)[0];

        if(deviceId == undefined || devicegroup[deviceId] == undefined){
             err = 'validateCustomerRegistrationData: registration_data device is missing';
             validationResult.error += "\n" + err;
             console.error(err);
     
             status = false;
        }else{
            status = true;
        }
        return status;
     }
}

//-----------------------------------------------------------------------------
// functions: checkDeviceIdExisitinData
// args: devicegroup
// description: validate register data.
//---------------------------------------------------------------------------
var checkDeviceDataExisitinData = function (devicegroup){
    
        var status = false;
        if(devicegroup != undefined){
            var deviceId =  Object.keys(devicegroup)[0];
    
            if(deviceId == undefined){
                 err = 'validateCustomerRegistrationData: registration_data device is missing';
                 validationResult.error += "\n" + err;
                 console.error(err);
         
                 status = false;
            }else{
                status = true;
            }
    
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
    
        var validationResult = {status: false, error: undefined};
    
        if(registration_data.public_customer_id == undefined){
        
            err = 'validateCustomerRegistrationData: registration_data.public_customer_id is missing';
            validationResult.error += "\n" + err;
            console.error(err);
    
            status = false;
        }
    
        if(registration_data.is_visitor == undefined || registration_data.is_visitor == true){        
            err = 'validateCustomerRegistrationData: registration_data.is_visitor is missing';
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
                err = 'validateUnCustomerRegistrationData: registration_data device is missing';
                validationResult.error += "\n" + err;
                console.error(err);
        
                status = false;
            }else{
                if(registration_data.android_token!== undefined){
                    devicegroup = registration_data.android_token;
                }  
                else{
                    devicegroup = registration_data.ios_token;
                }
                    
               var status =  checkDeviceIdExisitinData(devicegroup);
               if( status = false){
                err = 'validateUnCustomerRegistrationData: registration_data device data is missing';
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
        err = 'validateCustomerRegistrationData: unregistration_data.public_customer_id is missing';
        validationResult.error += "\n" + err;
        console.error(err);

        status = false;
    }



    if(unregistration_data.tenant_id == undefined || typeof unregistration_data.tenant_id != 'number')
    {
        err = 'validateVisitorRegistrationData: unregistration_data.tenant_id is missing';
        validationResult.error += "\n" + err;
        console.error(err);

        status = false;
    }

    if(unregistration_data.android_token == undefined && unregistration_data.ios_token== undefined)
        {
            err = 'validateUnCustomerRegistrationData: unregistration_data device is missing';
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
            err = 'validateUnCustomerRegistrationData: unregistration_data device data is missing';
            validationResult.error += "\n" + err;
            status = false;
            console.error(err);
           }
        }
   

    validationResult.status = status;

    return validationResult;
}

//-----------------------------------------------------------------------------
// functions: checkIfVisitorDocumentExist
// args: db, registrationCollection, tenantId, orig_visitor_id
// description: validate document exist for the visitor.
//---------------------------------------------------------------------------
var checkIfVisitorDocumentExist = function(db, registrationCollection, tenantId, orig_visitor_id ){

    var id = "tid:"+ tenantId + "_vid:" + orig_visitor_id;

    registrationCollection.findOne({_id: id}).then( function (foundDocument) {

    }).catch( function(error){
        console.error("checkIfVisitorDocumentExist:  Failed");
        response.send("checkIfVisitorDocumentExist:  Failed Exiting  " );

    })

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
                        
                        console.error("handleCustomerRegistration: checkIfCustomerDocumentExists:  Failed InsertNewCustomerDocument - " + {_id: docId});
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
                   
                }
            })
            .catch(function (error) {
                console.error("handleCustomerRegistration:checkIfCustomerDocumentExists:  Failed Deletion - " + {_id: docId});
                reject(false);
            });
        });
    
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

    var orig_visitor_id = registration_data.visitor_id;
    var tenantId = registration_data.tenant_id;
    var id = "tid:"+ tenantId + "_vid:" + orig_visitor_id;
    data._id = id;
    data.tenant_id  = tenantId;
    if(registration_data.android_token != undefined){
        data.android_token = registration_data.android_token ;
    }else if(registration_data.ios_token != undefined){
        data.android_token = registration_data.ios_token ;
    }

    status.data = data;
    return status;
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
    
        var public_customer_id = registration_data.public_customer_id;
        var tenantId = registration_data.tenant_id;
        var id = "tid:"+ tenantId + "_pcid:" + public_customer_id;
        data._id = id;
        data.tenant_id  = tenantId;

        if(registration_data.android_token != undefined){
            data.android_token = registration_data.android_token ;
        }else if(registration_data.ios_token != undefined){
            data.android_token = registration_data.ios_token ;
        }
            
        status.data = data;
        return status;
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
            registration_response.registration_status.error = error;
        }
    
        return registration_response;
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
