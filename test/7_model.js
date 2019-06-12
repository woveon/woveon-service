
const expect    = require('chai').expect;
const Logger    = require('woveon-logger');
const WovReturn = require('../src/wovreturn');
const Service   = require('../src/index');

const express   = require('express');

const C         = require('woveon-service').Config;

let mtag ='model';

let logger = new Logger(mtag, {
  debug    : true,
  showName : true,
  level    : 'info',
  color    : 'inverse',
}, {
  titles : false,
});

describe(`>${mtag}: `, async function() {

  let cl = null;
  let data   = {id : 1, name : 'name'};
  let data2  = {id : 1, title : 'title', _testtable_ref : data.id};
  let fdata  = {name : 'name'};
  let fdata2 = {title : 'title'};


  /**
   */
  let TestModel = class TestModel extends Service.WovModel {

    /**
     */
    constructor(_data) { super(_data); }
    static async createOne(_data) { 
      let retval = null;
      let q = `INSERT INTO testtable (id, name) VALUES ( $1::integer, $2::text ) RETURNING *`;
      let d = [_data.id, _data.name];
      let result = await this.cl._runSingularQuery(q, d, 'createOne');
      if ( result != null ) retval = new this(result);
      return retval;
    };
    static async updateOne(_data) {
      let q = `UPDATE testtable SET name = $2::text WHERE id = $1::integer RETURNING *`;
      let d = [_data.id, _data.name];
      return this.cl._runSingularQuery(q, d, 'updateOne');
    };

  };
  TestModel.tablename = 'testtable';

  /**
   */
  let TestModel2 = class TestModel2 extends Service.WovModel {
    constructor(_data) { super(_data); }
    static async createOne(_data) { 
      let retval = null;
      let q = `INSERT INTO testtable2 (id, title, _testtable_ref) VALUES ( $1::integer, $2::text, $3::integer ) RETURNING *`;
      let d = [_data.id, _data.title, _data._testtable_ref];
      let result = await this.cl._runSingularQuery(q, d, 'createOne');
      if ( result != null ) retval = new this(result);
      return retval;
    };
    static async updateOne(_data) {
      let q = `UPDATE testtable SET title = $2::text, _testtable_ref = $3:integer WHERE id = $1::integer RETURNING *`;
      let d = [_data.id, _data.title, _data._testtable_ref];
      return this.cl._runSingularQuery(q, d, 'updateOne');
    };

  };
  TestModel2.tablename = 'testtable2';

  // setup the service
  before(async function() {
    this.timeout(3000);
    await C.data('db').connect()
      .then(() => { logger.info('  ... db connected'); })
      .catch( (e) => { logger.throwError('  ... db connection error', e.stack); });

    await C.data('db').query('DROP TABLE IF EXISTS testtable')
      .catch( (e) => { logger.throwError('  ... db error', e.stack); });
    await C.data('db').query('CREATE TABLE testtable ( id SERIAL PRIMARY KEY, name varchar)')
      .catch( (e) => { logger.throwError('  ... db error', e.stack); });
    await C.data('db').query('DROP TABLE IF EXISTS testtable2')
      .catch( (e) => { logger.throwError('  ... db error', e.stack); });
    await C.data('db').query('CREATE TABLE testtable2 ( id SERIAL PRIMARY KEY, title varchar, _testtable_ref integer )')
      .catch( (e) => { logger.throwError('  ... db error', e.stack); });

    cl = new Service.WovModelClient(logger, C.data('db'), ['testtable', 'testtable2'], [TestModel, TestModel2]);
    TestModel.init(logger, cl);
  });

  it('> read null', async function() {
    let val = await TestModel.readByID(data.id);
    expect(val).to.be.null;
  });

  it('> create', async function() {
    let val = await TestModel.createOne(data);
    // logger.info('val: ', val);
    expect(val.data.id).to.equal(data.id, val);
  });

  it('> read 1', async function() {
    let val = await TestModel.readByID(data.id);
    // logger.info('val: ', val);
    expect(val).to.not.be.null;
    expect(val.data).to.deep.equal(data);
  });

  it('> update 1 to name2', async function() {
    let data2 = {id : data.id, name : 'name2'};
    let val = await TestModel.updateOne(data2);
    // logger.info('val: ', val);
    expect(val).to.deep.equal(data2);
    let val2 = await TestModel.readByID(data.id);
    expect(val2.data).to.deep.equal(data2);
  });

  it('> delete 1', async function() {
    let val = await TestModel.deleteByID(data.id);
    // logger.info('val: ', val);
    expect(val.id).to.equal(data.id);
    let val2 = await TestModel.readByID(data.id);
    expect(val2).to.be.null;
  });

  it('> isRef', async function() {
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

  it('> flatten', async function() {
    let tm1 = await TestModel.readByID(data.id);
    let tm2 = await TestModel2.readByID(data2.id);
    // logger.info('tm1 flatten: ', tm1.flatten());
    // logger.info('tm2 flatten: ', tm2.flatten());
    expect(tm1.flatten()).to.deep.equal(fdata);
    expect(tm2.flatten()).to.deep.equal(fdata2);
  });

  it('> readComp', async function() {
    let tm2 = await TestModel2.readByID(data2.id);
    await tm2.readComp('testtable');
    expect(tm2.testtable).to.exist;
    expect(tm2.testtable instanceof TestModel).to.be.true;
  });

  it('> flatten component', async function() {
    let tm2 = await TestModel2.readByID(data2.id);
    await tm2.readComp('testtable');
    // now test flatten
    // logger.info('tm2 flatten: ', tm2.flatten());
    expect(tm2.flatten()).to.deep.equal({title : data2.title, testtable : {name : data.name}});

  });

  after(async function() {
  });

});
