
const expect    = require('chai').expect;
const Logger    = require('woveon-logger');
const WovReturn = require('../src/wovreturn');
const Service   = require('../src/index');
const M         = (require('./testmodels'))();
const addContext = require('mochawesome/addContext');


const {WovDBPostgres} = require('../src/wovdb');


let mtag ='7b_model';

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

  // setup the service
  before(async function() {
    this.timeout(3000);

    testdb = new WovDBPostgres('testdb', logger);
    await testdb.connect();
    /*
    await C.data('db').connect()
      .then(() => { logger.verbose('  ... db connected'); })
      .catch( (e) => { logger.throwError('  ... db connection error', e.stack); });
      */
    cl = new Service.WovModelClient(logger, testdb, [M.ParentModel, M.ChildModel, M.ChildChildModel, M.AssModelP, M.AssModelC, M.ReadInA, M.ReadInB, M.ReadInC, M.ReadInCChild]);
    await cl.init(null, true, true, true);
  });

  describe('> WovModel Associations and Polymorphic tests', async function() {
    let p = null;
    let c = null;
    let cc = null;
    let ap = [];
    let ac = [];

    it(`> create parent and child models : ${__fileloc}`, async function() {
      p  = await M.ParentModel.createOne({title : 'parent1'});
      c  = await M.ChildModel.createOne({title : 'child1', ctitle : 'child1'});
      cc = await M.ChildChildModel.createOne({title : 'cchild1', ctitle : 'cchild1', cctitle : 'cchild1'});
      expect(p.get('id') ).to.equal(1); // 1st
      expect(c.get('id') ).to.equal(2); // 1st child, but it inherits from parent, so id is 2
      expect(cc.get('id')).to.equal(3); // 1st cchild, but it inherits from child, so id is 3
    });

    it(`> polymorphic getByID of ChildModel via ParentModel : ${__fileloc}`, async function() {
      let c1 = await M.ParentModel.getByID(2);
      // logger.info('c1: ', c1);
      expect(c1.constructor.name).to.equal('ChildModel'); // should be of same model
      expect(c1.get()).to.deep.equal(c.get());            // should have same data
    });

    it(`> readIn of ParentModel AssModelP : ${__fileloc}`, async function() {

      // create AssModelP pointing to p
      ap.push(await M.AssModelP.createOne({title : 'assmodelp1', _parentmodel_ref : p.get('id')}));
      expect(ap[0] instanceof M.AssModelP).to.be.true;

      // read in
      let result = await p.readIn('assmodelp');
      // logger.info('result: ', result);
      expect(result[0] instanceof M.AssModelP).to.be.true;
      expect(p.assmodelps[1] instanceof M.AssModelP).to.be.true;

      // test backselector
      // let result2 = await p.readIn('assmodelp', 'parentmodel');
      // logger.info('p2: ', p);
      // logger.info('result2: ', result2);

      // logger.info('result3: ', ap[0].flatten());
      expect(ap[0].flatten()).to.deep.equal(p.assmodelps[1].flatten());
    });

    it.skip(`> readIn on model with singular 'from' direction`);

    it(`> polymorphic readIn of ChildModel AssModelC : ${__fileloc}`, async function() {

      // create two AssModelC pointing to c
      ac.push(await M.AssModelC.createOne({title : 'assmodelc1', _childmodel_ref : c.get('id')}));
      ac.push(await M.AssModelC.createOne({title : 'assmodelc2', _childmodel_ref : c.get('id')}));
      expect(ac[0] instanceof M.AssModelC).to.be.true;
      expect(ac[1] instanceof M.AssModelC).to.be.true;

      // read in
      // let result = await c.readInMany('AssModelC');
      await c.readIn('AssModelC');
      // logger.info('AssModelCs on c result: ', result);
      // logger.info('c: ', c);
      // logger.info('AssModelCs on c result: ', c.assmodelcs);
      expect(c.assmodelcs.pos(0) instanceof M.AssModelC).to.be.true;
      expect(c.assmodelcs.pos(1) instanceof M.AssModelC).to.be.true;

    });

    /*
    it(`> create some associations of parent : ${__fileloc}`, async function() {
      let a = await M.AssModel1.createOne(
    });
    */


    it(`WovService> readInResolveModel and readIn/readInMany : ${__fileloc}`, async function() {

      let a  = await M.ReadInA.createOne({_named_ref : -1, _readinb_ref : -1});
      let a1 = await M.ReadInA.createOne({_named_ref : -1, _readinb_ref : -1});
      let b  = await M.ReadInB.createOne({_named_ref : a1.get('id'), _readina_ref : a.get('id')}); // two different A's
      let c  = await M.ReadInC.createOne({
        _nameda_ref  : a1.get('id'),
        _readina_ref : a.get('id'),
      });
      // logger.info('M.ReadInCChild: ', M.ReadInCChild);
      let cc = await M.ReadInCChild.createOne({
        _nameda_ref  : a1.get('id'),
        _readina_ref : a.get('id'),
        _namedb_ref  : b.get('id'),
        _readinb_ref : b.get('id'),
      });
      a.set('_named_ref', b.get('id'));  a.set('_readinb_ref', b.get('id'));  await a.save();
      a1.set('_named_ref', b.get('id')); a1.set('_readinb_ref', b.get('id')); await a1.save();
      // logger.info('a : ', a, a.get()); logger.info('b : ', b, b.get());

      let result = null;

      // nothing named 'b'
      try {
        result = await a._readInResolveModel('b');
        expect('Should never reach this since exception thrown').to.be.false;
      }
      catch (e) { }

      addContext(this, {title : 'A -> B: find it', value : {a, b}});
      result = await a._readInResolveModel('readinb');
      expect(result).to.not.be.null;
      expect(result.direction).to.equal('to');
      expect(result.ref).to.equal('_readinb_ref');
      expect(result.model.name).to.equal('ReadInB');
      expect(result.cid).to.equal(b.get('id'));

      addContext(this, {title : 'A -(named)-> B find it using a named', value : {a : a.get(), b : b.get()}});
      result = await a._readInResolveModel('named');
      expect(result).to.not.be.null;
      expect(result.direction).to.equal('to');
      expect(result.ref).to.equal('_named_ref');
      expect(result.model.name).to.equal('ReadInB');
      expect(result.cid).to.equal(b.get('id'));

      addContext(this, {title : 'B -> A find it', value : {a : a.get(), b : b.get()}});
      result = await b._readInResolveModel('readina');
      expect(result).to.not.be.null;
      expect(result.direction).to.equal('to');
      expect(result.ref).to.equal('_readina_ref');
      expect(result.model.name).to.equal('ReadInA');
      expect(result.cid).to.equal(a.get('id'));

      addContext(this, {title : 'B -(named)-> A find it using a named', value : {a : a.get(), b : b.get()}});
      result = await b._readInResolveModel('named');
      expect(result).to.not.be.null;
      expect(result.direction).to.equal('to');
      expect(result.ref).to.equal('_named_ref');
      expect(result.model.name).to.equal('ReadInA');
      expect(result.cid).to.equal(a1.get('id'));

      addContext(this, {title : 'A <- C find it using default', value : {a : a.get(), c : c.get()}});
      result = await a._readInResolveModel('readinc');
      expect(result).to.not.be.null;
      expect(result.direction).to.equal('from');
      expect(result.ref).to.equal('_readina_ref');
      expect(result.model.name).to.equal('ReadInC');
      expect(result.cid).to.be.null;

      addContext(this, {title : 'A <(named)- C find it using C\'s nameda', value : {a : a.get(), c : c.get()}});
      result = await a._readInResolveModel('readinc', 'nameda');
      expect(result).to.not.be.null;
      expect(result.direction).to.equal('from');
      expect(result.ref).to.equal('_nameda_ref');
      expect(result.model.name).to.equal('ReadInC');
      expect(result.cid).to.be.null;


      // inheritance of parent's refs

      addContext(this, {title : 'A <- CC find it using default', value : {a : a.get(), c : c.get()}});
      result = await a._readInResolveModel('readinc');
      expect(result).to.not.be.null;
      expect(result.direction).to.equal('from');
      expect(result.ref).to.equal('_readina_ref');
      expect(result.model.name).to.equal('ReadInC');
      expect(result.cid).to.be.null;

      addContext(this, {title : 'A <(named)- CC find it using C\'s nameda', value : {a : a.get(), c : c.get()}});
      result = await a._readInResolveModel('readinc', 'nameda');
      expect(result).to.not.be.null;
      expect(result.direction).to.equal('from');
      expect(result.ref).to.equal('_nameda_ref');
      expect(result.model.name).to.equal('ReadInC');
      expect(result.cid).to.be.null;

      addContext(this, {title : 'CC -> a find it using default : inheritance of parent _readina_ref ', value : {a : a.get(), cc : cc.get()}});
      result = await cc._readInResolveModel('readina');
      expect(result).to.not.be.null;
      expect(result).to.include({
        direction : 'to',
        ref       : '_readina_ref',
        cid       : a.get('id'),
      });
      expect(result.model.name).to.equal('ReadInA');

      addContext(this, {title : 'CC -> a find it using nameda  : inheritance of parent _nameda_ref', value : {a : a.get(), cc : cc.get()}});
      result = await cc._readInResolveModel('nameda');
      // logger.info('result: ', result);
      expect(result).to.not.be.null;
      expect(result).to.include({
        direction : 'to',
        ref       : '_nameda_ref',
        cid       : a1.get('id'),
      });
      expect(result.model.name).to.equal('ReadInA');

      addContext(this, {title : 'CC -> b find it using readinb : new ref of child', value : {a : a.get(), cc : cc.get()}});
      result = await cc._readInResolveModel('readinb');
      expect(result).to.not.be.null;
      expect(result).to.include({
        direction : 'to',
        ref       : '_readinb_ref',
        cid       : b.get('id'),
      });
      expect(result.model.name).to.equal('ReadInB');

      addContext(this, {title : 'CC -> b find it using namedb  : new trans ref of child', value : {a : a.get(), cc : cc.get()}});
      result = await cc._readInResolveModel('namedb');
      expect(result).to.not.be.null;
      expect(result).to.include({
        direction : 'to',
        ref       : '_namedb_ref',
        cid       : b.get('id'),
      });
      expect(result.model.name).to.equal('ReadInB');

      // TODO: resolved functions for unions


      // ---------------------------------------------------------------------
      // logger.h3().info('readIn');

      expect(a.readinb).to.be.undefined;
      await  a.readIn('readinb');
      // logger.info('a.readinb: ', a.readinb);
      expect(a.readinb).to.not.be.undefined;
      expect(a.readinb._data).to.deep.equal(b._data);

      expect(a.named).to.be.undefined;
      await  a.readIn('named');
      // logger.info('a.named: ', a.named);
      expect(a.named).to.not.be.undefined;
      expect(a.named._data).to.deep.equal(b._data);

      expect(b.readina).to.be.undefined;
      await  b.readIn('readina');
      // logger.info('b.readina: ', b.readina);
      expect(b.readina).to.not.be.undefined;
      expect(b.readina._data).to.deep.equal(a._data);

      expect(b.named).to.be.undefined;
      addContext(this, {title : 'b readIn named', value : 'B transmodel for "named" is ReadInA and _named_ref is 2 so reads ReadInA model of id 2, which is variable a1'});
      await  b.readIn('named');
      /*
      logger.info('a:  ', a.get());
      logger.info('a1: ', a.get());
      logger.info('b: ', b);
      logger.info('b.named: ', b.named);
      logger.info('b: ', b.named._data);
      logger.info('a1: ', a1._data);
      */
      expect(b.named).to.not.be.undefined;
      expect(b.named._data).to.deep.equal(a1._data);

      expect(c.readina).to.be.undefined;
      await  c.readIn('readina');
      // logger.info('c.readina: ', c.readina);
      expect(c.readina).to.not.be.undefined;
      expect(c.readina._data).to.deep.equal(a._data);

      expect(c.nameda).to.be.undefined;
      // logger.info('c:  ', c.get());
      addContext(this, {
        title : 'c readIn nameda',
        value : 'C transmodel for nameda is ReadInA, and c _nameda_ref is 2 so C.nameda is ReadInA of id 2, which is a1',
      });
      await  c.readIn('nameda');
      // logger.info('c.nameda: ', c.nameda.get());
      // logger.info('a1      : ', a1.get());
      expect(c.nameda).to.not.be.undefined;
      expect(c.nameda._data).to.deep.equal(a1._data);

      expect(cc.readina).to.be.undefined;
      await  cc.readIn('readina');
      // Logger.g().info('cc.readina: ', cc.readina);
      expect(cc.readina).to.not.be.undefined;
      expect(cc.nameda).to.be.undefined;
      await  cc.readIn('nameda');
      // Logger.g().info('cc.named: ', cc.named);
      expect(cc.nameda).to.not.be.undefined;
      expect(cc.readinb).to.be.undefined;
      await  cc.readIn('readinb');
      // Logger.g().info('cc.readinb: ', cc.readinb);
      expect(cc.readinb).to.not.be.undefined;
      expect(cc.namedb).to.be.undefined;
      await  cc.readIn('namedb');
      // Logger.g().info('cc.namedb: ', cc.namedb);
      expect(cc.namedb).to.not.be.undefined;
    });

  });
});


/*

X    _model_t in database should say which model to use from data... allows Polymorphism

X      in omod, which is Chandata, since _model_t for message 1 is 'ChandataMessage', which is not to Chandata, then
    reads in data from ChandataMessage's table (cd_message) and creates an object with that model.

    ch.readInMany('chandata')

    table is v_chandata, which will have _model_t (instead of chandata_t)


      cache ChandataMessage queries 
      */
