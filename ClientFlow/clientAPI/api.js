  module.exports = function api(options) {

  var valid_ops = { sum:'sum', product:'product' }

  this.add('role:api,path:calculate', function (msg, respond) {

    var left = msg.left;
    var right = msg.right;
    this.act('role:math', {
      cmd:   'sum',
      left:  left,
      right: right,
    }, respond)
  })



 this.add('role:api,path:campaignapi', function (msg, respond) {

      var command_name =    msg.command_name;
      var campaign_mode =   msg.campaign_mode;
      var target_types =    msg.target_types;
      var tenant_id =       msg.tenant_id;
      var campaign_id =     msg.campaign_id;
      var action_serial =   msg.action_serial;
      var num_tgt_devices = msg.num_tgt_devices;
      var schedule =        msg.schedule;
      var time_to_live =    msg.time_to_live;
      var schedule =        msg.schedule;

      this.act('role:campaignapi', {
          cmd:              'create_campaign2',
          command_name:         command_name,
          tenant_id:            tenant_id,
          campaign_id:      campaign_id,
          action_serial:        action_serial,
          num_tgt_devices:  num_tgt_devices,
          schedule:             schedule,
          time_to_live:     time_to_live
      }, respond)
  })



  this.add('init:api', function (msg, respond) {
    this.act('role:web',{routes:{
      prefix: '/api',
      pin:    'role:api,path:*',
      map: {
        calculate: { GET:true, suffix:'/:operation' }
      }
    }}, respond)
  })

}

