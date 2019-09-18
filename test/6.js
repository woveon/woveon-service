
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
  let ser = null;

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
  });

  it('listener test', async function() {

    ser = new Service({
      name   : 'testser',
      port   : 9001, // C.get('WOV_apitest_port'),
      logger : logger,
      db     : C.db,
      ver    : 'v1',
    });

    await ser.init();

    let rt = express.Router(); // eslint-disable-line  new-cap
    rt.all('/A/:a', async function(_req, res, next) {
      // logger.h3().info('****************rt all hit');
      return next();
    });
    ser.listener.app.use('/testser/v1', rt);


    ser.onGetTest = (async function(_args, _res) {
      // logger.info('onGetTest: ', _args);
      return WovReturn.retSuccess('Test');
    });
    ser.listener.onGet('/A/:a', ser.onGetTest, __filename);

    ser.onGetB = (async function(_args, _res) {
      // logger.info('onGetB hit: ', _args);
      return WovReturn.retSuccess({a : _args.a, b : _args.b});
    });
    ser.listener.onGet('/A/:a/B/:b', ser.onGetB, __filename);

    ser.onGetC = new Service.Listener.DocMethod({
      params  : ['a', 'b', 'c'],
      handler : (async function(_args, _res) {
        return WovReturn.retSuccess({a : _args.a, b : _args.b, c : _args.c});
      }),
    });
    ser.listener.onGet('/A/:a/B/:b/C/:c', ser.onGetC, __filename);


    await ser.startup();

    let r = new Service.Requester(logger, `http://localhost:${ser._options.port}/${ser._options.name}/${ser._options.ver}`);
    // logger.info('ser options: ', ser._options);

    let result1 = await r.get(`/pub/health`);
    // logger.info('health: ', result1.success, result1.data);
    expect(result1.success).to.be.true;
    expect(result1.data).to.be.true;

    let result2 = await r.get(`/A/a/B/b`);
    // logger.info('result 2: ', result2);
    expect(result2.success).to.be.true;
    expect(result2.data).to.deep.equal({a : 'a', b : 'b'});

    let result3 = await r.get(`/A/a`);
    // logger.info('result 3: ', result3);
    expect(result3.success).to.be.true;
    expect(result3.data).to.equal('Test');

    // params specificed and will fail
    let result4 = await r.get(`/A/a/B/b/C`);
    // logger.info('result 4: ', result4);
    expect(result4.success).to.be.false;
    result4 = await r.get(`/A/a/B/b/C/c`);
    // logger.info('result 4 again: ', result4);
    expect(result4.success).to.be.true;
    expect(result4.data).to.deep.equal({a : 'a', b : 'b', c : 'c'});


  });

  after(async function() {
    await ser.onShutdown();
  });

});
