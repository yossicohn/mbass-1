'use strict';
module.exports = function(app) {


    var functions_api = require('../functions/functions-api');

    //  Routes
    app.route('/register-visitor')
    .post(functions_api.registerVisitor);
    //  Routes
    app.route('/unregister-visitor')
    .post(functions_api.unregisterVisitor);

    //  Routes
    app.route('/register-customer')
        .post(functions_api.registerCustomer);
        //  Routes
    app.route('/unregister-customer')
    .post(functions_api.unregisterCustomer);

    app.route('/optinout-customer')
    .post(functions_api.optInOutCustomer);

    app.route('/optinout-visitor')
    .post(functions_api.optInOutVisitor);

}

