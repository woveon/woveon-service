
const expect    = require('chai').expect;
const Logger    = require('woveon-logger');
const WR        = require('../src/wovreturn');
const Service   = require('../src/index');
const express   = require('express');

const {ApolloServer, gql} = require('apollo-server-express');
const requireFromString   = require('require-from-string');

const TESTPORT=3010;

const lTMS        = (require('./testmodels'))();
const rTMS        = (require('./testmodels'))();

let mtag ='test150';

let logger = new Logger(mtag, {
  debug    : true,
  showName : true,
  level    : 'info',
  color    : 'inverse',
}, {
  titles : false,
});



describe(`> ${mtag}: `, async function() {

    let sl = null;       // state layer
    let cl = null;       // client
    let rsl = null;      // remote state layer
    let rcl = null;      // remote client
    let gqls = null;     // GraphQL Server
    let car = null;
    let listener = null; // listener for GraphGL Server
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


  it('> Create local and remote state layers', async function() {
    let cardata1 = {
      make      : 'Ford',
      nameplate : 'Fiesta',
      license   : 'A11111',
      state     : 'PA',
      combo     : '1234',
    };
    let cardata2 = {
      make      : 'Mazda',
      nameplate : 'Miata',
      license   : 'B22222',
      state     : 'DE',
      combo     : '5678',
    };
    let lcar1 = null;
    let lcar2 = null;
    let lcar3 = null;
    let rcar2 = null;
    let rcar3 = null;
    let result = null;


    // LocalClient tests
    // ---------------------------------------------------------------------
    lcl = new Service.WovClientLocal(logger, [lTMS.Car, lTMS.Tire, lTMS.Wheel], testdb);
    lsl = new Service.WovStateLayer(logger, [lcl]);
    await lsl.init();
    await lcl.init(lsl, true, true, true);


    // create car 1 : createOne (use this for remote tests)
    lcar1 = await lsl.Car.createOne(cardata1);
    logger.info('local car 1: ', lcar1.get());
    expect((function() { let a = lcar1.get(null, {dup : true}); delete a.id; return a; })()).to.deep.equal(cardata1);
    // expect((function() { let a = JSON.parse(JSON.stringify(lcar1.get())); delete a.id; return a; })()).to.deep.equal(cardata2);

    // getByID returns null if not found
    lcar2 = await lsl.Car.getByID(-1);
    expect(lcar2).to.be.null;

    // create car 2 : createOne (use this for local tests)
    lcar2 = await lsl.Car.createOne(cardata2);
    logger.info('local car 2: ', lcar2.get());
    expect((function() { let a = JSON.parse(JSON.stringify(lcar2.get())); delete a.id; return a; })()).to.deep.equal(cardata2);

    // update car fail : updateOne
    result = await lsl.Car.updateOne(-1, {combo : '6789'});
    // logger.info('updateOne -1 lcar2 result :', result);
    expect(result instanceof Error).to.be.true;

    // update car 2 : updateOne in db, not model
    logger.info('local car 2: ', lcar2.get());
    result = await lsl.Car.updateOne(lcar2.get('id'), {combo : '6789'});
    logger.info(`updateOne lcar2(${lcar2.get('id')}) result object : `, result);
    // logger.info('updateOne lcar2 result type : ', result.constructor.name);
    expect(result instanceof Error).to.be.false;
    expect(lcar2.get('combo')).to.equal('5678');

    // reload and equals updated value
    lcar2 = await lsl.Car.getByID(lcar2.get('id')); // "reload"
    expect(lcar2.get('combo')).to.equal('6789');

    // model set and save
    logger.info('set combo to 9999');
    lcar2.set('combo', '9999');
    result = await lcar2.save();
    logger.info('lcar2 save result : ', result);

    // fetch car 2 as car3 : getByID
    lcar3 = await lsl.Car.getByID(lcar2.get('id'));
    expect(lcar2.get()).to.deep.equal(lcar3.get());

    // fetch array with 1st failing and second returning car2.
    lcar3 = await lsl.Car.getByIDs([-1, lcar2.get('id')]);
    logger.info('local car 3 is array: ', lcar3);
    expect(Array.isArray(lcar3)).to.be.true;
    expect(lcar3[0]).to.be.null;
    expect(lcar2.get()).to.deep.equal(lcar3[1].get());

    // delete car 2/3 : deleteOne
    result = await lsl.Car.deleteByID(lcar2.get('id'));
    logger.info('deleteOne lcar2 result : ', result);
    lcar2 = await lsl.Car.getByID(result.id);
    expect(lcar2).to.be.null;

    // null out 2 and 3, leaving 1 for comparisons
    lcar2 = null;
    lcar3 = null;

    await lsl.startRemotesServer(express(), TESTPORT);


    // RemoteClient tests
    // ---------------------------------------------------------------------
    let msr = new Service.Requester(logger, `http://localhost:${TESTPORT}`);
    rcl = new Service.WovClientRemote(logger, [rTMS.Car, rTMS.Tire, rTMS.Wheel], msr);
    rsl = new Service.WovStateLayer(logger, [rcl]);
    await rsl.init();
    await rcl.init(rsl);


    // cross-local/remote : local car 1 equals to remote car 1
    logger.info('lcar1 id ', lcar1.get('id'));
    rcar1 = await rsl.Car.getByID(lcar1.get('id'));
    logger.info('rcar1 : ', rcar1);
    expect(lcar1.get()).to.deep.equal(rcar1.get());

    // getByID returns null if not found
    rcar2 = await rsl.Car.getByID(-1);
    expect(rcar2).to.be.null;

    logger.h2('test210').aspect('test210', 'create rcar 2 : createOne (use this for remote tests)');
    rcar2 = await rsl.Car.createOne(cardata2);
    logger.info('remote car 2: ', rcar2.get());
    expect((function() { let a = JSON.parse(JSON.stringify(rcar2.get())); delete a.id; return a; })()).to.deep.equal(cardata2);
    expect(rcar2.get('id')).to.not.be.undefined;

    logger.h2('test210').aspect('test210', 'update car fail : updateOne');
    result = await rsl.Car.updateOne(-1, {combo : '6789'});
    // logger.info('updateOne -1 rcar2 result :', result);
    expect(result instanceof Error).to.be.true;

    logger.h2('test210').aspect('test210', '// update rcar 2 : updateOne in db, not model');
    result = await rsl.Car.updateOne(rcar2.get('id'), {combo : '6789'});
    logger.info(`updateOne rcar2(${rcar2.get('id')}) result object : `, result);
    expect(result instanceof Error).to.be.false;
    expect(rcar2.get('combo')).to.equal('5678'); // Model never updated, even though db did

    logger.h2('test210').aspect('test210', '// reload and equals updated value');
    rcar2 = await rsl.Car.getByID(rcar2.get('id')); // "reload"
    expect(rcar2.get('combo')).to.equal('6789');

    logger.h2('test210').aspect('test210', '// model set and save');
    logger.info('set combo to 9999');
    rcar2.set('combo', '9999');
    result = await rcar2.save();
    logger.info('rcar2 save result : ', result);
    expect(result).to.be.true;

    logger.h2('test210').aspect('test210', '// fetch car 2 as car3 : getByID');
    rcar3 = await rsl.Car.getByID(rcar2.get('id'));
    expect(rcar2.get()).to.deep.equal(rcar3.get());

    logger.h2('test210').aspect('test210', '// fetch array with 1st failing and second returning car2.');
    rcar3 = await rsl.Car.getByIDs([-1, rcar2.get('id')]);
    logger.info('remote car 3 is array: ', rcar3);
    expect(Array.isArray(rcar3)).to.be.true;
    expect(rcar3[0]).to.be.null;
    expect(rcar2.get()).to.deep.equal(rcar3[1].get());


    logger.h2('test210').aspect('test210', '// delete car 2/3 : deleteOne');
    result = await lsl.Car.deleteByID(rcar2.get('id'));
    logger.info('deleteOne rcar2 result : ', result);
    rcar2 = await lsl.Car.getByID(result.id);
    expect(lcar2).to.be.null;

    /*
    logger.h1().info('Local Models');
    lTMS.Car.displayModelConfig();

    logger.h1().info('Remote Models');
    rTMS.Car.displayModelConfig();

    logger.h3().info('Car : Local  GraphQL : Resolver');
    logger.info(lTMS.Car.getGraphQLResolver());

    logger.h3().info('Car : Local  GraphQL : Schema');
    logger.info(lTMS.Car.getGraphQLSchema());

    logger.h3().info('Car : Remote GraphQL : Query');
    logger.info(lTMS.Car.getGraphQLSchema_Query_getByID());
    logger.info(lTMS.Car.getGraphQLSchema_Query_getByIDs());
    logger.info(lTMS.Car.getGraphQLSchema_Query_getByXID());
    logger.info(lTMS.Car.getGraphQLSchema_Query_getToMe());

    logger.h3().info('Car : GraphQL data');
    logger.info(lTMS.Car._graphQL);

    logger.h3().info('Car : Remote GraphQL : Mutation');
    logger.info(lTMS.Car.getGraphQLSchema_Mutations());
    */


    // read in remote, from local
    /*
    let rcar = await rsl.Car.getByID(car.get('id'));
    expect(rcar.get()).to.deep.equal(car.get());

    rcar = await rsl.Car.getByIDs([car.get('id')]);
    rcar = rcar[0];
    expect(rcar.get()).to.deep.equal(car.get());

    rcar = await rsl.Car.getByIDs([car.get('id')]);
    rcar = rcar[0];
    expect(rcar.get()).to.deep.equal(car.get());
    */

    // now use remote to test call it
    /*
    rcl.ms._baseurl = `http://localhost:${TESTPORT}`;

    logger.h1().info('calling...');
    let result = await rsl.Car.callGraphQL('query', 'Car', car.get('id'), 'nameplate make license state combo');
    logger.info('result: ', JSON.stringify(result, null, 2));
    */
    /*
    expect(result.success).to.be.true;
    expect(result.data.data.getCar).to.exist;
    expect(result.data.data.getCar).to.deep.equal((() => { let retval = JSON.parse(JSON.stringify(car.get())); delete retval.id; return retval; })() );
    expect(car.get('id')).to.exist;
    */
  });


  // it('> Listen for a bit', async function() { await new Promise(function(resolve) { setTimeout(resolve, 18000); }); });

});
