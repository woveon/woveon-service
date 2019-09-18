
const Service = require('../src/index');
const logger  = new Service.Logger('logger', {debug : true});
const expect  = require('chai').expect;


Service.Config.staticconfig = 1; // avoid error from test/init.js

let mtag='configblock';

describe(`>${mtag}: `, async function() {
  // Service.Config.staticconfig=1;
  // new Service.Config(clogger, [ 'WOV_STAGE' ], [], {blankenvvars : false});
  // let C         = require('../src/config');


  before(async function() {});

  it('blocking config creation', async function() {
    // logger.info('creating config');
    Service.Config.staticconfig=1; // avoid config error for calling in other test cases

    let p = new Promise( async function(_r, _rej) {
      // logger.info('starting to get config');
      await Service.Config.blockForInit();
      expect(typeof Service.Config.get('WOV_STAGE')).to.equal('string');
      // logger.info('EDITOR: ', Service.Config.get('WOV_STAGE'));
      _r(true);
    });

    // logger.info('new config');
    new Service.Config(new Service.Logger('config', {debug : true}), ['WOV_STAGE'], [], {wovtools : false, blankenvvars : false});

    await p;

  });
});


