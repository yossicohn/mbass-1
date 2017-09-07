'use strict';
module.exports = function(app) {


    var functions_api = require('../functions/functions-api');

    //  Routes
    app.route('/register-visitor')
    .post(functions_api.postregisterVisitor);
    //  Routes
    app.route('/unregister-visitor')
    .post(functions_api.postunregisterVisitor);

    //  Routes
    app.route('/register-customer')
        .post(functions_api.postregisterCustomer);
        //  Routes
    app.route('/unregister-customer')
    .post(functions_api.postunregisterCustomer);

    app.route('/optinout-customer')
    .post(functions_api.opt_in_out_customer);

    app.route('/optinout-visitor')
    .post(functions_api.opt_in_out_visitor);

}

