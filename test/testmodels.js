

const Logger  = require('woveon-logger');
const Service = require.main.require('src/index');
const WR      = Service.WovReturn;


module.exports = function() {


  /**
   * A simple model, but with tablename entry.
   */
  const TestModel = class TestModel extends Service.WovModel {
    /**
     * @param {Object} _data -
     */
    constructor(_data) { super(_data); }
  };
  TestModel.tablename    = 'testtable';
  TestModel._transmodel = {};
  TestModel.updateSchema({name : 'text'});


  /**
   * A model with a _transmodel entry
  */
  const TestModel2 = class TestModel2 extends Service.WovModel {
    /**
     * @param {Object} _data -
     */
    constructor(_data) { super(_data); };
  };
  TestModel2.tablename   = 'testtable2';
  TestModel2._transmodel = {testmodel : 'testtable'};
  TestModel2.updateSchema({title : 'text', _testtable_ref : 'integer'});


  /**
   * With a plural and transmodel.
   */
  const TestModel3 = class TestModel3 extends Service.WovModel {
    /**
     * @param {Object} _data -
     */
    constructor(_data) { super(_data); }
    /*
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
    */

  };
  TestModel3.tablename   = 'testmodel3';
  TestModel3._plural     = 'testmodels3';
  TestModel3._transmodel = {testmodel3 : 'testtable'};
  TestModel3.updateSchema({_testtable_ref : 'integer', title : 'text'});


  // ---------------------------------------------------------------------
  // Model with one-to-many-AssModelP
  const ParentModel = class ParentModel extends Service.WovModel {
    static tablename = 'parenttable';
    constructor(_data) { super(_data); } // eslint-disable-line require-jsdoc
  };
  ParentModel.updateSchema({title : 'text'});

  // ---------------------------------------------------------------------
  // Child Model of ParentModel with one-to-one AssModelC pointing to this
  const ChildModel = class ChildModel extends ParentModel {
    static tablename = 'childmodel';
    constructor(_data) { super(_data); } // eslint-disable-line require-jsdoc
  };
  ChildModel.updateSchema({ctitle : 'text'});

  // ---------------------------------------------------------------------
  // Child Child Model of ParentModel pointing to one-to-one AssModelC
  const ChildChildModel = class ChildChildModel extends ChildModel {
    static tablename = 'childchildmodel';
    constructor(_data) { super(_data); } // eslint-disable-line require-jsdoc
  };
  ChildChildModel.updateSchema({cctitle : 'text', _assmodelc_ref : 'integer'});

  // ---------------------------------------------------------------------
  // Associated model which points to ParentModel
  const AssModelP = class AssModelP extends Service.WovModel {
    static tablename = 'assmodelp';
    constructor(_data) { super(_data); } // eslint-disable-line require-jsdoc
  };
  AssModelP.updateSchema({title : 'text', _parenttable_ref : 'integer'});

  // ---------------------------------------------------------------------
  // Associated model with ChildChildModel pointing to this and pointing to ChildModel
  const AssModelC = class AssModelC extends Service.WovModel {
    static tablename = 'assmodelc';
    constructor(_data) { super(_data); } // eslint-disable-line require-jsdoc
  };
  AssModelC.updateSchema({title : 'text', _childmodel_ref : 'integer'});

  const MP = class MP extends Service.WovModel {
    static tablename = 'modelp';
    constructor(_data) { super(_data); } // eslint-disable-line require-jsdoc
  };
  MP.updateSchema({title : 'text', pp : 'text',  sensitive : ['pp'] });


  const Car = class Car extends Service.WovModel { static tablename = 'car'; constructor(_data) { super(_data); } }; // eslint-disable-line require-jsdoc
  Car.updateSchema({nameplate : 'text', make : 'text', license : 'text', state : 'text'});

  const Tire = class Tire extends Service.WovModel { static tablename = 'tire'; constructor(_data) { super(_data); } }; // eslint-disable-line require-jsdoc
  Tire.updateSchema({brand : 'text', model : 'text', position : 'text', wear : 'float', _car_ref : 'integer'});

  const Wheel = class Wheel extends Service.WovModel { static tablename = 'wheel'; constructor(_data) { super(_data); } }; // eslint-disable-line require-jsdoc
  Wheel.updateSchema({style : 'text', _tire_ref : 'integer'});


  let models = {TestModel, TestModel2, TestModel3, ParentModel, ChildModel, ChildChildModel, AssModelP, AssModelC, MP, Car, Tire, Wheel};

  // return Object.assign({}, models, {onBefore});
  return models;
};

