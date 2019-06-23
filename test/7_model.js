
const expect    = require('chai').expect;
const Logger    = require('woveon-logger');
const WovReturn = require('../src/wovreturn');
const Service   = require('../src/index');

const C         = require('woveon-service').Config;

let mtag ='7_model';

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
  let data   = {id : 1, name : 'name'};
  let data2  = {id : 1, title : 'title2.1', _testtable_ref : data.id};
  let data3  = {id : 101, title : 'title3.1', _testtable_ref : data.id};
  let fdata  = {name : data.name};
  let fdata2 = {title : data2.title};
  let fdata3 = {title : data3.title};


  /**
   */
  let TestModel = class TestModel extends Service.WovModel {

    /**
     */
    constructor(_data) { super(_data); }
    /*
    static async createOne(_data) { 
      let retval = null;
      let q = `INSERT INTO testtable (id, name) VALUES ( $1::integer, $2::text ) RETURNING *`;
      let d = [_data.id, _data.name];
      let result = await this.cl._runSingularQuery(q, d, 'createOne');
      if ( result != null && !(result instanceof Error) ) retval = new this(result);
      return retval;
    };
    static async updateOne(_data) {
      let retval = null;
      let q = `UPDATE testtable SET name = $2::text WHERE id = $1::integer RETURNING *`;
      let d = [_data.id, _data.name];
      let result = await this.cl._runUpdateQuery(q, d, 'updateOne');
      if ( result[0] != 1 ) retval = Error(`Failed to update table 'testtable' on id '${_data.id}'.`);
      else retval = result[1][0];
      // logger.info('TestModel::updateOne result: ', retval);
      return retval;
    };
    */

  };
  TestModel.tablename    = 'testtable';
  TestModel._transmodel = {};
  TestModel.updateSchema({name : 'text'});

  /**
   */
  let TestModel2 = class TestModel2 extends Service.WovModel {
    constructor(_data) { super(_data); };
    /*
    static async createOne(_data) {
      let retval = null;

      let qp = this._buildQueryParams(_data, _data, 'insert');
      let q = `INSERT INTO ${this.tablename} (${qp.colnames.join(', ')})
               VALUES (${qp.cols.join(', ')})
               RETURNING *`;

      // let q = `INSERT INTO testtable2 (id, title, _testtable_ref) VALUES ( $1::integer, $2::text, $3::integer ) RETURNING *`;
      // let d = [_data.id, _data.title, _data._testtable_ref];
      // let result = await this.cl._runSingularQuery(q, d, 'createOne');
      // Logger.g().info('qp: ', qp);
      let result = await this.cl._runSingularQuery(q, qp.data, `createOne${this.name}`).catch(function(e) { return e; });
      // Logger.g().info('testModel2 createOne : ', result);
      if ( result != null && !(result instanceof Error) ) retval = new this(result);
      return retval;
    };
    */
    /*
    static async updateOne(_data) {

      let qp = this._buildQueryParams(_data, _data, 'insert');
      let q = `UPDATE ${this.tablename}
               SET ${ql.cols.join(', ')}
               WHERE id = ${qp.data[0]}::integer
               RETURNING *`;
      return await this.cl._runSingularQuery(q, qp.data, `updateOne${this.name}`).catch(function(e) { return e; });

      // let q = `UPDATE testtable2 SET title = $2::text, _testtable_ref = $3:integer WHERE id = $1::integer RETURNING *`;
      // let d = [_data.id, _data.title, _data._testtable_ref];
      // return this.cl._runSingularQuery(q, d, 'updateOne');
    };
    */

  };
  TestModel2.tablename   = 'testtable2';
  TestModel2._transmodel = {testmodel : 'testtable'};
  TestModel2.updateSchema({title : 'text', _testtable_ref : 'integer'});


  /**
   */
  let TestModel3 = class TestModel3 extends Service.WovModel {
    constructor(_data) { super(_data); }
    static async createOne(_data) {
      let retval = null;
      let q = `INSERT INTO testmodel3 (id, title, _testtable_ref) VALUES ( $1::integer, $2::text, $3::integer ) RETURNING *`;
      let d = [_data.id, _data.title, _data._testtable_ref];
      let result = await this.cl._runSingularQuery(q, d, 'TestModel3_createOne');
      if ( result != null && !(result instanceof Error) ) retval = new this(result);
      return retval;
    };
    static async updateOne(_id, _data) {
      let q = `UPDATE testmodel3 SET title = $2::text, _testtable_ref = $3:integer WHERE id = $1::integer RETURNING *`;
      let d = [_id, _data.title, _data._testtable_ref];
      return this.cl._runSingularQuery(q, d, 'TestModel3_updateOne');
    };

  };
  TestModel3.tablename   = 'testmodel3';
  TestModel3._plural     = 'testmodels3';
  TestModel3._transmodel = {testmodel3 : 'testtable'};
  TestModel3.updateSchema({_testtable_ref : 'integer', title : 'text'});

  // setup the service
  before(async function() {
    this.timeout(3000);
    await C.data('db').connect()
      .then(() => { logger.verbose('  ... db connected'); })
      .catch( (e) => { logger.throwError('  ... db connection error', e.stack); });

    await C.data('db').query('DROP TABLE IF EXISTS testtable')
      .catch( (e) => { logger.throwError('  ... db error', e.stack); });
    await C.data('db').query('CREATE TABLE testtable ( id SERIAL PRIMARY KEY, name varchar)')
      .catch( (e) => { logger.throwError('  ... db error', e.stack); });
    await C.data('db').query('DROP TABLE IF EXISTS testtable2')
      .catch( (e) => { logger.throwError('  ... db error', e.stack); });
    await C.data('db').query('CREATE TABLE testtable2 ( id SERIAL PRIMARY KEY, title varchar, _testtable_ref integer )')
      .catch( (e) => { logger.throwError('  ... db error', e.stack); });
    await C.data('db').query('DROP TABLE IF EXISTS testmodel3')
      .catch( (e) => { logger.throwError('  ... db error', e.stack); });
    await C.data('db').query('CREATE TABLE testmodel3 ( id SERIAL PRIMARY KEY, title varchar, _testtable_ref integer )')
      .catch( (e) => { logger.throwError('  ... db error', e.stack); });

    cl = new Service.WovModelClient(logger, C.data('db'), ['testtable', 'testtable2', 'testmodel3'], [TestModel, TestModel2, TestModel3]);
    TestModel.init(logger, cl);
    TestModel2.init(logger, cl, null, {testmodel : 'testtable'});
    TestModel3.init(logger, cl);
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

  describe('> WovModel', async function() {

    it(`> set / get : ${__fileloc}`, async function() {
      let val = new TestModel({name : 'A'});
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
      logger.info('val: ', val);
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
      expect(TestModel.isRef(tm1, 'name')).to.be.false;
      expect(TestModel2.isRef(tm2, 'title')).to.be.false;
      expect(TestModel2.isRef(tm2, '_testtable_ref')).to.be.true;
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
      // logger.info('tm3 data: ', tm3.get());

      let tm = await TestModel.readByID(data.id);
      await tm.readIn('testmodel3');
      // logger.info('tm data: ', tm.get());
      // logger.info('tm: ', tm);
      expect(tm.testmodel3).to.exist;
      expect(tm.testmodel3.get('_testtable_ref')).to.equal(tm.get('id'));
      // logger.info('testmodel3 data: ', tm.testmodel3.get());
    });


    it(`> readInMany (with plural and trans) : ${__fileloc}`, async function() {
      let tm1 = await TestModel.readByID(data.id);
      await tm1.readInMany('TestModel3');
      logger.info('tm1: ', tm1);
      expect(tm1.testmodels3).to.exist;

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

  after(async function() {
  });

});
