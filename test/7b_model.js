
const expect    = require('chai').expect;
const Logger    = require('woveon-logger');
const WovReturn = require('../src/wovreturn');
const Service   = require('../src/index');
const C         = require('woveon-service').Config;
const M         = (require('./testmodels'))();

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
    cl = new Service.WovModelClient(logger, testdb, [M.ParentModel, M.ChildModel, M.ChildChildModel, M.AssModelP, M.AssModelC]);
    await cl.initModelDB(true, true, true);
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

    it(`> polymorphic readByID of ChildModel via ParentModel : ${__fileloc}`, async function() {
      let c1 = await M.ParentModel.readByID(2);
      logger.info('c1: ', c1);
      expect(c1.constructor.name).to.equal('ChildModel'); // should be of same model
      expect(c1.get()).to.deep.equal(c.get());            // should have same data
    });

    it(`> readIn of ParentModel AssModelP : ${__fileloc}`, async function() {

      // create AssModelP pointing to p
      ap.push(await M.AssModelP.createOne({title : 'assmodelp1', _parenttable_ref : p.get('id')}));
      expect(ap[0] instanceof M.AssModelP).to.be.true;

      // read in
      let result = await p.readIn('assmodelp');
      logger.info('result: ', result);
      expect(p.assmodelp instanceof M.AssModelP).to.be.true;

      expect(ap[0].flatten()).to.deep.equal(p.assmodelp.flatten());
    });

    it(`> polymorphic readIn of ChildModel AssModelC : ${__fileloc}`, async function() {

      // create two AssModelC pointing to c
      ac.push(await M.AssModelC.createOne({title : 'assmodelc1', _childmodel_ref : c.get('id')}));
      ac.push(await M.AssModelC.createOne({title : 'assmodelc2', _childmodel_ref : c.get('id')}));
      expect(ac[0] instanceof M.AssModelC).to.be.true;
      expect(ac[1] instanceof M.AssModelC).to.be.true;

      // read in
      let result = await c.readInMany('AssModelC');
      logger.info('AssModelCs on c result: ', result);
      logger.info('c: ', c);
      logger.info('AssModelCs on c result: ', c.assmodelcs);
      expect(c.assmodelcs.pos(0) instanceof M.AssModelC).to.be.true;
      expect(c.assmodelcs.pos(1) instanceof M.AssModelC).to.be.true;

    });

    /*
    it(`> create some associations of parent : ${__fileloc}`, async function() {
      let a = await M.AssModel1.createOne(
    });
    */

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
