
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
  let data = {id : 1, name : 'name'};

  /**
   */
  let TestModel = class TestModel extends Service.WovModel {
    /**
     */
    constructor(_data) { super(_data); }
    static async createOne(_data) { 
      let q = `INSERT INTO testtable (id, name) VALUES ( $1::integer, $2::text ) RETURNING id`;
      let d = [_data.id, _data.name];
      return this.cl._runSingularQuery(q, d, 'createOne');
    };
    static async updateOne(_data) {
      let q = `UPDATE testtable SET name = $2::text WHERE id = $1::integer RETURNING *`;
      let d = [_data.id, _data.name];
      return this.cl._runSingularQuery(q, d, 'updateOne');
    };

  };
  TestModel.tablename = 'testtable';

  // setup the service
  before(async function() {
    this.timeout(3000);
    await C.data('db').connect()
      .then(() => { logger.info('  ... db connected'); })
      .catch( (e) => { logger.throwError('  ... db connection error', e.stack); });

    await C.data('db').query('DROP TABLE IF EXISTS testtable')
      .catch( (e) => { logger.throwError('  ... db error', e.stack); });
    await C.data('db').query('CREATE TABLE testtable ( id SERIAL PRIMARY KEY, name varchar )')
      .catch( (e) => { logger.throwError('  ... db error', e.stack); });

    cl = new Service.WovModelClient(logger, C.data('db'), ['testtable']);
    TestModel.init(logger, cl);
  });

  it('> read null', async function() {
    let val = await TestModel.readByID(data.id);
    expect(val).to.be.null;
  });

  it('> create', async function() {
    let val = await TestModel.createOne(data);
    // logger.info('val: ', val);
    expect(val.id).to.equal(data.id);
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

  after(async function() {
  });

});
