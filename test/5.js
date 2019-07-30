

const Service = require('../src/index');
let logger    = new Service.Logger('logger', {debug : true});

// let C         = require('../src/config');

Service.Config.staticconfig = 1; // avoid error from test/init.js

logger.info('creating config');

(async function() {
  logger.info('starting to get config');
  await Service.Config.blockForInit();
  logger.info('EDITOR: ', C.get('WOV_STAGE'));
})();

logger.info('new config');
new Service.Config(new Service.Logger('config', {debug : true}), [], [], {wovtools : false});

