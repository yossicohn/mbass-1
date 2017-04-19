
require('newrelic');
const Seneca = require('seneca')
const SenecaWeb = require('seneca-web')
const Express = require('express')
const seneca = Seneca();

seneca.use(SenecaWeb, {
  context: Express(),
  adapter: require('seneca-web-adapter-express')
})


seneca.ready(() => {
  const app = seneca.export('web/context')()
        app.get('/', function (req, res) {
        res.send('MBASS Client API is Active')
    })
  app.listen(3000)
})

seneca.use(require('./api.js'));
seneca.use(require('./math.js'));
seneca.use(require('./campaignapi.js'));

seneca.add('role:math,cmd:sum', (msg, reply) => {
  reply(null, {answer: (msg.left + msg.right)})
}).listen();
