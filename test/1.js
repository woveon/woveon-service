
const Service = require('../index');

let ws = new Service('demo', {port : 80, logger : new Service.Logger('logger', {debug : true})});

new Promise(async function(r, j) {
  await ws.init();
  await ws.startup();
});
