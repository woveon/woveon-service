
const expect    = require('chai').expect;
const Logger    = require('woveon-logger');
const WovReturn = require('../src/wovreturn');
const Service   = require('../src/index');
const C         = require('woveon-service').Config;
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
