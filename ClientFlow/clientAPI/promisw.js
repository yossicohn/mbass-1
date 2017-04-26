/**
 * Created by yossi on 05/04/17.
 */



module.exports = function campaignapi(options) {

    var bunyan = require('bunyan');
    var mongoose = require('mongoose');
    var MongoClient = require('mongodb').MongoClient;
    var assert = require('assert');
    var Moment = require('moment');

    var campaign_name2 = 'campaign_name';
    var log = bunyan.createLogger({
        name: 'client-api',

        streams: [
            {
                level: 'info',
                path: 'client-api-logs.log'            // log INFO and above to stdout
            },
            {
                level: 'warn',
                path: 'client-api-logs.log'   // log ERROR and above to a file
            },
            {
                level: 'error',
                path: 'client-api-logs.log'  // log ERROR and above to a file
            }
        ]
    });


    log.info("campaignapi: enter");

    var mongodbPrimaryUrl = '104.198.49.80:27017/';
    var mbassdb = 'mbassdb';
    var url = 'mongodb://' + mongodbPrimaryUrl + mbassdb;

    var campaignSchema = {

        campaign_mode: undefined,
        target_types: undefined,
        tenant_id: undefined,
        campaign_id: undefined,
        action_serial: undefined,
        num_tgt_devices: undefined,
        schedule: undefined,
        time_to_live: undefined
    }


    // Imports the Google Cloud client library
    const PubSub = require('@google-cloud/pubsub');

// Your Google Cloud Platform project ID
    const projectId = 'mobilepush-161510';

    // Instantiates a client
    var pubsubClient = {};

// ------------------------------------------------------------------------
// ----------------------- Create Campaign api ----------------------------
// -------------------------------------------------------------------------
    /**
     * Created by yossi on 25/04/17.
     */
    this.add('role:campaignapi, cmd:create', function (msg, respond) {

        log.info("campaignapi: cmd:create enter");


        var command_name = msg.command_name;
        var campaign_mode = msg.campaign_mode;
        var target_types = msg.target_types;
        var tenant_id = msg.tenant_id;
        var campaign_id = msg.campaign_id;
        var action_serial = msg.action_serial;
        var num_tgt_devices = msg.num_tgt_devices;
        var schedule = msg.schedule;
        var time_to_live = msg.time_to_live;

        var topic_name = 'topic_tid_' + tenant_id + '_cid_' + campaign_id + '_action_serial_' + action_serial;

        var json_response = {
            command_name: command_name,
            tenant_id: tenant_id,
            campaign_id: campaign_id,
            action_serial: action_serial,
            topic_name: undefined,
            schedule: schedule,
            response: "succeeded",
            status: 1,
            error: undefined
        };

        // Creates the new topic
        var topicCreated = undefined;

        function updateSchedulaCampaignInPromisify(db) {
            return new Promise(function (resolve, reject) {

                var campaignsMetaData = 'CampaignsMetaData';
                var collection = db.collection(campaignsMetaData);
                if (collection != undefined) {

                    log.info("campaignapi: cmd:create - updateSchedulaCampaignInPromisify  connected correctly to collection");
                    var id = "campaign_tid:" + tenant_id + "_cpid:" + campaign_id + "_action_serial:" + action_serial;
                    var scheduledDate = new Date(parseInt(msg.schedule));
                    var create_date = new Date();
                    var schedule_date = scheduledDate.toISOString();
                    var status = 1; // 1=scheduled, 2=scheduled, 3=deleted, 4=aborted, 100=error
                    var dbUpdated = false;
                    var tokenDocument = {
                        "_id": id,
                        "create_date": create_date,
                        "campaign_mode": campaign_mode,
                        "target_types": target_types,
                        "tenant_id": tenant_id,
                        "campaign_id": campaign_id,
                        "action_serial": action_serial,
                        "num_tgt_devices": num_tgt_devices,
                        "schedule": msg.schedule,
                        "schedule_date": schedule_date,
                        "time_to_live": time_to_live,
                        "campaign_data": {
                            "content": "1 The quick brown fox jumps over the lazy dog",
                            "title": "CustomView Text Title",
                            "imageurl": "https://s23.postimg.org/vx1yjnjx7/marketing_baby.jpg",
                            "big_imageurl": "https://s27.postimg.org/6ym653mz7/finance_marketer_6501.jpg",
                            "type": "CustomView"
                        },
                        "status": 1,
                        "succeeded_devices": 0,
                        "failed_devices": 0
                    };

                    var promise =  collection.insertOne(tokenDocument);

                }
                else {

                    log.error("campaignapi: cmd:create failed fetch collection CampaignsMetaData");
                    reject("campaignapi: cmd:create failed fetch collection CampaignsMetaData");

                }

            })
        }

        MongoClient.connect(url).then(function (db) {
            updateSchedulaCampaignInPromisify(db)
                .then(function (created) {
                    log.info("campaignapi: cmd:create campaign meta data created successfuly");
                    pubsubClient.createTopic(topic_name)
                        .then(function (result) {
                            log.info("campaignapi: cmd:create topic creaeted topic name =", topic_name);

                            log.info("campaignapi: cmd:create succeeded, Exiting");
                            json_response.error = error.message;
                            json_response.response = "scheduled";
                            json_response.status = 1;
                            json_response.topic_name = topic_name;
                            respond(null, json_response);
                        })
                        .catch(function (error) {
                            json_response.error = error.message;
                            json_response.response = "failed";
                            json_response.status = 100;
                            log.error("campaignapi: cmd:create failed error", error.message);
                            respond(null, json_response);

                        })
                })
                .catch(function (error) {
                    json_response.error = error.message;
                    json_response.response = "failed";
                    json_response.status = 100;
                    log.error("campaignapi: cmd:create failed error", error.message);
                    respond(null, json_response);

                })

        })
            .catch(function (error) {

                json_response.error = error.message;
                json_response.response = "failed";
                json_response.status = 100;
                log.error("campaignapi: cmd:create failed error", error.message);
                respond(null, json_response);
            })


    })


// -------------------------------------------------------------------------
// ------------------------ Create init seneca  ----------------------------
// -------------------------------------------------------------------------
    this.add('init:campaignapi', function (msg, respond) {
        // Instantiates a client

        log.info("init:campaignapi enter");


        pubsubClient = PubSub({
            projectId: projectId
        });

        log.info("init:campaignapi exit");
        respond();
    })

}


