
'use strict';


var MongoClient = require('mongodb').MongoClient;
var assert = require('assert');
var url = 'mongodb://104.198.223.2:27017/mbassdb';
var dbRef = undefined;
//var url = 'mongodb://104.198.223.2:27017,35.202.175.206:27017,146.148.105.234:27017/mbassdb?replicaSet=mbass&slaveOk=true&connectTimeoutMS=2000&socketTimeoutMS=0';

// --------------------- static data ---------------------
var mongoDBOptions = {
    keepAlive: 10000,
    poolSize: 10,
    connectTimeoutMS: 50000
};

var tenantCampaignsDataCollectionNameBase = 'CampaignsData_';
var tenantCustomersTokens = 'CustomersTokens_';
var tenantVisitorsTokens = 'VisitorsTokens_';
var tenantCampaignsDataCollectionNameBase = 'CampaignsData_';



// ----------------------------------------------------------------------------
// ----------------------------------------------------------------
// function: getScheduledCampaign
// args: createReq = campaign details
// return: response campaign document.
// ----------------------------------------------------------------
// ----------------------------------------------------------------
exports.getScheduledCampaign = function (createReq) {

    return new Promise(function (resolve, reject) {
        MongoClient.connect(url, mongoDBOptions)
            .then(function (db) {
                console.log("getScheduledCampaign: Connected correctly to server");
                var status = true;
                var tenantId = createReq.tenant_id;
                var tenantCampaignCollectionName = tenantCampaignsDataCollectionNameBase + tenantId;
                var tenantCampaignsDataCollection = db.collection(tenantCampaignCollectionName);
                var docId = createReq.id;
                tenantCampaignsDataCollection.findOne({
                        _id: docId
                    })
                    .then(function (exisitingDoc) {
                        if (exisitingDoc == null) {
                            reject("Campaign Don't Exisit");
                        } else {
                            resolve({
                                db: db,
                                doc: exisitingDoc
                            });
                        }
                    })
                    .catch(function (error) {
                        console.log("getScheduledCampaign: findOne Failed error= " + error);
                        reject(error);
                    })
            })
            .catch(function (error) {
                console.log("connection Failed error= " + error)
                reject(error);
            })
    });

}


