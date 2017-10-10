
var express = require('express'),
    app = express(),
    port = process.env.PORT || 3001;

var  bodyParser = require('body-parser');

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());


var routes = require('./routes/functions-routes'); //importing route
routes(app); //register the route


app.listen(port);


console.log('**************** MBASS Campaign Execution Service RESTful API server started on: ' + port + ' ****************');