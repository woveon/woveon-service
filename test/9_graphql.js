
const expect    = require('chai').expect;
const Logger    = require('woveon-logger');
// const WovReturn = require('../src/wovreturn');
const Service   = require('../src/index');
const M         = (require('./testmodels'))();
const requireFromString = require('require-from-string');


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
        M.Vehicle, M.Car, M.Tire, M.Wheel, M.ReadInA, M.ReadInB, M.ReadInC, M.ReadInCChild, 
        M.TestModel, M.TestModel2, M.TestModelXID1, M.TestModelXID2];
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


    it(`> Schema Generation: ${__fileloc}`, async function() {
      let ds={dataSources : {statelayer : sl}};
      let d1={
        // id    : 1,
        title : 'tm1',
        xid   : 'DD70F033-A580-47CA-A98D-2E214EAFCE3F',
      };
      let d2={
        // id                 : 2,
        xid                : '3D0AB730-23BD-4BF7-B3BD-38F25262DE8B',
        _testmodelxid1_ref : d1.id,
      };
      let d3={
        title : 'tm1ab',
        xid   : 'ed70f033-a580-47ca-a98d-2e214eafce3f',
      };
      let d4={
        xid                   : '4d0ab730-23bd-4bf7-b3bd-38f25262de8b',
        _testmodelxid1_refXID : d3.xid,
      };

      let tm1  = await M.TestModelXID1.createOne(d1);
      let tm1a = await M.TestModelXID1.getByXID(tm1.get('xid'));
      let tm2  = await M.TestModelXID2.createOne(d2);
      // logger.info('tm2: ', tm2);

      M.TestModelXID1.updateOne(1, {title : 'tm1a'});
      expect((await M.TestModelXID1.getByXID(tm1.get('xid'))).get('title')).to.equal('tm1a');
      M.TestModelXID1.updateOneXID(tm1.get('xid'), {title : 'tm1b'});
      expect((await M.TestModelXID1.getByXID(tm1.get('xid'))).get('title')).to.equal('tm1b');

      let tm1b = await M.TestModelXID1.getByXID(tm1.get('xid'));
      logger.info('tm1b: ', tm1b.get());

      // logger.info('TestModelXID1 schema: ',            M.TestModelXID2.getGraphQLSchema());
      // logger.info('TestModelXID1 resolver: ',          M.TestModelXID2.getGraphQLResolver());
      logger.info('TestModelXID1 schema external: ',   M.TestModelXID2.getGraphQLSchema({external : true}));
      logger.info('TestModelXID1 resolver external: ', M.TestModelXID2.getGraphQLResolver({external : true}));
      // logger.info('TestModelXID1 schema: ',            M.TestModelXID2.getGraphQLSchema());
      // logger.info('TestModelXID1 resolver: ',          M.TestModelXID2.getGraphQLResolver());

      let sc = Service.WovStateLayer.buildGraphQLServer_Schemas(
        Service.entity.mergeServerConfigStrings_Schemas([
          M.TestModelXID1.getGraphQLSchema({external : true}),
          M.TestModelXID2.getGraphQLSchema({external : true}),
        ]));
      console.log('sc:', sc);

      let rc = Service.WovStateLayer.buildGraphQLServer_Resolvers(
        Service.entity.mergeServerConfigStrings_Resolvers([
          M.TestModelXID1.getGraphQLResolver({external : true}),
          M.TestModelXID2.getGraphQLResolver({external : true}),
        ]));
      console.log('rc:', rc);
      let rcc = requireFromString(rc);
      console.log('rcc:', rcc);


      // ===================================================================== 
      // Try calling each resolver function
      // ===================================================================== 

      // --------------------------------------------------------------------- 
      // Query
      // --------------------------------------------------------------------- 
      let tmxid1 = await rcc.Query.getTestModelXID1ByXID(null, {xid : tm1b.get('xid')}, ds);
      expect(tmxid1).to.not.be.null;
      console.log(`tmxid1(${tm1b.get('xid')}): `, tmxid1.get());
      expect(tmxid1.get('xid')).to.equal(tm1b.get('xid'));
      expect(tmxid1.get()).to.deep.equal(tm1b.get());

      let tmxid2 = await rcc.Query.getTestModelXID2ByXID(null, {xid : tm2.get('xid')}, ds);
      expect(tmxid2.get()).to.deep.equal(tm2.get());

      // ---------------------------------------------------------------------
      // Mutation
      // ---------------------------------------------------------------------
      let tm1_3 = await rcc.Mutation.createTestModelXID1(null, {_createThisTestModelXID1 : d3}, ds);
      expect(tm1_3).to.not.be.null;
      console.log(`tm1_3(${tm1_3.wov_model_instance.get('xid')}): `, tm1_3.wov_model_instance.get());
      expect(tm1_3.wov_model_instance.get()).to.include(d3);

      // tm1_4 now references by id, even thought creating with _testmodelxid1_refXID
      let tm1_4 = await rcc.Mutation.createTestModelXID2(null, {_createThisTestModelXID2 : d4}, ds);
      expect(tm1_4).to.not.be.null;
      console.log('tm1_4.wov_model_instance: ', tm1_4.wov_model_instance.get());
      console.log(`tm1_4(${tm1_4.wov_model_instance.get('xid')}): `, tm1_4.wov_model_instance.get());
      expect(tm1_4.wov_model_instance.get('xid')).to.equal(d4.xid);
      expect(tm1_4.wov_model_instance.get('_testmodelxid1_ref')).to.equal(tm1_3.wov_model_instance.get('id'));


      // update, then refetch
      tm1_3 = await rcc.Mutation.updateTestModelXID1(null, {_xid : d3.xid, _updateThisTestModelXID1 : {title : `${d3.title}_updated`}}, ds);
      logger.info('tm1_3: updateTestModelXID1 returned: ', tm1_3);
      expect(tm1_3.xid).to.equal(d3.xid);
      expect(tm1_3.title).to.equal(`${d3.title}_updated`);
      tm1_3 = await rcc.Query.getTestModelXID1ByXID(null, {xid : d3.xid}, ds);
      console.log(`tm1_3: `, tm1_3);
      expect(tm1_3.get('xid')).to.equal(d3.xid);
      expect(tm1_3.get('title')).to.equal(`${d3.title}_updated`);


      result = await rcc.Mutation.deleteTestModelXID2(null, {_xid : d4.xid}, ds);
      logger.info('deleteTestModelXID2: ', result);
      expect(result.xid).to.equal(d4.xid);

//      logger.info('TestModelXID1 mutations: ', M.TestModelXID2.getGraphQLSchema_Mutations({external : true}));
//      logger.info('TestModelXID1 querytypes: ', M.TestModelXID2.getGraphQLSchema_QueryTypes({external : true}));
      // M.TestModelXID2.displayModelConfig();
      // logger.info(M.TestModelXID2._graphQL);
      //

      logger.h1().warn('TODO - Need to call functions using graphql.'); // TODO
    });
  });
});
