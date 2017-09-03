'use strict';

var MongoClient = require('mongodb').MongoClient
, assert = require('assert');
const uuidV4 = require('uuid/v4');
var url = 'mongodb://104.154.65.252:27017/mbassdb';
var registrationCollection = 'CustomersTokens';

    exports.getregister = function (req, res) {

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
    };

    exports.postregister = function (req, res) {
        var err = undefined;
        var task = {name: 'hello'};
        if (err)
            res.send(err);
        res.json(task);
    };




