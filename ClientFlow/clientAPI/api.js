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
     var template_name =   msg.template_name;
     var num_tgt_devices = msg.num_tgt_devices;
     var schedule =        msg.schedule;
     var time_to_live =    msg.time_to_live;
      
      switch(command_name){


          case 'create_campaign':

              this.act('role:campaignapi', {
                  cmd:                  command_name,
                  command_name:         command_name,
                  campaign_mode:        campaign_mode,
                  target_types:         target_types,
                  tenant_id:            tenant_id,
                  campaign_id:          campaign_id,
                  action_serial:        action_serial,
                  template_name :       template_name,
                  num_tgt_devices:      num_tgt_devices,
                  schedule:             schedule,
                  time_to_live:         time_to_live
              }, respond)
              break;

          case 'get_campaign_data':


              this.act('role:campaignapi', {
                  cmd:                  command_name,
                  command_name:         command_name,
                  tenant_id:            tenant_id,
                  campaign_id:          campaign_id,
                  action_serial:        action_serial,
                  template_name :       template_name

              }, respond)
              break;

      }

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

