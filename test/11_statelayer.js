
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

  let modelcl = null;
  let rservcl = null;
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
    modelcl = new Service.WovModelClient(logger, testdb, [TMS.Car, TMS.Tire, TMS.Wheel]);
    rservcl = new Service.WovRemoteServiceClient(logger, [TRS.Store]);
  });


  it('> Create a basic Service Layer', async function() {
    let sl = new Service.WovStateLayer(logger, modelcl, rservcl);
    await sl.init();

    // Make sure models are on the model client
    expect(sl.modelcl.Car).to.not.be.undefined;
    expect(sl.modelcl.Tire).to.not.be.undefined;
    expect(sl.modelcl.Wheel).to.not.be.undefined;
    expect(sl.modelcl.Car.isInited()).to.be.true;
    expect(sl.modelcl.Tire.isInited()).to.be.true;
    expect(sl.modelcl.Wheel.isInited()).to.be.true;

    // Make sure remote services are on the rserv client
    expect(sl.rservcl.Store.isInited()).to.be.true;

  });

});


