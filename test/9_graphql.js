
const expect    = require('chai').expect;
const Logger    = require('woveon-logger');
const WovReturn = require('../src/wovreturn');
const Service   = require('../src/index');
const M         = (require('./testmodels'))();


let mtag ='9_graphql';

let logger = new Logger(mtag, {
  debug    : true,
  showName : true,
  level    : 'info',
  color    : 'inverse',
}, {
  titles : false,
});

describe(`> ${mtag}: `, async function() {
  let cl = null;
  let testdb = null;
  Service.Config.staticconfig=1;
  let clogger = new Logger('config', {debug : true, showName : true, dbCharLen : 40, color : 'bgBlue white'}, {});
  new Service.Config(clogger, [
    'WOV_testdb_type',         // postgres, mongo, etc.
    'WOV_testdb_username',     // ex. 'postgres'
    'WOV_testdb_endpoint',     // 'localhost' for ssh tunneling, AWS db for pod
    'WOV_testdb_database',     // 'woveon' is default
    'WOV_testdb_port',         // ssh tunneling port, or postgres default port 5432
  ],
    ['WOV_testdb_password'], {blankenvvars : false});
  const C = Service.Config;


  // setup the service
  before(async function() {
    this.timeout(3000);

    testdb = new Service.WovDBPostgres('testdb', logger);
    await testdb.connect();
    C.setData('db', testdb);
    /*
    await C.data('db').connect()
      .then(() => { logger.verbose('  ... db connected'); })
      .catch( (e) => { logger.throwError('  ... db connection error', e.stack); });
      */
    cl = new Service.WovModelClient(logger, C.data('db'), [M.ParentModel, M.ChildModel, M.ChildChildModel, M.AssModelP, M.AssModelC, M.MP]);
    await cl.initModelDB(true, true, true);
  });

  describe('> GraphQL tests', async function() {

    it(`> ParentModel : ${__fileloc}`, async function() {
      logger.info(`Parent schema     : \n`, M.ParentModel.getGraphQLSchema());
      logger.info(`Child schema      : \n`, M.ChildModel.getGraphQLSchema());
      logger.info(`ChildChild schema : \n`, M.ChildChildModel.getGraphQLSchema());
      logger.info(`AssModelP schema  : \n`, M.AssModelP.getGraphQLSchema());
      logger.info(`AssModelC schema  : \n`, M.AssModelC.getGraphQLSchema());
      logger.info(`MP schema : \n`, M.MP.getGraphQLSchema());
    });
  });
});
