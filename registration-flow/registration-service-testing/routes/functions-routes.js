'use strict';
module.exports = function(app) {


    var functions_api = require('../functions/functions-api');

    //  Routes
    app.route('/register')
        .get(functions_api.getregister)
        .post(functions_api.postregister);

}

