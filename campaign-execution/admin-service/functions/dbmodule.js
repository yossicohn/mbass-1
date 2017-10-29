'use strict';

var utils = require("./general-utils.js")
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

//-----------------------------------------------------------------------------
// functions: cleanup
// args: db
// description: Clean up.
//---------------------------------------------------------------------------
exports.cleanup = function (db) {
    if (db != undefined) {
        db.close();
        db = undefined;
    }
}

exports.getBaseCustomersCollectionName = function(){
    return tenantCustomersTokens;
}


exports.getBaseVisitorsCollectionName = function(){
    return tenantVisitorsTokens;
}

exports.getBaseCampaignCollectionName = function(){
    return tenantCampaignsDataCollectionNameBase;
}


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
                var docId = utils.getDocId(createReq);
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







// ----------------------------------------------------------------
// function: UpdateCampaignStatus
// args: db, campaignDoc, status
// return: response object. 
// ----------------------------------------------------------------
exports.UpdateCampaignStatus = function (db, campaignDoc, updateMetrics, status) {

        return new Promise(function (resolve, reject) {

            var tenantId = campaignDoc.tenant_id;
            var tenantCampaignCollectionName = tenantCampaignsDataCollectionNameBase + tenantId;
            var tenantCampaignsDataCollection = db.collection(tenantCampaignCollectionName);
            var docId = campaignDoc._id;
            if (status == "completed") {
                var successCount = Number(updateMetrics.successCount);
                var failureCount = Number(updateMetrics.failureCount);
                var numOfDevices = Number(updateMetrics.numOfDevices);
                var numOfTargetedUsers = Number(updateMetrics.numOfTargetedUsers);
            } else {
                var successCount = 0;
                var failureCount = 0;
                var numOfDevices = 0;
                var numOfTargetedUsers = 0;
            }


            tenantCampaignsDataCollection.findOneAndUpdate({
                    _id: docId
                }, {
                    $set: {
                        "campaign_status": status
                    },
                    $inc: {
                        "campaign_stats.successfull_push": successCount,
                        "campaign_stats.failed_push": failureCount,
                        "campaign_stats.numOfTargetedDevices": numOfDevices,
                        "campaign_stats.numOfTargetedUsers": numOfTargetedUsers
                    },
                    $max: {
                        "campaign_stats.push_bulk_size": updateMetrics.bulkSize
                    }
                }, {
                    returnNewDocument: true
                })
                .then(function (exisitingDoc) {
                    if (exisitingDoc == null) {
                        reject("Campaign Don't Exist");
                    } else {
                        resolve(exisitingDoc);
                    }
                })
                .catch(function (error) {
                    console.log(error);
                    reject(error);
                })
        });
    }



// ----------------------------------------------------------------
// function: getUsersBatchDocument
// args:documentsIds, usersCollection
// return: the Documents  by the documentsIds
// ----------------------------------------------------------------
exports.getUsersBatchDocument = function (documentsIds, usersCollection) {
    return new Promise(function (resolve, reject) {
        var usersDocuments = undefined;
        var cursor = usersCollection.find({
            _id: {
                $in: documentsIds //["tid-85-pcid-yossi", "tid-85-pcid-yossi1", "tid-85-pcid-yossi2"] 
            }
        });
        cursor.toArray(function (err, docs) {
            console.log(docs.length)
            usersDocuments = docs;
            docs.forEach(function (doc) {
                console.log("_id = " + doc._id);
            });
            var result = {
                data: usersDocuments,
                status: 1
            }
            resolve(result);
        });
    });

}