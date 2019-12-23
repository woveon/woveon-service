
const expect    = require('chai').expect;
const Logger    = require('woveon-logger');
const WR        = require('../src/wovreturn');
const Service   = require('../src/index');
const express   = require('express');

const {ApolloServer, gql} = require('apollo-server-express');
const requireFromString   = require('require-from-string');


const TESTPORT=3010;

const TMS        = (require('./testmodels'))();
const TRS        = (require('./testrmodels'))();


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


  it('> Create a basic State Layer', async function() {
    let tlmodels = [TMS.Vehicle, TMS.Car, TMS.Tire, TMS.Wheel];
    tlmodels.forEach( function(m) { m.l = null; m.cl = null; }); // remove any previous init
    cl  = new Service.WovClientLocal(logger, tlmodels, testdb);
    sl  = new Service.WovStateLayer(logger, [cl]);
    await sl.init();

    // Make sure models are on the model client
    expect(sl.Car).to.not.be.undefined;
    expect(sl._models.car).to.not.be.undefined;
    expect(sl._clients[0].Car).to.not.be.undefined;
    expect(sl.Tire).to.not.be.undefined;
    expect(sl.Wheel).to.not.be.undefined;
    expect(sl.Car.isInited()).to.be.true;
    expect(sl.Tire.isInited()).to.be.true;
    expect(sl.Wheel.isInited()).to.be.true;

    logger.info('Car: ', sl.Car.getGraphQLSchema());
  });

  it(`> Create the GraphQL listener`, async function() {

    // listener = new Service.Listener(TESTPORT, logger, null, null, 'local');
    // await listener.init();

    // resolver code

    // the sl.Car has no client to get the Car
    let mrbase = `
const Logger = require('woveon-logger');
const Query = {

  getCar : async function(_parent, _qargs, {args, dataSources}) { 
    console.log('---- getCar hit ', _qargs); 
    console.log('------ getCar hit w/ parent ', _parent); 
    // console.log('1111', dataSources.sl.Car);
    // console.log('2222', dataSources.sl.Car.cl);
    let car = await dataSources.sl.Car.getByID(_qargs.id);
    console.log('3333: car is :', car.get());
    console.log('4444: car is :', car);
    console.log('5555: car flattened is :', car.flatten());
    return car.flatten();
  },
};
// const Mutation = { };
`;
    let mr = sl.getGraphQLResolvers();
    logger.info(`mr : ${mrbase}\n${mr.modeljs}\n\nmodule.exports = {Query, ${mr.exportsjs}}`);
    let modelresolvers = requireFromString(`${mrbase}\n${mr.modeljs}\n\nmodule.exports = {Query, ${mr.exportsjs}}`);

    // schema code
    let ms = `
type Query {
  getCar(id : ID!) : Car
}

# type Mutation { }

${sl.getGraphQLSchemas()}
`;
    // logger.info('ms : ', ms);

    // logger.info('from example : ', gql`${ms}`);

    // Construct a schema, using GraphQL schema language
    /*
    const typeDefs = gql`
  type Query {
    hello: String
  }
`;

    // Provide resolver functions for your schema fields
    const resolvers = {
      Query: {
        hello: () => 'Hello world!',
      },
    };
    */


    // gqls = new ApolloServer({typeDefs, resolvers});
    gqls = new ApolloServer({
      typeDefs  : ms, // typeDefs, // gql`${ms}`,
      resolvers : modelresolvers, // resolvers, // modelresolvers,
      context   : ({req}) => {
        let retval = {
          httpVersionMajor : req.httpVersionMajor,
          httpVersionMinor : req.httpVersionMinor,
          httpVersion      : req.httpVersion,
          headers          : req.headers,
          rawHeaders       : req.rawHeaders,
          originalUrl      : req.originalUrl,
          args             : Object.assign({}, req.wov, req.params, req.query, req.body),
        };
        return retval;
      },
      dataSources    : () => ({sl : sl}), // TODO this.statelayer (State Layer)
      formatError    : (error) => { logger.error(JSON.stringify(error, null, 2)); return error; },
      formatResponse : (_response, {context}) => {
        logger.aspect('listener.incoming', `Handled  : '${context.originalUrl}' with prot GraphQL: '${context.args.query}'`,
          _response.data);
        /*
        let retval = null;
        if (_response.errors != undefined ) {
          retval = WR.retError(_response.errors);
        }
        else {
          retval = WR.retSuccess(_response.data);
        }
        logger.info('retval : ', retval);
        */
        logger.info('response: ', _response);
        let retval = _response; // .data; // .flatten({keepinstance : false});
        logger.info('retval : ', retval);
        return retval;
      },
    });


    // Connect to listener
    // listener.listen() comes first! before applyMiddleware!
    // await listener.listen();
    listener = {app : express()};
    logger.info('going to apply');
    gqls.applyMiddleware({app : listener.app}); // , path : '/graphql'});

    logger.info('going to listen');
    // listener.listen();
    listener.app.listen({port : TESTPORT}, () => {
      logger.info(`... loaded graphQL on: localhost:${TESTPORT}${gqls.graphqlPath}`);
    });


    // create car
    car = await sl.Car.createOne({
      make      : 'Ford',
      nameplate : 'Fiesta',
      license   : 'A11111',
      state     : 'PA',
      combo     : '1234',
    });
    logger.info('car: ', car.get());

  });


  it('> Create a remote State Layer', async function() {

    rcl = new Service.WovClientRemote(logger, [TRS.Car]); // TRS.Store
    rsl = new Service.WovStateLayer(logger, [rcl]);
    await rsl.init();

    // Make sure remote services are on the rserv client
//    expect(rsl.Store).to.not.be.undefined;
//    expect(rsl._clients[0].Store).to.not.be.undefined;
//    expect(rsl.Store.isInited()).to.be.true;
    expect(rsl.Car).to.not.be.undefined;
    expect(rsl.Car.isInited()).to.be.true;

    // rcl.ms.toMS(NAME) should be called normally
    rcl.ms._baseurl = `http://localhost:${TESTPORT}`;
    logger.h1().info('calling...');
    let result = await rsl.Car.callGraphQL('query', 'Car', car.get('id'), 'nameplate make license state combo');
    logger.info('result: ', JSON.stringify(result, null, 2));
    expect(result.success).to.be.true;
    expect(result.data.data.getCar).to.exist;
    expect(result.data.data.getCar).to.deep.equal((() => { let retval = JSON.parse(JSON.stringify(car.get())); delete retval.id; return retval; })() );
    expect(car.get('id')).to.exist;

  });

  it.skip('> Listen for a bit', async function() {
    await new Promise(function(resolve) {
      setTimeout(resolve, 18000);
    });
  });

});

