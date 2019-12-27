
const expect    = require('chai').expect;
const Logger    = require('woveon-logger');
// const WovReturn = require('../src/wovreturn');
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
  let sl = null;
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
    let tmodels = [M.ParentModel, M.ChildModel, M.ChildChildModel, M.AssModelP, M.AssModelC, M.MP,
        M.Vehicle, M.Car, M.Tire, M.Wheel, M.ReadInA, M.ReadInB, M.ReadInC, M.ReadInCChild];
    // tmodels.forEach( function(m) { m.l = null; m.cl = null; }); // remove any previous init
    tmodels.forEach( function(m) { m.deinit(); });
    cl = new Service.WovClientLocal(logger, tmodels, C.data('db'));
    sl = new Service.WovStateLayer(logger, [cl]);
    await cl.init(sl, true, true, true);
  });

  describe('> GraphQL tests', async function() {

    /*
    it(`> deRef test : ${__fileloc}`, async function() {
      expect( M.ParentModel.deRef('_a_ref') ).to.be.undefined;
      expect( M.ParentModel.deRef('_assmodelp_ref') ).to.equal(M.AssModelP);
      expect( M.ChildModel.deRef('_parent_ref') ).to.be.undefined;

      expect( M.Car.deRef('_tire_ref') ).to.equal(M.Tire);
      expect( M.Tire.deRef('_car_ref') ).to.equal(M.Car);
      expect( M.Tire.deRef('_wheel_ref') ).to.equal(M.Wheel);
      expect( M.Wheel.deRef('_tire_ref') ).to.equal(M.Tire);

      expect( M.ReadInA.deRef('_named_ref') ).to.equal(M.ReadInB);
      expect( M.ReadInA.deRef('_readinb_ref') ).to.equal(M.ReadInB);

      expect( M.AssModelP.deRef('_parentmodel_ref') ).to.equal(M.ParentModel);

    });
    */

    it(`> ParentModel : ${__fileloc}`, async function() {
      // M.ChildModel.debugme = true;
      // logger.info('Child: ', M.ChildModel);


      // computes them
      /*
      M.ParentModel.debugme     = true;
      M.AssModelP.debugme       = true;
      M.ChildModel.debugme      = true;
      M.ChildChildModel.debugme = true;
      M.AssModelC.debugme       = true;
      M.MP.debugme              = true;
      M.Car.debugme             = true;
      M.Tire.debugme            = true;
      M.Wheel.debugme           = true;
      */
      /*
      M.ReadInA.debugme = true;
      M.ReadInB.debugme = true;
      M.ReadInC.debugme = true;
      M.ReadInCChild.debugme = true;
      logger.h1().info('ReadInA: ', M.ReadInA.getGraphQLSchema());
      */
      /*
      logger.h1().info('ReadInB: ', M.ReadInB.getGraphQLSchema());
      logger.h1().info('ReadInC: ', M.ReadInC.getGraphQLSchema());
      logger.h1().info('ReadInCChild: ', M.ReadInCChild.getGraphQLSchema());
      */
      cl.getGraphQLSchemas();

      for (let k in cl.table2model ) {
        let m = cl.table2model[k];
        logger.h3().info(`Model '${m.name}' :`);
        logger.info('  - ', m._schema);
        logger.info('  - ', m.getGraphQLSchema());
        logger.info('  - ', m._graphQL);
      }

      expect(M.ParentModel._graphQL.vars.length).to.equal(1);
      expect(M.ParentModel._graphQL.objs.length).to.equal(1);
    });
  });
});
