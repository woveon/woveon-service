
const expect    = require('chai').expect;
const Logger    = require('woveon-logger');
const WovReturn = require('../src/wovreturn');
const Service   = require('../src/index');
const M         = (require('./testmodels'))();
const addContext = require('mochawesome/addContext');


const {WovDBPostgres} = require('../src/wovdb');


let mtag ='7c_model';

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
  let sl = null;
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

  // setup the service
  before(async function() {
    this.timeout(3000);

    testdb = new WovDBPostgres('testdb', logger);
    await testdb.connect();
    cl = new Service.WovModelClient(logger, testdb, [M.SingularTestA, M.SingularTestB, M.SingularTestC]);
    sl = new Service.WovStateLayer(logger, [cl]);
    await cl.init(sl, true, true, true);
  });

  describe('> WovModel Singular from Test', async function() {
    let a = null;
    let b = null;
    let c = null;

    it(`> singular readIn test : ${__fileloc}`, async function() {
      a  = await M.SingularTestA.createOne({name : 'a'}); // id 1
      a1 = await M.SingularTestA.createOne({name : 'a1'}); // id 2
      a2 = await M.SingularTestA.createOne({name : 'a2'}); // id 3
      b  = await M.SingularTestB.createOne({name : 'b', _toa1_ref : a.get('id'), _toam_ref : a1.get('id')});
      c  = await M.SingularTestC.createOne({
        name      : 'c',
        _toa1_ref : a2.get('id'),
        _toam_ref : a1.get('id'),
        _tob1_ref : b.get('id'),
        _tobm_ref : b.get('id')});

      /*
      logger.info('a: ', a);
      logger.info('b: ', b);
      logger.info('c: ', c);
      logger.info('SingularTestA GraphQL : ', M.SingularTestA.getGraphQLSchema());
      logger.info('SingularTestB GraphQL : ', M.SingularTestB.getGraphQLSchema());
      logger.info('SingularTestC GraphQL : ', M.SingularTestC.getGraphQLSchema());
      */

      expect(a.get('id')).to.equal(1);
      expect(a1.get('id')).to.equal(2);
      expect(b.get('id')).to.equal(1);
      expect(c.get('id')).to.equal(2);

      await b.readIn('toa1');
      // logger.info('b toa1 : ', b);
      await b.readIn('toam');
      // logger.info('b toam : ', b);
      expect(b.toa1.get('id')).to.equal(a.get('id'));
      expect(b.toam.get('id')).to.equal(a1.get('id'));

      await a.readIn('SingularTestB:toa1');
      // logger.info('a :', a);
      expect(a.singulartestb).to.exist;
      expect(a.singulartestb instanceof M.SingularTestB).to.be.true;

    });

    /*
      p  = await M.ParentModel.createOne({title : 'parent1'});
      c  = await M.ChildModel.createOne({title : 'child1', ctitle : 'child1'});
      cc = await M.ChildChildModel.createOne({title : 'cchild1', ctitle : 'cchild1', cctitle : 'cchild1'});
      expect(p.get('id') ).to.equal(1); // 1st
      expect(c.get('id') ).to.equal(2); // 1st child, but it inherits from parent, so id is 2
      expect(cc.get('id')).to.equal(3); // 1st cchild, but it inherits from child, so id is 3
    });

    it(`> polymorphic readByID of ChildModel via ParentModel : ${__fileloc}`, async function() {
      let c1 = await M.ParentModel.readByID(2);
      logger.info('c1: ', c1);
      expect(c1.constructor.name).to.equal('ChildModel'); // should be of same model
      expect(c1.get()).to.deep.equal(c.get());            // should have same data
    });
    */

  });
});


