'use strict';
module.exports = function(app) {


    var functions_api = require('../functions/functions-api');

    //  Routes
    app.route('/register')
        .get(functions_api.getregisterMock)
        .post(functions_api.postregisterVisitorMock);

}

