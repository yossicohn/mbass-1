'use strict';
module.exports = function(app) {


    var functions_api = require('../functions/functions-api');

    //  Routes
    app.route('/create_campaign')
    .post(functions_api.createCampaign);

    app.route('/delete_campaign')
    .post(functions_api.deleteCampaign);

    app.route('/stop_campaign')
        .post(functions_api.stopCampaign);

    app.route('/reschedule_campaign')
        .post(functions_api.rescheduleCampaign);


}

