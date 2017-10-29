'use strict';
module.exports = function (app) {


    var functions_api = require('../functions/functions-api');


    //  Routes
    app.route('/executeCampaign')
        .post(functions_api.executeCampaign);
}