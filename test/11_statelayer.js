
const expect    = require('chai').expect;
const Logger    = require('woveon-logger');
const WovReturn = require('../src/wovreturn');
const Service   = require('../src/index');

const TMS        = (require('./testmodels'))();
const TRS        = (require('./testrservs'))();


let mtag ='11_statelayer';

let logger = new Logger(mtag, {
  debug    : true,
  showName : true,
  level    : 'info',
  color    : 'inverse',
}, {
  titles : false,
});

describe(`> ${mtag}: `, async function() {

  let testdb = null;
  let clogger = new Logger('config', {debug : true, showName : true, dbCharLen : 40, color : 'bgBlue white'}, {});
  Service.Config.staticconfig=1;

  new Service.Config(clogger, [
    'WOV_testdb_type',         // postgres, mongo, etc.
    'WOV_testdb_username',     // ex. 'postgres'
    'WOV_testdb_endpoint',     // 'localhost' for ssh tunneling, AWS db for pod
    'WOV_testdb_database',     // 'woveon' is default
    'WOV_testdb_port',         // ssh tunneling port, or postgres default port 5432
  ],
    ['WOV_testdb_password'], {blankenvvars : false});


  // setup the service
  before(async function() {
    this.timeout(3000);
    testdb = new Service.WovDBPostgres('testdb', logger);
    await testdb.connect();
  });


  it('> Create a basic Service Layer', async function() {
    let modelcl = new Service.WovModelClient(logger, testdb, [TMS.Car, TMS.Tire, TMS.Wheel]);
    let rservcl = new Service.WovRemoteModelClient(logger, [TRS.Store]);
    let sl      = new Service.WovStateLayer(logger, [ modelcl, rservcl ]);
    await sl.init();

    // Make sure models are on the model client
    expect(sl.Car).to.not.be.undefined;
    expect(sl.clients[0].Car).to.not.be.undefined;
    expect(sl.Tire).to.not.be.undefined;
    expect(sl.Wheel).to.not.be.undefined;
    expect(sl.Car.isInited()).to.be.true;
    expect(sl.Tire.isInited()).to.be.true;
    expect(sl.Wheel.isInited()).to.be.true;

    // Make sure remote services are on the rserv client
    expect(sl.Store).to.not.be.undefined;
    expect(sl.clients[1].Store).to.not.be.undefined;
    expect(sl.Store.isInited()).to.be.true;

  });

});


