
const expect    = require('chai').expect;
const Logger    = require('woveon-logger');
const WovReturn = require('../src/wovreturn');
const Service   = require('../src/index');
const C         = require('woveon-service').Config;

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
  let testdb = null;

  let data   = {id : 1, name : 'name'};
  let data2  = {id : 1, title : 'title2.1', _testtable_ref : data.id};
  let data3  = {id : 101, title : 'title3.1', _testtable_ref : data.id};
  let data3a = {id : 102, title : 'title3.2', _testtable_ref : data.id};
  let data3b = {id : 103, title : 'title3.3', _testtable_ref : data.id};
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
      [TestModel, TestModel2, TestModel3, MP, TMS.Car, TMS.Tire, TMS.Wheel]); // , ['testtable', 'testtable2', 'testmodel3', 'mp']);
    await cl.initModelDB(true, true, true);
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
      logger.info('wmm: ', wmm);
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
      let val = await TestModel.readByID(data.id);
      expect(val).to.be.null;
    });

    it(`> create : ${__fileloc}`, async function() {
      let val = await TestModel.createOne(data);
      // logger.info('val: ', val);
      expect(val.get('id')).to.equal(data.id, val);
    });

    it(`> read 1 : ${__fileloc}`, async function() {
      let val = await TestModel.readByID(data.id);
      // logger.info('val: ', val);
      expect(val).to.not.be.null;
      expect(val.get()).to.deep.equal(data);
    });

    it(`> update 1 to name2 : ${__fileloc}`, async function() {
      let data2 = {name : 'name2'};
      let val = await TestModel.updateOne(data.id, data2);
      // logger.info('val: ', val);
      expect(val).to.include(data2);
      let val2 = await TestModel.readByID(data.id);
      expect(val2.get()).to.include(data2);
    });

    it(`> delete 1 : ${__fileloc}`, async function() {
      let val = await TestModel.deleteByID(data.id);
      // logger.info('val: ', val);
      expect(val.id).to.equal(data.id);
      let val2 = await TestModel.readByID(data.id);
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
      expect(tm2.isRef('_testtable_ref')).to.be.true;
      expect(TestModel.isRef('name')).to.be.false;
      expect(TestModel2.isRef('title')).to.be.false;
      expect(TestModel2.isRef('_testtable_ref')).to.be.true;
    });

    it(`> flatten : ${__fileloc}`, async function() {
      let tm1 = await TestModel.readByID(data.id);
      let tm2 = await TestModel2.readByID(data2.id);
      // logger.info('tm1 flatten: ', tm1.flatten());
      // logger.info('tm2 flatten: ', tm2.flatten());
      expect(tm1.flatten()).to.deep.equal(fdata);
      expect(tm2.flatten()).to.deep.equal(fdata2);
    });

    it(`> readIn (with table testtable and model testmodel) : ${__fileloc}`, async function() {
      let tm2 = await TestModel2.readByID(data2.id);
      await tm2.readIn('testmodel');
      expect(tm2.testmodel).to.exist;
      expect(tm2.testmodel instanceof TestModel).to.be.true;
    });

    it(`> readIn from cross-model : ${__fileloc}`, async function() {
      let tm3 = await TestModel3.createOne(data3);
      logger.info('tm3 data: ', tm3.get());

      let tm = await TestModel.readByID(data.id);
      await tm.readIn('testmodel3');
      logger.info('tm data: ', tm.get());
      logger.info('tm: ', tm);
      logger.info('testmodel3 data: ', tm.testmodel3.get());
      expect(tm.testmodel3).to.exist;
      expect(tm.testmodel3.get('_testtable_ref')).to.equal(tm.get('id'));
    });


    it(`> readInMany (with plural and trans) : ${__fileloc}`, async function() {
      let tm1 = await TestModel.readByID(data.id);
      await tm1.readInMany('TestModel3');
      // logger.info('tm1: ', tm1);
      expect(tm1.testmodels3).to.exist;

    });

    it(`> readInMany partially : ${__fileloc}`, async function() {
      await TestModel3.createOne(data3a);
      await TestModel3.createOne(data3b);
      let tm1 = await TestModel.readByID(data.id);
      await tm1.readInMany('TestModel3', {title : data3a.title});
      expect(Object.keys(tm1.testmodels3).length).to.equal(1);
      await tm1.readInMany('TestModel3', {title : data3b.title});
      expect(Object.keys(tm1.testmodels3).length).to.equal(2);

      delete tm1.testmodels3;
      await tm1.readInMany('TestModel3', {'or' : [{title : data3a.title}, {title : data3b.title}] });
      expect(Object.keys(tm1.testmodels3).length).to.equal(2);

      delete tm1.testmodels3;
      await tm1.readInMany('TestModel3', {'and' : [{title : data3a.title}, {title : data3b.title}] });
      expect(Object.keys(tm1.testmodels3).length).to.equal(0);
      await tm1.readInMany('TestModel3', {'and' : [{title : data3a.title}] });
      expect(Object.keys(tm1.testmodels3).length).to.equal(1);

      delete tm1.testmodels3;
      await tm1.readInMany('TestModel3', {'and' : {title : data3a.title} });
      expect(Object.keys(tm1.testmodels3).length).to.equal(1);

    });


    it(`> flatten component : ${__fileloc}`, async function() {
      let tm2 = await TestModel2.readByID(data2.id);
      await tm2.readIn('testmodel');
      // now test flatten
      // logger.info('tm2 flatten: ', tm2.flatten());
      expect(tm2.flatten()).to.deep.equal({title : data2.title, testmodel : {name : data.name}});

    });

    it(`> save : ${__fileloc}`, async function() {
      let tm1 = await TestModel.readByID(data.id);

      // not dirty so does not run
      let r1 = await tm1.save();
      expect(r1).to.equal(false);

      // change value to save runs
      tm1.set('name', 'newname');
      let r2 = await tm1.save();
      expect(r2).to.equal(true);

      // read it back in and check the change was applied
      let tm1b = await TestModel.readByID(data.id);
      // logger.info('tm1a: ', tm1a);
      expect(tm1b.get('name')).to.equal('newname');
    });
  });

  describe('> WovModel schema checks', async function() {
    it(`> schema basic test: ${__fileloc}`);

    it(`> schema private : ${__fileloc}`, async function() {
      let mp = await MP.createOne({title : 'mp', pp : 'secret'});
      logger.info('mp         : ', mp);
      logger.info('mp get     : ', mp.get());
      logger.info('mp flatten : ', mp.flatten());

      expect(mp.get()).to.deep.equal({id : 1, title : 'mp', pp : 'secret'});
      expect(mp.flatten()).to.deep.equal({title : 'mp'});
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

      logger.info('car   : ', car.get());
      logger.info('tire  : ', tires[0].get());
      logger.info('tire  : ', tires[1].get());
      logger.info('tire  : ', tires[2].get());
      logger.info('tire  : ', tires[3].get());
      logger.info('wheel : ', wheels[0].get());
      logger.info('wheel : ', wheels[1].get());
      logger.info('wheel : ', wheels[2].get());
      logger.info('wheel : ', wheels[3].get());

      await car.readInMany('Tire');
      logger.info('Car Tires : ', car.tires.get());
      car.tires.get().forEach( function(t, i) { expect(t).to.deep.equal(tires[i].get()); });

      logger.info('Car Tires : ', car.tires);
      await car.tires.readIn('Wheel');
      logger.info('Car Tires (post): ', car.tires);
      logger.info('Car Tires Wheels: ', car.tires.select('wheel'));
      await car.tires.select('wheel').readIn('Tire');
      logger.info('Car Tires Wheels Tire: ', car.tires.select('wheel').select('tire'));

    });

  });

  after(async function() {
  });

});
