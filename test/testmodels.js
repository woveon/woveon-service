

const Logger  = require('woveon-logger');
const Service = require.main.require('src/index');
const WR      = Service.WovReturn;


module.exports = function() {


  /**
   * A simple model, but with tablename entry.
   */
  const TestModel = class TestModel extends Service.WovModel { static tablename = 'testtable'; };
  TestModel.setSchema({schema : {name : 'text'}});


  /**
   * A model with a _transmodel entry
   */
  const TestModel2 = class TestModel2 extends Service.WovModel { static tablename = 'testtable2'; };
  TestModel2.setSchema({schema : {title : 'text', _testmodel_ref : 'integer'}, trans : {testmodel : 'testmodel'}});


  /**
   * With a plural and transmodel.
   */
  const TestModel3 = class TestModel3 extends Service.WovModel { static tablename = 'testmodel3'; static _plural = 'testmodels3'; };
  TestModel3.setSchema({
    schema : {_testmodel_ref : 'integer', title : 'text'},
    trans  : {testmodel : 'TestModel'},
    erels  : {testmodel : 'many'},
  });


  // ---------------------------------------------------------------------
  // Model with one-to-many-AssModelP
  const ParentModel = class ParentModel extends Service.WovModel { static tablename = 'parenttable'; };
  ParentModel.setSchema({schema : {title : 'text'}});

  // ---------------------------------------------------------------------
  // Child Model of ParentModel with one-to-one AssModelC pointing to this
  const ChildModel = class ChildModel extends ParentModel { static tablename = 'childmodel'; };
  ChildModel.setSchema({schema : {ctitle : 'text'}});

  // ---------------------------------------------------------------------
  // Child Child Model of ParentModel pointing to one-to-one AssModelC
  const ChildChildModel = class ChildChildModel extends ChildModel {
    static tablename = 'childchildmodel';
    constructor(_data) { super(_data); } // eslint-disable-line require-jsdoc
  };
  ChildChildModel.setSchema({schema : {cctitle : 'text', _assmodelc_ref : 'integer'}});

  // ---------------------------------------------------------------------
  // Associated model which points to ParentModel
  const AssModelP = class AssModelP extends Service.WovModel { static tablename = 'assmodelp'; };
  AssModelP.setSchema({
    schema : {title : 'text', _parentmodel_ref : 'integer'},
    erels  : {parentmodel : 'many'},
  });

  // ---------------------------------------------------------------------
  // Associated model with ChildChildModel pointing to this and pointing to ChildModel
  const AssModelC = class AssModelC extends Service.WovModel { static tablename = 'assmodelc'; };
  AssModelC.setSchema({
    schema : {title : 'text', _childmodel_ref : 'integer'},
    erels  : {childmodel : 'many'},
  });

  const MP = class MP extends Service.WovModel { static tablename = 'modelp'; };
  MP.setSchema({schema : {title : 'text', pp : 'text', sensitive : ['pp'] }});


  // ---------------------------------------------------------------------
  // Car / Tire / Wheel
  const Car = class Car extends Service.WovModel { static tablename = 'car'; };
  Car.setSchema({schema : {nameplate : 'text', make : 'text', license : 'text', state : 'text', combo : 'text'}, sensitive : ['combo'] });

  const Tire = class Tire extends Service.WovModel { static tablename = 'tire'; };
  Tire.setSchema({
    schema : {brand : 'text', model : 'text', position : 'text', wear : 'float', _car_ref : 'integer'},
    erels  : {car : 'many'},
  });

  const Wheel = class Wheel extends Service.WovModel { static tablename = 'wheel'; };
  Wheel.setSchema({
    schema : {style : 'text', _tire_ref : 'integer'},
    erels  : {tire : 'many'},
  });


  // ---------------------------------------------------------------------

  // ReadInA and ReadInB are used to test 4 readIn cases. see 7b_model
  const ReadInA = class ReadInA extends Service.WovModel { static tablename   = 'readina'; };
  ReadInA.setSchema({schema : {_named_ref : 'integer', _readinb_ref : 'integer'}, trans : {named : 'ReadInB'}});

  const ReadInB = class ReadInB extends Service.WovModel { static tablename   = 'readinb'; };
  ReadInB.setSchema({schema : {_named_ref : 'integer', _readina_ref : 'integer'}, trans : {named : 'ReadInA'}});

  const ReadInC = class ReadInC extends Service.WovModel { static tablename   = 'readinc'; };
  ReadInC.setSchema({schema : {_nameda_ref : 'integer', _readina_ref : 'integer'}, trans : {nameda : 'ReadInA'}});

  const ReadInCChild = class ReadInCChild extends ReadInC { static tablename   = 'readincchild'; };
  ReadInCChild.setSchema({schema : {_namedb_ref : 'integer', _readinb_ref : 'integer'}, trans : {namedb : 'ReadInB'}});


  // ---------------------------------------------------------------------
  /**
   * SingularTest[A|B|C] - A points to B singularly, B points to A both singularly and many. B uses the _singular to define this.
   * C inherits from B so we have to check that.
   */
  const SingularTestA = class SingularTestA extends Service.WovModel { static tablename = 'singulartesta'; };
  SingularTestA.setSchema({schema : {name : 'text'}});

  const SingularTestB = class SingularTestB extends Service.WovModel { static tablename = 'singulartestb'; };
  SingularTestB.setSchema({
    schema : {name : 'text', _toa1_ref : 'integer', _toam_ref : 'integer'}, // named for: "To A Singular", "To A Many"
    trans  : {toa1 : 'SingularTestA', toam : 'SingularTestA'},
    erels  : {toa1 : 'one', toam : 'many'},
  });

  const SingularTestC = class SingularTestC extends SingularTestB { static tablename = 'singulartestc'; };
  SingularTestC.setSchema({
    schema : {_tob1_ref : 'integer', _tobm_ref : 'integer'}, // named for: "To B Singular", "To B Many"
    trans  : {tob1 : 'SingularTestB', tobm : 'SingluarTestB'},
    erels  : {tob1 : 'one', tobm : 'many'},
  });


  // NOTE: all new models need to be added to the client that they are used in!
  let models = {
    TestModel, TestModel2, TestModel3,
    ParentModel, ChildModel, ChildChildModel,
    AssModelP, AssModelC,
    MP,
    Car, Tire, Wheel,
    ReadInA, ReadInB, ReadInC, ReadInCChild,
    SingularTestA, SingularTestB, SingularTestC,
  };

  // return Object.assign({}, models, {onBefore});
  return models;
};

