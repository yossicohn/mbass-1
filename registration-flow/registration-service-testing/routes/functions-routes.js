'use strict';
module.exports = function(app) {


    var functions_api = require('../functions/functions-api');

    //  Routes
    app.route('/register-visitor')
        .post(functions_api.postregisterVisitor);

    //  Routes
    app.route('/register-customer')
        .post(functions_api.postregisterCustomer);

}

