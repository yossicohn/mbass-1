**
 * Created by yossi on 05/04/17.
 */

module.exports = function campaignapi(options) {

    var valid_ops = { create:'create', reschedule:'reschedule', abort: 'abort', update: 'update' }


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
            var command_name = msg.command_name;
            var campaign_mode = msg.campaign_mode;
            var target_types = msg.target_types;
            var tenant_id = msg.tenant_id;
            var campaign_id = msg.campaign_id;
            var action_serial = msg.action_serial;
            var num_tgt_devices = msg.num_tgt_devices;
            var schedule = msg.schedule;
            var time_to_live = msg.time_to_live;

            var topic_name = 'topic_tid:' + tenant_id + '_cid:' + campaign_id + '_action_serial:' + action_serial;
            var json_respond = {
                command_name:   command_name,
                tenant_id:              tenant_id,
                campaign_id:    campaign_id,
                action_serial:  action_serial,
                topic_name:     topic_name,
                schedule:               schedule,
                response:               "scheduled"
            }
            respond( null, json_respond )
    })

    this.add('init:campaignapi', function (msg, respond) {
        respond();
    })


}
