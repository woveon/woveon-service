
const expect    = require('chai').expect;
const Logger    = require('woveon-logger');
// const WR        = require('../src/wovreturn');
const Service   = require('../src/index');

// const {ApolloServer, gql} = require('apollo-server-express');
// const requireFromString   = require('require-from-string');

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

  let listener = null;
  let lsl = null;      // remote state layer
  let lcl = null;      // remote client
  let rsl = null;      // remote state layer
  let rcl = null;      // remote client
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
    listener = new Service.Listener(TESTPORT, logger, null, '/testing');
    await listener.init();
  });


  it(`> ${mtag} : GraphQL generation and initing`, async function() {
    let cardata = {
      make      : 'Honda',
      nameplate : 'Pilot',
      license   : 'Z55555',
      state     : 'GA',
      combo     : '1234',
      numtires  : 4,
    };

    // deinit models, client and state layer, and delete db tables
    [lTMS.Vehicle, lTMS.Car, lTMS.Tire, lTMS.Wheel].forEach( function(m) { m.l = null; m.cl = null; });
    lcl = new Service.WovClientLocal(logger, [lTMS.Vehicle, lTMS.Car, lTMS.Tire, lTMS.Wheel], testdb);
    lsl = new Service.WovStateLayer(logger, [lcl]);
    await lsl.init({drop : true}); // drops and recreates all model tables in the db
    [lTMS.Vehicle, lTMS.Car, lTMS.Tire, lTMS.Wheel].forEach( function(m) { m.l = null; m.cl = null; });
    lcl = null;
    lsl = null;


    // fails because no client
    try {
      await lTMS.Car.createOne(cardata);
      throw Error(`Should have failed here since model's client is not created`);
    }
    catch (e) {}


    // create client but without Vehicle, the parent of Car
    lcl = new Service.WovClientLocal(logger, [lTMS.Car, lTMS.Tire, lTMS.Wheel], testdb);
    try {
      await lTMS.Car.createOne(cardata);
      throw Error(`Should have failed here since Car's parent Vehicle was not inited`);
    }
    catch (e) {}

    // Now fails since no state layer
    try {
      lcl = new Service.WovClientLocal(logger, [lTMS.Vehicle, lTMS.Car, lTMS.Tire, lTMS.Wheel], testdb);
      lTMS.Car.getGraphQLSchema();
      throw Error(`Should have failed here since the client will call getModel on state layer that does not exist.`);
    }
    catch (e) {}

    // deinit models
    [lTMS.Vehicle, lTMS.Car, lTMS.Tire, lTMS.Wheel].forEach( function(m) { m.l = null; m.cl = null; });


    // greater spew on these models
    // lTMS.Vehicle.debugme = true;
    // lTMS.Car.debugme = true;
    // lTMS.Tire.debugme = true;

    lcl = new Service.WovClientLocal(logger, [lTMS.Vehicle, lTMS.Car, lTMS.Tire, lTMS.Wheel], testdb);
    lsl = new Service.WovStateLayer(logger, [lcl]);
    await lsl.init();
    // NOTE: should pass even though state layer is not inited

    // schema
    let s_v = lTMS.Vehicle.getGraphQLSchema();
    // logger.info('Vehicle schema: ', s_v);
    // logger.info('Vehicle_graphQL', lTMS.Vehicle._graphQL);
    expect(lTMS.Vehicle._graphQL.vars.length).to.equal(1);

    let s_t = lTMS.Tire.getGraphQLSchema();
    // logger.info('Tire schema: ', s_t);
    // logger.info('Tire _graphQL', lTMS.Tire._graphQL);
    expect(lTMS.Tire._graphQL.vars.length).to.equal(4);

    let s_c = lTMS.Car.getGraphQLSchema();
    // logger.info('Car has own', lTMS.Car.hasOwnProperty('_graphQL'));
    // logger.info('Car schema: ', s_c);
    // logger.info('Car _graphQL', lTMS.Car._graphQL);
    expect(lTMS.Car._graphQL.vars.length).to.equal(5);


    // deinit and try all again, with order of modls changed

    [lTMS.Vehicle, lTMS.Car, lTMS.Tire, lTMS.Wheel].forEach( function(m) { m.l = null; m.cl = null; });
    lcl = new Service.WovClientLocal(logger, [lTMS.Car, lTMS.Vehicle, lTMS.Tire, lTMS.Wheel], testdb);
    lsl = new Service.WovStateLayer(logger, [lcl]);
    await lsl.init();

    // schema
    s_v = lTMS.Vehicle.getGraphQLSchema();
    // logger.info('Vehicle schema: ', s_v);
    // logger.info('Vehicle_graphQL', lTMS.Vehicle._graphQL);
    expect(lTMS.Vehicle._graphQL.vars.length).to.equal(1);

    s_t = lTMS.Tire.getGraphQLSchema();
    // logger.info('Tire schema: ', s_t);
    // logger.info('Tire _graphQL', lTMS.Tire._graphQL);
    expect(lTMS.Tire._graphQL.vars.length).to.equal(4);

    s_c = lTMS.Car.getGraphQLSchema();
    // logger.info('Car has own', lTMS.Car.hasOwnProperty('_graphQL'));
    // logger.info('Car schema: ', s_c);
    // logger.info('Car _graphQL', lTMS.Car._graphQL);
    expect(lTMS.Car._graphQL.vars.length).to.equal(5);

  });

  it('> Create local and remote state layers', async function() {
    let cardata1 = {
      make      : 'Ford',
      nameplate : 'Fiesta',
      license   : 'A11111',
      state     : 'PA',
      combo     : '1234',
      numtires  : 4,
    };
    let cardata2 = {
      make      : 'Mazda',
      nameplate : 'Miata',
      license   : 'B22222',
      state     : 'DE',
      combo     : '5678',
      numtires  : 4,
    };
    let lcar1 = null;
    let lcar2 = null;
    let lcar3 = null;
    let rcar2 = null;
    let rcar3 = null;
    let result = null;


    // LocalClient tests
    // ---------------------------------------------------------------------
    [lTMS.Vehicle, lTMS.Car, lTMS.Tire, lTMS.Wheel].forEach( function(m) { m.l = null; m.cl = null; });
    lcl = new Service.WovClientLocal(logger, [lTMS.Car, lTMS.Tire, lTMS.Wheel], testdb);
    lsl = new Service.WovStateLayer(logger, [lcl]);
    await lsl.init({drop : true});


    // create car 1 : createOne (use this for remote tests)
    lcar1 = await lsl.Car.createOne(cardata1);
    // logger.info('local car 1: ', lcar1.get());
    expect((function() { let a = lcar1.get(null, {dup : true}); delete a.id; return a; })()).to.deep.equal(cardata1);
    // expect((function() { let a = JSON.parse(JSON.stringify(lcar1.get())); delete a.id; return a; })()).to.deep.equal(cardata2);

    // getByID returns null if not found
    lcar2 = await lsl.Car.getByID(-1);
    expect(lcar2).to.be.null;

    // create car 2 : createOne (use this for local tests)
    lcar2 = await lsl.Car.createOne(cardata2);
    // logger.info('local car 2: ', lcar2.get());
    expect((function() { let a = JSON.parse(JSON.stringify(lcar2.get())); delete a.id; return a; })()).to.deep.equal(cardata2);

    // update car fail : updateOne
    result = await lsl.Car.updateOne(-1, {combo : '6789'});
    // logger.info('updateOne -1 lcar2 result :', result);
    expect(result instanceof Error).to.be.true;

    // update car 2 : updateOne in db, not model
    // logger.info('local car 2: ', lcar2.get());
    result = await lsl.Car.updateOne(lcar2.get('id'), {combo : '6789'});
    // logger.info(`updateOne lcar2(${lcar2.get('id')}) result object : `, result);
    // logger.info('updateOne lcar2 result type : ', result.constructor.name);
    expect(result instanceof Error).to.be.false;
    expect(lcar2.get('combo')).to.equal('5678');

    // reload and equals updated value
    lcar2 = await lsl.Car.getByID(lcar2.get('id')); // "reload"
    expect(lcar2.get('combo')).to.equal('6789');

    // model set and save
    // logger.info('set combo to 9999');
    lcar2.set('combo', '9999');
    result = await lcar2.save();
    // logger.info('lcar2 save result : ', result);

    // fetch car 2 as car3 : getByID
    lcar3 = await lsl.Car.getByID(lcar2.get('id'));
    expect(lcar2.get()).to.deep.equal(lcar3.get());

    // fetch array with 1st failing and second returning car2.
    lcar3 = await lsl.Car.getByIDs([-1, lcar2.get('id')]);
    // logger.info('local car 3 is array: ', lcar3);
    expect(Array.isArray(lcar3)).to.be.true;
    expect(lcar3[0]).to.be.null;
    expect(lcar2.get()).to.deep.equal(lcar3[1].get());

    // delete car 2/3 : deleteOne
    result = await lsl.Car.deleteByID(lcar2.get('id'));
    // logger.info('deleteOne lcar2 result : ', result);
    lcar2 = await lsl.Car.getByID(result.id);
    expect(lcar2).to.be.null;

    // null out 2 and 3, leaving 1 for comparisons
    lcar2 = null;
    lcar3 = null;

    // await lsl.startRemotesServer(express(), TESTPORT);
    await lsl.initProtServer(listener);
    await listener.listen();


    // RemoteClient tests
    // ---------------------------------------------------------------------
    let msr = new Service.Requester(logger, `http://localhost:${TESTPORT}${listener.root}/prot/graphql`);
    rcl = new Service.WovClientRemote(logger, [rTMS.Car, rTMS.Vehicle, rTMS.Tire, rTMS.Wheel], msr);
    rsl = new Service.WovStateLayer(logger, [rcl]);
    await rsl.init();


    // cross-local/remote : local car 1 equals to remote car 1
    // logger.info('lcar1 id ', lcar1.get('id'));
    // logger.info('Car Schema: ', rsl.Car.getGraphQLSchema());
    rcar1 = await rsl.Car.getByID(lcar1.get('id'));
    // logger.info('lcar1 : ', lcar1.get());
    // logger.info('rcar1 : ', rcar1);
    // logger.info('rcar1 : ', rcar1.get());
    expect(lcar1.get()).to.deep.equal(rcar1.get());

    // getByID returns null if not found
    rcar2 = await rsl.Car.getByID(-1);
    expect(rcar2).to.be.null;

    logger.h2('test210').aspect('test210', 'create rcar 2 : createOne (use this for remote tests)');
    rcar2 = await rsl.Car.createOne(cardata2);
    // logger.info('remote car 2: ', rcar2.get());
    expect((function() { let a = JSON.parse(JSON.stringify(rcar2.get())); delete a.id; return a; })()).to.deep.equal(cardata2);
    expect(rcar2.get('id')).to.not.be.undefined;

    logger.h2('test210').aspect('test210', 'update car fail : updateOne');
    result = await rsl.Car.updateOne(-1, {combo : '6789'});
    // logger.info('updateOne -1 rcar2 result :', result);
    expect(result instanceof Error).to.be.true;

    logger.h2('test210').aspect('test210', '// update rcar 2 : updateOne in db, not model');
    result = await rsl.Car.updateOne(rcar2.get('id'), {combo : '6789'});
    // logger.info(`updateOne rcar2(${rcar2.get('id')}) result object : `, result);
    expect(result instanceof Error).to.be.false;
    expect(rcar2.get('combo')).to.equal('5678'); // Model never updated, even though db did

    logger.h2('test210').aspect('test210', '// reload and equals updated value');
    rcar2 = await rsl.Car.getByID(rcar2.get('id')); // "reload"
    expect(rcar2.get('combo')).to.equal('6789');

    logger.h2('test210').aspect('test210', '// model set and save');
    // logger.info('set combo to 9999');
    rcar2.set('combo', '9999');
    result = await rcar2.save();
    // logger.info('rcar2 save result : ', result);
    expect(result).to.be.true;

    logger.h2('test210').aspect('test210', '// fetch car 2 as car3 : getByID');
    rcar3 = await rsl.Car.getByID(rcar2.get('id'));
    expect(rcar2.get()).to.deep.equal(rcar3.get());

    logger.h2('test210').aspect('test210', '// fetch array with 1st failing and second returning car2.');
    rcar3 = await rsl.Car.getByIDs([-1, rcar2.get('id')]);
    // logger.info('remote car 3 is array: ', rcar3);
    expect(Array.isArray(rcar3)).to.be.true;
    expect(rcar3[0]).to.be.null;
    expect(rcar2.get()).to.deep.equal(rcar3[1].get());


    logger.h2('test210').aspect('test210', '// delete car 2/3 : rsl.Car.deleteByID(', rcar2.get('id'), ')');
    // logger.aspect('test210', '// Car', Object.getOwnPropertyNames(Object.getPrototypeOf(rsl.Car)));
    result = await rsl.Car.deleteByID(rcar2.get('id'));
    // logger.info('deleteOne rcar2 result : ', JSON.stringify(result, null, 2));
    expect(result.success).to.be.true;
    expect(parseInt(result.data.data.deleteCar.id)).to.equal(rcar2.get('id'));
    rcar2 = await rsl.Car.getByID(result.data.data.deleteCar.id);
    expect(rcar2).to.be.null;


    //  ----------------

    logger.h2('test210').aspect('test210', 'get car with only license');
    rcar2 = await rsl.Car.getByID(lcar1.get('id'), 'license');
    // logger.info('rcar2: ', rcar2.get());
    expect(rcar2.get()).to.deep.equal({id : lcar1.get('id'), license : lcar1.get('license')});

    logger.h2('test210').aspect('test210', 'create some tires');
    await lTMS.Tire.createOne({brand : 'Michelin', model : '1', position : 'FL', wear : '.76', _car_ref : rcar2.get('id')});
    await lTMS.Tire.createOne({brand : 'Michelin', model : '1', position : 'FR', wear : '.78', _car_ref : rcar2.get('id')});
    await lTMS.Tire.createOne({brand : 'Michelin', model : '1', position : 'RL', wear : '.86', _car_ref : rcar2.get('id')});
    await lTMS.Tire.createOne({brand : 'Michelin', model : '1', position : 'RR', wear : '.91', _car_ref : rcar2.get('id')});



    logger.h2('test210').aspect('test210', 'use graphql directly and query tires of car');
    result = await rcl.msr.post('/graphql', null, {query : `query { getCarByID(id : ${lcar1.get('id')}) { id tires { id } } }`});
    // logger.info('result: ', JSON.stringify(result, null, '  '));
    // logger.info('result.data: ', result.data);
    expect(result.data.data.getCarByID).to.deep.equal({id : '2', tires : [{id : '1'}, {id : '2'}, {id : '3'}, {id : '4'}] });

    logger.h2('test210').aspect('test210', '// fetch car with model with tires');
    rcar2 = await rsl.Car.getByID(rcar2.get('id'), 'id tires { id }');
    // logger.info('rcar2 with tires: ', rcar2.get());
    expect(rcar2.get()).to.deep.equal({id : 2, tires : [{id : '1'}, {id : '2'}, {id : '3'}, {id : '4'}] });

    logger.h2('test210').aspect('test210', '// fetch car then tires');
    rcar2 = await rsl.Car.getByID(rcar2.get('id'));
    // logger.info('rcar2 : ', rcar2.get());
    await rcar2.readIn('Tire');
    // logger.info('rcar2.get : ', rcar2.get());
    // logger.info('rcar2 : ', rcar2);
    expect(rcar2.tires).to.not.be.undefined;
    expect(rcar2.tires.length).to.equal(4);
//     expect(rcar2.get()).to.deep.equal({id : 2, tires : [{id : '1'}, {id : '2'}, {id : '3'}, {id : '4'}] });
    //
    let w0 = await lTMS.Wheel.createOne({style : 'chrome', _tire_ref : rcar2.tires.pos(0).get('id')});
    await lTMS.Wheel.createOne({style : 'chrome', _tire_ref : rcar2.tires.pos(1).get('id')});
    await lTMS.Wheel.createOne({style : 'chrome', _tire_ref : rcar2.tires.pos(2).get('id')});
    await lTMS.Wheel.createOne({style : 'chrome', _tire_ref : rcar2.tires.pos(3).get('id')});

    // logger.info('w0 : ', w0.get());

    logger.h2('test210').aspect('test210', '// fetch car tires\' wheels');
    await rcar2.tires.readIn('Wheel');
    // logger.info('rcar2.tires: ', rcar2.tires);
    // logger.info('rcar2.tires.pos(0).wheel: ', rcar2.tires.pos(0).wheel);
    // logger.info('rcar2.tires.pos(0).get: ', rcar2.tires.pos(0).get());
    // logger.info('rcar2.tires.pos(0).wheel.get: ', rcar2.tires.pos(0).wheel.get());
    // logger.info('w0 2: ', w0.get());

    /*
    logger.info('rcar2.tires.pos(0).wheel: ', rcar2.tires.pos(0).wheel);
    logger.info('rcar2.tires.pos(0).wheel: ', rcar2.tires.pos(0).wheel);
    expect(rcar2.tires.pos(0).wheel.get('_tire_ref')).  to.equal(rcar2.tires.pos(0).get('id'));
    expect(rcar2.tires.pos(1).wheel.get('_tire_ref')).to.equal(rcar2.tires.pos(1).get('id'));
    expect(rcar2.tires.pos(2).wheel.get('_tire_ref')).to.equal(rcar2.tires.pos(2).get('id'));
    expect(rcar2.tires.pos(3).wheel.get('_tire_ref')).to.equal(rcar2.tires.pos(3).get('id'));
    */
    await rcar2.tires.pos(0).wheel.readIn('Tire');
    // logger.info('rcar2.tires.pos(0).wheel: ', rcar2.tires.pos(0).wheel);
    // logger.info('rcar2.tires.pos(0).wheel.tire: ', rcar2.tires.pos(0).wheel.tire);
    expect(rcar2.tires.pos(0).wheel.tire.get('id')).to.equal(rcar2.tires.pos(0).get('id'));

  });

  // it('> Listen for a bit', async function() { await new Promise(function(resolve) { setTimeout(resolve, 18000); }); });

});
