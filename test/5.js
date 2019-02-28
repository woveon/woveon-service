


const Service = require('../src/index');
let logger    = new Service.Logger('logger', {debug : true});

let C         = require('../src/config');

logger.info('creating config');

(async function() {
  logger.info('starting to get config');
  await C.blockForInit();
  logger.info('EDITOR: ', C.get('WOV_STAGE'));
})();

new C(new Service.Logger('config', {debug : true}), [], []);

