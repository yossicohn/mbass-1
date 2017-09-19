'use strict';
module.exports = function(app) {


    var functions_api = require('../functions/functions-api');

    //  Routes
    app.route('/create_campaign')
    .post(functions_api.createCampaign);


}

