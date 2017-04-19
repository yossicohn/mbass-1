/**
 * Created by yossi on 05/04/17.
 */



module.exports = function campaignapi(options) {

    var bunyan = require('bunyan');


    var valid_ops = { create:'create', reschedule:'reschedule', abort: 'abort', update: 'update' }

    // Imports the Google Cloud client library
    const PubSub = require('@google-cloud/pubsub');

// Your Google Cloud Platform project ID
    const projectId = 'mobilepush-161510';

    // Instantiates a client
    var pubsubClient = {};

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

    // request:
    // {
    //     "command_name":      "create_campaign",
    //     "campaign_mode":     "schedule/realtime/retry"
    //     "target_types":      "ios|and|webpush"
    //     "tenant_id":                 "int",
    //     "campaign_id":               "int",
    //     "action_serial":     "int",
    //     "num_tgt_devices":  "int",
    //     "schedule":          "10-10-2017 10:00:00",
    //     "time_to_live":     "X seconds"
    //
    // }
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
       // Creates the new topic
       var topicCreated = undefined;

       pubsubClient.createTopic(topic_name)
           .then((results) => {
           const topic = results[0];
       topicCreated = topic;
       console.log(`Topic ${topic.name} created.`);
       var json_respond = {
           command_name:   command_name,
           tenant_id:              tenant_id,
           campaign_id:    campaign_id,
           action_serial:  action_serial,
           topic_name:     topic_name,
           schedule:               schedule,
           response:               "scheduled"
       }
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
           log.info("campaignapi: cmd:create exit");
           respond( null, json_respond )
       });



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
