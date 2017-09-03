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
// functions: postregisterMock
// args: register device/user data in the body
// description:mock for the register
// format example:
//{
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
    exports.postregisterMock = function (req, res) {
        var err = undefined;
        // var task = {name: 'hello'};
        // if (err)
        //     res.send(err);
        // res.json(task);

        var shouldDeleteVisitorDocument = false;
        var registerReq = req.body;
        var registration_data = registerReq.registration_data;
        if(registration_data == undefined)
        {
            err = 'registration_data is missing';
            res.status(400);
            res.send(err);
            return;
        }

        MongoClient.connect(url)
            .then(function(db){
                console.log("Connected correctly to server");

                var is_visitor = registration_data.is_visitor;
                if(is_visitor == false || is_visitor == undefined){
                    var is_conversion = registration_data.is_conversion
                    ;
                    if(is_conversion == true && registration_data.orig_visitor_id != undefined){

                        var orig_visitor_id = registration_data.orig_visitor_id;
                        var tenantId = registration_data.tenant_id;


                        if(shouldDeleteVisitorDocument == true){

                            removeVisitorTokenRegistrationDocument(db, tenantId, orig_visitor_id);
                        }

                    }
                }else{
                    console.warn("postregisterMock:  no visitor  conversion data" );
                }

                var collection = db.collection(registrationCollection);
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
// functions: postregisterVisitorMock
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
exports.postregisterVisitorMock = function (req, res) {

    var err = undefined;
    var status = undefined;

    var shouldDeleteVisitorDocument = false;
    var registerReq = req.body;
    var registration_data = registerReq.registration_data;


    if(registration_data == undefined)
    {
        err = 'registration_data is missing';
        res.status(400);
        res.send(err);
        return;
    }

    var isValid = validateVisitorRegistrationData(registration_data);
    if(isValid == false){

        err = 'registration_data is not valid';
        res.status(400);
        res.send(err);
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
                        console.log("postregisterVisitorMock: Insert One correctly to server");
                        db.close();
                        res.send("postregisterVisitorMock: registerDeviceTokenMocPrimised: Connected succeeded ");

                    })
                    .catch(function (error) {
                        console.error("postregisterVisitorMock: InsertOne  DB Server Failed tenantId = " + tenantId + " orig_visitor_id =  " + orig_visitor_id);
                        res.send("postregisterVisitorMock: registerDeviceTokenMocPrimised: Connected Failed Exiting  ");

                    })

                }


            }).catch(function(error){
                console.error("Connected DB Server Failed");
                    res.send("registerDeviceTokenMocPrimised: Connected Failed Exiting  " );

            })

        })
        .catch(function(error){
            console.error("Connected DB Server Failed");
            res.send("registerDeviceTokenMocPrimised: Connected Failed Exiting  " );

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
    if(registration_data.is_visitor == undefined || registration_data.is_visitor == false)
    {
        err = 'validateVisitorRegistrationData: registration_data.is_visitor is missing';
        console.error(err);

        status = false;
    }


    if(registration_data.tenant_id == undefined || typeof registration_data.tenant_id != 'number')
    {
        err = 'validateVisitorRegistrationData: registration_data.tenant_id is missing';
        console.error(err);

        status = false;
    }


    if(registration_data.visitor_id == undefined)
    {
        err = 'validateVisitorRegistrationData: registration_data.public_customer_id is missing';
        console.error(err);

        status = false;
    }


    if(registration_data.android_token == undefined && registration_data.ios_token == undefined  )
    {
        err = 'validateVisitorRegistrationData: registration_data.android_token || ios_token  is missing';
        console.error(err);

        status = false;
    }else{

    }


    if(registration_data.is_visitor == undefined || registration_data.is_visitor == false)
    {
        err = 'validateVisitorRegistrationData: registration_data.is_visitor is missing';
        console.error(err);

        status = false;
    }

    return status;

}



//-----------------------------------------------------------------------------
// functions: validateCustomerRegistrationData
// args: registration_data
// description: validate register data.
//---------------------------------------------------------------------------
var validateCustomerRegistrationData = function (registration_data){

     var status = true;

    var err = undefined;

    if(registration_data.is_visitor == undefined || registration_data.is_visitor == false)
    {
        err = 'validateVisitorRegistrationData: registration_data.is_visitor is missing';
        console.error(err);

        status = false;
    }


    if(registration_data.tenant_id == undefined || typeof registration_data.tenant_id != 'Number')
    {
        err = 'validateVisitorRegistrationData: registration_data.tenant_id is missing';
        console.error(err);

        status = false;
    }


    if(registration_data.public_customer_id == undefined)
    {
        err = 'validateVisitorRegistrationData: registration_data.public_customer_id is missing';
        console.error(err);

        status = false;
    }


    if(registration_data.android_token == undefined && registration_data.ios_token == undefined  )
    {
        err = 'validateVisitorRegistrationData: registration_data.android_token || ios_token  is missing';
        console.error(err);

        status = false;
    }else{

    }

    return status;
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
            response.send("findAndDeletExistDocument:  Failed Exiting  ");
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
    }

    var status = {status: true, data:undefined};


    var orig_visitor_id = registration_data.visitor_id;
    var tenantId = registration_data.tenant_id;
    var id = "tid:"+ tenantId + "_vid:" + orig_visitor_id;
    data._id = id;
    data.tenant_id  = tenantId;
    data.android_token = registration_data.android_token ;

    status.data = data;
    return status;
}