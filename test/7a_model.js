
const performance = require('perf_hooks').performance;

const expect    = require('chai').expect;
const Logger    = require('woveon-logger');
const WovReturn = require('../src/wovreturn');
const Service   = require('../src/index');

const WovModelMany    = require('../src/wovmodelmany');
const {WovDBPostgres} = require('../src/wovdb');

const TMS        = (require('./testmodels'))();
const TestModel  = TMS.TestModel;
const TestModel2 = TMS.TestModel2;
const TestModel3 = TMS.TestModel3;
const MP         = TMS.MP;


let mtag ='7a_model';

let logger = new Logger(mtag, {
  debug    : true,
  showName : true,
  level    : 'info',
  color    : 'inverse',
}, {
  titles : false,
});

describe(`> ${mtag}: `, async function() {

  let cl     = null;
  let statelayer = null;
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

  let data   = {id : 1,   name : 'name'};
  let data2  = {id : 1,   title : 'title2.1', _testmodel_ref : data.id};
  let data3  = {id : 101, title : 'title3.1', _testmodel_ref : data.id};
  let data3a = {id : 102, title : 'title3.2', _testmodel_ref : data.id};
  let data3b = {id : 103, title : 'title3.3', _testmodel_ref : data.id};
  let fdata  = {name : data.name};
  let fdata2 = {title : data2.title};
//  let fdata3 = {title : data3.title};

  // setup the service
  before(async function() {
    this.timeout(3000);

    /*
    await C.data('db').connect()
      .then(() => { logger.verbose('  ... db connected'); })
      .catch( (e) => { logger.throwError('  ... db connection error', e.stack); });
      */
    testdb = new WovDBPostgres('testdb', logger);
    await testdb.connect();
    cl = new Service.WovModelClient(logger, testdb,
      [TestModel, TestModel2, TestModel3, MP, TMS.Car, TMS.Tire, TMS.Wheel, TMS.ParentModel, TMS.ChildModel, TMS.ChildChildModel, TMS.AssModelP, TMS.AssModelC, TMS.ReadInA, TMS.ReadInB, TMS.ReadInC, TMS.ReadInCChild, TMS.AA, TMS.BB, TMS.CC]); // , ['testtable', 'testtable2', 'testmodel3', 'mp']);
    sl = new Service.WovStateLayer(logger, [cl]);
    await cl.init(sl, true, true, true);
  });


  describe('> WovModelClient', async function() {

    it('> client getModelByTablename', async function() {
      let result = cl.getModelByTablename('testtable');
      expect(result).to.deep.equal(TestModel);
    });

    it('> client _runQuery', async function() {
      let result = await cl._runQuery('SELECT 1');
      expect(result).to.deep.equal([{'?column?' : 1}]);
    });

    it('> client _runQuery error', async function() {

      // with Error
      let result = await cl._runQuery('SELECT * FROM unknowntable')
        .catch(function(e) { return e; });
      expect(typeof result).to.equal('object');
      expect(result instanceof Error).to.be.true;

      // with WovReturn error
      let result2 = await cl._runQuery('SELECT * FROM unknowntable', [], 'testQuery', true)
        .catch(function(e) { return e; });
      expect(typeof result2).to.equal('object');
      expect(result2 instanceof WovReturn).to.be.true;

    });

    it('> client _runSingularQuery', async function() {
      let q1 = `INSERT INTO testtable (name) VALUES ( $1::text ) RETURNING id, name`;
      let d1 = ['testname'];
      let result1 = await cl._runSingularQuery(q1, d1, 'WovModelClientTest');
      expect(result1.name).to.equal(d1[0]);

      let q2 = `DELETE FROM testtable WHERE id = $1::integer RETURNING id`;
      let d2 = [result1.id];
      let result2 = await cl._runSingularQuery(q2, d2, 'WovModelClientTest');
      expect(result2.id).to.equal(d2[0]);

    });
    it('> client _runUpdateQuery', async function() {
      // insert 1
      let q1 = `INSERT INTO testtable (name) VALUES ( $1::text ) RETURNING id, name`;
      let d1 = ['testname'];
      let result1 = await cl._runSingularQuery(q1, d1, 'WovModelClientTest');
      // logger.info('result1: ', result1);

      // update it, returning in 0th position the rows changed, 1
      let q2 = `UPDATE testtable SET name = $2::text WHERE id=$1::integer RETURNING id, name`;
      let d2 = [result1.id, 'testname'];
      let result2 = await cl._runUpdateQuery(q2, d2, 'WovModelClientTest');
      // logger.info('result2: ', result2, result2[0]);
      expect(result2[0]).to.equal(1);
      expect(result2[1][0].id).to.equal(d2[0]);

      // no update, returning in 0th position the rows changed, 0
      let q3 = `UPDATE testtable SET name = $2::text WHERE id=$1::integer RETURNING id, name`;
      let d3 = [99999999, 'testname2'];
      let result3 = await cl._runUpdateQuery(q3, d3, 'WovModelClientTest');
      // logger.info('result3: ', result3);
      expect(result3[0]).to.equal(0);
    });

    it('> client transaction');
  });

  describe('> WovModelMany', async function() {
    let wmm = null;

    before(function() {
      wmm = new WovModelMany();
      wmm[1] = new TestModel({id : 1, name : 'A'});
      wmm[2] = new TestModel({id : 2, name : 'B'});
      wmm[3] = new TestModel({id : 3, name : 'C'});
      // logger.info('wmm: ', wmm);
    });

    it('> pos', async function() {
      expect(wmm.pos(0)).to.deep.equal(wmm[1]);
      expect(wmm.pos(1)).to.deep.equal(wmm[2]);
      expect(wmm.pos(2)).to.deep.equal(wmm[3]);
    });

    it('> get', async function() {
      expect(wmm.get('id')).to.deep.equal([1, 2, 3]);
    });

    it('> id', async function() {
      expect(wmm.id(1)).to.deep.equal(wmm[1]);
      expect(wmm.id(2)).to.deep.equal(wmm[2]);
      expect(wmm.id(3)).to.deep.equal(wmm[3]);
    });
  });

  describe('> WovModel', async function() {

    it(`> set / get : ${__fileloc}`, async function() {
      let val = new TestModel({id : 1, name : 'A'});
      expect(val.get('name')).to.equal('A');
      val.set('name', 'B');
      expect(val.get('name')).to.equal('B');
      val.set({'name' : 'A'});
      expect(val.get('name')).to.equal('A');
    });

    it(`> read null : ${__fileloc}`, async function() {
      let val = await TestModel.getByID(data.id);
      expect(val).to.be.null;
    });

    it(`> create : ${__fileloc}`, async function() {
      let val = await TestModel.createOne(data);
      // logger.info('val: ', val);
      expect(val.get('id')).to.equal(data.id, val);
    });

    it(`> read 1 : ${__fileloc}`, async function() {
      let val = await TestModel.getByID(data.id);
      // logger.info('val: ', val);
      expect(val).to.not.be.null;
      expect(val.get()).to.deep.equal(data);
    });

    it(`> update 1 to name2 : ${__fileloc}`, async function() {
      let data2 = {name : 'name2'};
      let val = await TestModel.updateOne(data.id, data2);
      // logger.info('val: ', val);
      expect(val).to.include(data2);
      let val2 = await TestModel.getByID(data.id);
      expect(val2.get()).to.include(data2);
    });

    it(`> delete 1 : ${__fileloc}`, async function() {
      let val = await TestModel.deleteByID(data.id);
      // logger.info('val: ', val);
      expect(val.id).to.equal(data.id);
      let val2 = await TestModel.getByID(data.id);
      expect(val2).to.be.null;
    });

    it(`> isRef : ${__fileloc}`, async function() {
      let tm1 = await TestModel.createOne(data);
      let tm2 = await TestModel2.createOne(data2);
      // logger.info('tm1: ', tm1);
      // logger.info('tm2: ', tm2);
      expect(tm1.isRef('id')).to.be.false;
      expect(tm1.isRef('name')).to.be.false;
      expect(tm2.isRef('id')).to.be.false;
      expect(tm2.isRef('title')).to.be.false;
      expect(tm2.isRef('_testmodel_ref')).to.be.true;
      expect(TestModel.isRef('name')).to.be.false;
      expect(TestModel2.isRef('title')).to.be.false;
      expect(TestModel2.isRef('_testmodel_ref')).to.be.true;
    });

    it(`> flatten : ${__fileloc}`, async function() {
      let tm1 = await TestModel.getByID(data.id);
      let tm2 = await TestModel2.getByID(data2.id);
      // logger.info('tm1 flatten: ', tm1.flatten());
      // logger.info('tm2 flatten: ', tm2.flatten());
      expect(tm1.flatten({keepinstance : false})).to.deep.equal(fdata);
      expect(tm2.flatten({keepinstance : false})).to.deep.equal(fdata2);
    });


    it(`> deRef Full tests : ${__fileloc}`, async function() {
      logger.h2('titles').aspect('titles', this.test.title);
      let result = null;

      /*
      logger.info('AA: ', TMS.AA);
      logger.info('BB: ', TMS.BB);
      logger.info('CC: ', TMS.CC);
      */

      // none
      try {
        result = TMS.AA.deRef(null, 'a');
        expect(true).to.be.false;
      }
      catch (e) { expect(result).to.be.null; }

      // to, transmodel
      result = [TMS.AA.deRef('_tob_ref'), TMS.AA.deRef(null, 'tob')];
      for (let i in result) {
        let r = result[i];
        expect(r).to.deep.equal({
          model : TMS.BB,
          dir   : 'to',
          sel   : 'tob',
          ref   : '_tob_ref',
          erel  : Service.WovModel.ER_ONE,
        });
      }

      // to, tablename
      /*
      result = TMS.AA.deRef(null, 'BBb');
      // logger.info('tables: ', cl.table2model);
      expect(result).to.deep.equal({
        model : TMS.BB,
        dir   : 'to',
        sel   : 'b',
        ref   : '_b_ref',
        erel  : Service.WovModel.ER_ONE,
      });
      */

      // to, modelname
      result = [TMS.AA.deRef(null, 'BB'), TMS.AA.deRef('_bb_ref', null)];
      for (let i in result) {
        let r = result[i];
        expect(r).to.deep.equal({
          model : TMS.BB,
          dir   : 'to',
          sel   : 'bb',
          ref   : '_bb_ref',
          erel  : Service.WovModel.ER_ONE,
        });
      }

      // from, modelname (NOTE: using CC since BB would go to _bb_ref in AA)
      result = [TMS.AA.deRef(null, 'CC'), TMS.AA.deRef('_cc_ref', null)];
      for (let i in result) {
        let r = result[i];
        // logger.info('r: ', r);
        expect(r).to.deep.equal({
          model     : TMS.CC,
          dir       : 'from',
          sel       : 'CC',
          ref       : '_aa_ref',
          erel      : Service.WovModel.ER_MANY, // ambiguous warning given
          ambiguous : true,
        });
      }

      result = [TMS.AA.deRef(null, 'CC:toa1')];
      for (let i in result) {
        let r = result[i];
        // logger.info('r: ', r);
        expect(r).to.deep.equal({
          model  : TMS.CC,
          dir    : 'from',
          sel    : 'CC:toa1',
          selbak : 'cc',
          ref    : '_toa1_ref',
          erel   : Service.WovModel.ER_ONE,
        });
      }

      result = [TMS.AA.deRef(null, 'CC:toam')];
      for (let i in result) {
        let r = result[i];
        // logger.info('r: ', r);
        expect(r).to.deep.equal({
          model  : TMS.CC,
          dir    : 'from',
          sel    : 'CC:toam',
          selbak : 'cc',
          ref    : '_toam_ref',
          erel   : Service.WovModel.ER_MANY,
        });
      }

    });


    it.skip(`> deRef speed test : ${__fileloc}`, async function() {

      let n = 100;
      let m = 100;
      /*
      logger.info('f static1:', TMS.AA.prototype);
      logger.info('f static1a:', TMS.AA.prototype.prototype);

      // equivalent
      logger.info('f static1b:', TMS.AA.__proto__);
      logger.info('f static2:', Object.getPrototypeOf(TMS.AA)); // call twice to get parent class

      // logger.info('f static2b:', Object.getPrototypeOf(Object.getPrototypeOf(TMS.AA)));
      logger.info('f static3:', Object.getOwnPropertyNames(TMS.AA.__proto__));

      func = logger.constructor._pf_f(Service.WovModel.deRef);
      logger.info('f1:', func);
      logger.info('f1a:', func.this);
      Service.WovModel.__proto__.deRef = func.bind(Service.WovModel.__proto__);
      */
      // logger.info('f2:', Service.WovModel.__proto__.deRef);
      // logger.info('f2a:', Service.WovModel.__proto__.deRef.__proto__);
      // logger.info('deRef :', TMS.AA.__proto);
      // func = func.bind(TMS.AA);

      logger.info(`start run of ${n} with breaks every ${m}.`);
      for (let i in [0, 1]) {
        let usecache = (i?false:true);
        logger.info(' use cache : ', usecache);
        let ac = [];
        for (let i=0; i<n; i++) {
          as = performance.now();
          result = TMS.AA.deRef(null, 'CC:toa1', usecache);
          ac.push(performance.now()-as);
        }
        logger.info(' - first ', ac[1]-ac[0]);
        for (let i=0; i< ac.length; i++) { logger.info(` - ${i} : ${ac[i]}`); }
        // logger.info(' - ', b-a, (b-a) / n);
      }

    });

    it(`> deRef test : ${__fileloc}`, async function() {
      logger.h2('titles').aspect('titles', this.test.title);


      try { TMS.ParentModel.deRef('_a_ref'); expect(true).to.be.false; }
      catch (e) {}

      let dr = TMS.ParentModel.deRef('_assmodelp_ref');

      expect( dr.model ).to.equal(TMS.AssModelP);
      expect( dr.dir   ).to.equal('from');
      expect( dr.erel  ).to.equal(Service.WovModel.ER_MANY);

      try { TMS.ChildModel.deRef('_parent_ref'); expect(true).to.be.false; }
      catch (e) {}

      expect( TMS.Car.deRef('_tire_ref').model ).to.equal(TMS.Tire);
      expect( TMS.Tire.deRef('_car_ref').model ).to.equal(TMS.Car);
      expect( TMS.Tire.deRef('_wheel_ref').model ).to.equal(TMS.Wheel);
      expect( TMS.Wheel.deRef('_tire_ref').model ).to.equal(TMS.Tire);

      expect( TMS.ReadInA.deRef('_named_ref').model ).to.equal(TMS.ReadInB);
      expect( TMS.ReadInA.deRef('_readinb_ref').model ).to.equal(TMS.ReadInB);

      expect( TMS.AssModelP.deRef('_parentmodel_ref').model ).to.equal(TMS.ParentModel);

    });


    it(`> readIn (with table testtable and model testmodel) : ${__fileloc}`, async function() {
      logger.h2('titles').aspect('titles', this.test.title);
      let tm2 = await TestModel2.getByID(data2.id);
      // logger.info('tm2: ', tm2);
      await tm2.readIn('testmodel');
      // logger.info('tm2: ', tm2);
      expect(tm2.testmodel).to.exist;
      expect(tm2.testmodel instanceof TestModel).to.be.true;
    });


    it(`> readIn, from cross-model by id : ${__fileloc}`, async function() {
      logger.h2('titles').aspect('titles', this.test.title);
      let tm3 = await TestModel3.createOne(data3);
      // logger.info('tm3 data: ', tm3.get());

      let tm = await TestModel.getByID(data.id);
      await tm.readIn('TestModel3');
      // logger.info('tm data: ', tm.get());
      // logger.info('tm: ', tm);
      // logger.info('testmodel data: ', tm.testmodels3.get());
      expect(tm.testmodels3.get('id')[0]).to.equal(tm3.get('id'));
      // logger.info('tm.testmodels3 : ', tm.testmodels3);
      expect(tm.testmodels3.length).to.equal(1);
      expect(tm.testmodels3.get('_testmodel_ref')[0]).to.equal(tm.get('id'));
    });


    /*
    it(`> readInMany (with plural and trans) : ${__fileloc}`, async function() {
      let tm1 = await TestModel.getByID(data.id);
      await tm1.readInMany('TestModel3');
      logger.info('tm1: ', tm1);
      expect(tm1.testmodels3).to.exist;
      exit(1);

    });
    */

    it(`> readIn many with limiters : ${__fileloc}`, async function() {

      await TestModel3.createOne(data3a);
      await TestModel3.createOne(data3b);
      let tm1 = await TestModel.getByID(data.id);
      await tm1.readIn('TestModel3', {title : data3a.title});
      expect(Object.keys(tm1.testmodels3).length).to.equal(1);
      await tm1.readIn('TestModel3', {title : data3b.title});
      expect(Object.keys(tm1.testmodels3).length).to.equal(2);

      delete tm1.testmodels3;
      await tm1.readIn('TestModel3', {'or' : [{title : data3a.title}, {title : data3b.title}] });
      expect(Object.keys(tm1.testmodels3).length).to.equal(2);

      delete tm1.testmodels3;
      await tm1.readIn('TestModel3', {'and' : [{title : data3a.title}, {title : data3b.title}] });
      expect(Object.keys(tm1.testmodels3).length).to.equal(0);
      await tm1.readIn('TestModel3', {'and' : [{title : data3a.title}] });
      expect(Object.keys(tm1.testmodels3).length).to.equal(1);

      delete tm1.testmodels3;
      await tm1.readIn('TestModel3', {'and' : {title : data3a.title}});
      expect(Object.keys(tm1.testmodels3).length).to.equal(1);

    });


    it(`> flatten component : ${__fileloc}`, async function() {
      let tm2 = await TestModel2.getByID(data2.id);
      await tm2.readIn('testmodel');
      // now test flatten
      /*
      logger.info('tm2 : ', tm2);
      logger.info('tm2 flatten : ', tm2.flatten());
      logger.info('testmodel data.name: ', data.name);
      */
      expect(tm2.flatten({keepinstance : false})).to.deep.equal({title : data2.title, testmodel : {name : data.name}});

    });

    it(`> save : ${__fileloc}`, async function() {
      let tm1 = await TestModel.getByID(data.id);

      // not dirty so does not run
      let r1 = await tm1.save();
      expect(r1).to.equal(false);

      // change value to save runs
      tm1.set('name', 'newname');
      let r2 = await tm1.save();
      expect(r2).to.equal(true);

      // read it back in and check the change was applied
      let tm1b = await TestModel.getByID(data.id);
      // logger.info('tm1a: ', tm1a);
      expect(tm1b.get('name')).to.equal('newname');
    });
  });

  describe('> WovModel schema checks', async function() {
    it(`> schema basic test: ${__fileloc}`);

    it(`> schema private : ${__fileloc}`, async function() {
      let mp = await MP.createOne({title : 'mp', pp : 'secret'});
      /*
      logger.info('mp         : ', mp);
      logger.info('mp get     : ', mp.get());
      logger.info('mp flatten : ', mp.flatten());
      */

      expect(mp.get()).to.deep.equal({id : 1, title : 'mp', pp : 'secret'});
      expect(mp.flatten({keepinstance : false})).to.deep.equal({title : 'mp'});
    });

    it(`> schema ignore additional attributes : ${__fileloc}`);

    it(`> schema inheritance tests : ${__fileloc}`);

  });


  describe('> WovModel examples', async function() {

    it(`> car.tires.wheel : ${__fileloc}`, async function() {
      let car = await TMS.Car.createOne({nameplate : 'Pilot', make : 'Honda', license : 'AGH432', state : 'GA'});
      let tires = [
        await TMS.Tire.createOne({brand : 'Michelin', model : '1', position : 'FL', wear : '.76', _car_ref : car.get('id')}),
        await TMS.Tire.createOne({brand : 'Michelin', model : '1', position : 'FR', wear : '.78', _car_ref : car.get('id')}),
        await TMS.Tire.createOne({brand : 'Michelin', model : '1', position : 'RL', wear : '.86', _car_ref : car.get('id')}),
        await TMS.Tire.createOne({brand : 'Michelin', model : '1', position : 'RR', wear : '.91', _car_ref : car.get('id')}),
      ];
      let wheels = [
        await TMS.Wheel.createOne({style : 'chrome', _tire_ref : tires[0].get('id')}),
        await TMS.Wheel.createOne({style : 'chrome', _tire_ref : tires[1].get('id')}),
        await TMS.Wheel.createOne({style : 'chrome', _tire_ref : tires[2].get('id')}),
        await TMS.Wheel.createOne({style : 'chrome', _tire_ref : tires[3].get('id')}),
      ];

      /*
      logger.info('car   : ', car.get());
      logger.info('tire  : ', tires[0].get());
      logger.info('tire  : ', tires[1].get());
      logger.info('tire  : ', tires[2].get());
      logger.info('tire  : ', tires[3].get());
      logger.info('wheel : ', wheels[0].get());
      logger.info('wheel : ', wheels[1].get());
      logger.info('wheel : ', wheels[2].get());
      logger.info('wheel : ', wheels[3].get());
      */

      await car.readIn('Tire');
      // logger.info('Car Tires : ', car);
      // logger.info('Car Tires : ', car.tires.get());
      car.tires.get().forEach( function(t, i) { expect(t).to.deep.equal(tires[i].get()); });

      // logger.info('Car Tires : ', car.tires);
      await car.tires.readIn('Wheel');
      // logger.h1().info('Car Tires (post): ', car.tires);
      // logger.info('Car Tires Wheels: ', await car.tires.select('wheel'));
      await car.tires.select('wheel').readIn('tire');
      // logger.info('Car Tires Wheels Tire: ', car.tires.select('wheels'));
      // logger.info('Car Tires Wheels Tire: ', car.tires.select('wheels').select('tire'));

    });


    it(`> car.tires.wheel flatten test : ${__fileloc}`, async function() {

      let car = await TMS.Car.createOne({nameplate : 'Pilot', make : 'Honda', license : 'AGH432', state : 'GA', combo : '1234'});
      let tires = [
        await TMS.Tire.createOne({brand : 'Michelin', model : '1', position : 'FL', wear : '.76', _car_ref : car.get('id')}),
        await TMS.Tire.createOne({brand : 'Michelin', model : '1', position : 'FR', wear : '.78', _car_ref : car.get('id')}),
        await TMS.Tire.createOne({brand : 'Michelin', model : '1', position : 'RL', wear : '.86', _car_ref : car.get('id')}),
        await TMS.Tire.createOne({brand : 'Michelin', model : '1', position : 'RR', wear : '.91', _car_ref : car.get('id')}),
      ];
      let wheels = [
        await TMS.Wheel.createOne({style : 'chrome', _tire_ref : tires[0].get('id')}),
        await TMS.Wheel.createOne({style : 'chrome', _tire_ref : tires[1].get('id')}),
        await TMS.Wheel.createOne({style : 'chrome', _tire_ref : tires[2].get('id')}),
        await TMS.Wheel.createOne({style : 'chrome', _tire_ref : tires[3].get('id')}),
      ];

      await car.readIn('Tire');

      // expect flatten's wov_model_instance to be the car
      let cf = car.flatten();
      // Logger.g().info(`car flattened: `, cf);
      expect(cf.wov_model_instance).to.deep.equal(car);

      // flatten won't recurse to tires
      let cfa = car.flatten({recurse : false});
      // Logger.g().info(`car flattened no recurse: `, cfa);
      expect(cfa.tires).to.be.undefined;

      // no delete ids
      let cfb = car.flatten({recurse : false, deleteid : false});
      expect(cfb.id).to.equal(car.get('id'));

      // no delete sensitive
      let cfc = car.flatten({recurse : false, deletesensitive : false});
      expect(cfc.combo).to.equal(car.get('combo'));

      // flatten tire 0 wov_model_instance is tire 0
      let t0 = car.tires.pos(0).flatten();
      // Logger.g().info(`car tire 0 flattened: `, t0);
      expect(t0.wov_model_instance).to.deep.equal(car.tires.pos(0));

      // do not keep instance
      let t0a = car.tires.pos(0).flatten({keepinstance : false});
      expect(t0a.wov_model_instance).to.be.undefined;

      // do not delete refs
      let t0b = car.tires.pos(0).flatten({keepinstance : false, deleterefs : false});
      expect(t0b._car_ref).to.equal(car.get('id'));

    });
  });

  after(async function() {
  });

});
