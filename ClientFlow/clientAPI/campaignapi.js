/**
 * Created by yossi on 05/04/17.
 */



module.exports = function campaignapi(options) {

    var bunyan = require('bunyan');
    var mongoose = require('mongoose');
    require('mongoose-moment')(mongoose);
    var Moment = require('moment');


    mongoose.set('debug', true); // Console Debug

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



    mongoose.connect('mongodb://104.198.49.80:27017/mbassdb', function(error){
        log.error("campaignapi: Failed Creating mongoose Connection", error);
    })
    mongoose.connection.on('error', function(error){
        respond( null, {status: "failed"} );
        return;
    });


    var Schema = mongoose.Schema,
        ObjectId = Schema.ObjectId;

    var campaignSchema = new Schema({

        campaign_mode        : String,
        target_types         : String,
        tenant_id            : Number,
        campaign_id          : Number,
        action_serial        : Number,
        num_tgt_devices      : Number,
        schedule             : Date,
        time_to_live         : Number
    }, { collection: 'CampaignsMetaData' });





    var campaignsMetaDataModel = mongoose.model('CampaignsMetaData', campaignSchema);

    // Imports the Google Cloud client library
    const PubSub = require('@google-cloud/pubsub');

// Your Google Cloud Platform project ID
    const projectId = 'mobilepush-161510';

    // Instantiates a client
    var pubsubClient = {};


   this.add('role:campaignapi, cmd:create', function (msg, respond) {

       log.info("campaignapi: cmd:create enter");

       var campaign_create_response =
           {
               "command_name": 	"create-campaign",
               "tenant_id": 		"int",
               "campaign_id": 		"int",
               "action_serial": 	"int",
               "topic_name": 	    "topic",
               "schedule": 		"10-10-2017 10:00:00",
               "response": 		"scheduled/failed",
               "error": "campaign already exist"
           };

            var a = new Timestamp(msg.schedule);
            var unixSChedule =  Moment(msg.schedule);
            var command_name = msg.command_name;
            var campaign_mode = msg.campaign_mode;
            var target_types = msg.target_types;
            var tenant_id = msg.tenant_id;
            var campaign_id = msg.campaign_id;
            var action_serial = msg.action_serial;
            var num_tgt_devices = msg.num_tgt_devices;
            var schedule =  msg.schedule;
            var time_to_live = msg.time_to_live;

            var topic_name = 'topic_tid_' + tenant_id + '_cid_' + campaign_id + '_action_serial_' + action_serial;
       // Creates the new topic
       var topicCreated = undefined;

       pubsubClient.createTopic(topic_name)
           .then((results) => {
           const topic = results[0];
       topicCreated = topic;
       console.log(`Topic ${topic.name} created.`);

       var json_respond = {
           command_name:        command_name,
           tenant_id:           tenant_id,
           campaign_id:         campaign_id,
           action_serial:       action_serial,
           topic_name:          topic_name,
           schedule:            schedule,
           response:            "scheduled"
       }


       var currCampaign = new campaignsMetaDataModel({ schedule: new Moment() });

       currCampaign.campaign_mode = msg.campaign_mode;
       currCampaign.target_types = msg.target_types;
       currCampaign.tenant_id = msg.tenant_id;
       currCampaign.campaign_id = msg.campaign_id;
       currCampaign.action_serial = msg.action_serial;
       currCampaign.num_tgt_devices = msg.num_tgt_devices;
       currCampaign.schedule = unixSChedule.toDate();
       currCampaign.time_to_live = msg.time_to_live;
       currCampaign.save();

       if(topicCreated != undefined)
           respond( null, json_respond )



   }).catch(function(error) {

           var json_respond = {
               command_name:   command_name,
               tenant_id:      tenant_id,
               campaign_id:    campaign_id,
               action_serial:  action_serial,
               topic_name:     topic_name,
               schedule:       schedule,
               response:        "failed",
               error:           error.message
           }
           //console.log(`Failed: ${error.message}');
           log.error("campaignapi: cmd:create failed error", error.message);
           respond( null, json_respond );

       });

       log.info("campaignapi: cmd:create exit");

    })

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
