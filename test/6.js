
const expect    = require('chai').expect;
const Logger    = require('woveon-logger');
const WovReturn = require('../src/wovreturn');
const Service   = require('../src/index');

const express   = require('express');


let mtag ='routetest';

let logger = new Logger(mtag, {
  debug    : true,
  showName : true,
  level    : 'info',
  color    : 'inverse',
}, {
  titles : false,
});

describe(`>${mtag}: `, async function() {

  let clogger = new Logger('config', {debug : true, showName : true, dbCharLen : 40, color : 'bgBlue white'}, {});
  let C = null;

  // setup the service
  before(async function() {
    this.timeout(3000);
    Service.Config.staticconfig=1; // avoid config error for calling in other test cases
    new Service.Config(clogger, [
      'WOV_testdb_type',         // postgres, mongo, etc.
      'WOV_testdb_username',     // ex. 'postgres'
      'WOV_testdb_endpoint',     // 'localhost' for ssh tunneling, AWS db for pod
      'WOV_testdb_database',     // 'woveon' is default
      'WOV_testdb_port',         // ssh tunneling port, or postgres default port 5432
    ],
      ['WOV_testdb_password'], {blankenvvars : false});
    let testdb = null;
    C = Service.Config;

    testdb = new Service.WovDBPostgres('testdb', logger);
    await testdb.connect();
    C.setData('db', testdb);
    /*
    await C.data('db').connect()
      .then(() => { logger.info('  ... db connected'); })
      .catch( (e) => { logger.throwError('  ... db connection error', e.stack); });
      */
  });

  it('listener test', async function() {

    let ser = new Service({
      name   : 'testser',
      port   : 9001, // C.get('WOV_apitest_port'),
      logger : logger,
      db     : C.db,
      ver    : 'v1',
    });

    await ser.init();

    /*
    ser.onRouteAa = (async function(_args, _res) {
      logger.h3().info('ser onRoute /A/:a hit', _args);
      return WovReturn.retSuccess({aa : _args.a});
    });
    ser.listener.onProtect('/A/:a/B', ser.onRouteAa, __filename);
    */
    let rt = express.Router();
    rt.all('/A/:a', async function(_req, res, next) {
      logger.h3().info('****************rt all hit');
      return next();
    });
    ser.listener.app.use('/testser/v1', rt);


    ser.onGetTest = (async function(_args, _res) {
      logger.info('onGetTest: ', _args);
      return WovReturn.retSuccess({});
    });
    ser.listener.onGet('/A/:a', ser.onGetTest, __filename);

    ser.onGetB = (async function(_args, _res) {
      logger.info('onGetB hit: ', _args);
      return WovReturn.retSuccess({});
    });
    ser.listener.onGet('/A/:a/B/:b', ser.onGetB, __filename);


    /*
    ser.listener.app.use('/', function(_req, _res, _next) {
      console.log('asdfasdfas');
      logger.info('------------------------------');
      return next();
    });
      */

    /*
    console.log('app: ', ser.listener.app._router.stack);
    console.log('rt : ', rt.stack);
    console.log('rt in app: ', ser.listener.app._router.stack[ser.listener.app._router.stack.length-1]);
    */

    await ser.startup();

    let r = new Service.Requester(logger, `http://localhost:${ser._options.port}/${ser._options.name}/${ser._options.ver}`);

    let result1 = await r.get(`/health`);
    logger.info('health: ', result1.success, result1.data);
    let result2 = await r.get(`/A/a/B/b`);
    logger.info('result 2: ', result2);

    let result3 = await r.get(`/A/a`);
    logger.info('result 3: ', result3);
    // let baseroute = '/';
    // let l = new Service.Listener(9001, this.logger, null, baseroute, 'listenertest');

    // await ser.onShutdown();
    // await r.get('/shutdown');
  });

  after(async function() {
  });

});
