'use strict';
module.exports = function(app) {


    var functions_api = require('../functions/functions-api');


    //  Routes
    // app.route('/executeTest')
    //     .post(functions_api.executeTest);

    //  Routes
    // app.route('/executePersonalizedCampaign')
    //     .post(functions_api.executePersonalized);

    //  Routes
    app.route('/scheduleCampaign')
        .post(functions_api.scheduleCampaign);
}
