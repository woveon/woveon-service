
/**
 * @typedef WoveonLogger
 * @typedef integer
 * @typedef WovModel
 * @typedef Promise
 * @typedef WovReturn
 * @typedef WovStateLayer
 */

const Logger = require('woveon-logger');

/**
 */
class WovModelEntity {

  static cl = null; // set by WovClientRemote or WovClientLocal init()


  /**
   * Model.
   */
  constructor() {
  }


  /**
   * Saves this model to persistent storage via the client.
   *
   * @return {boolean|Error} - true if was saved, false if not saved (no dirty data), Error if error
   */
  async save() { return this.constructor.cl.saveOne(this); }


  /**
   * Creates it in the database, then creates and returns the model.
   *
   * @param {object} _data -
   * @return {WovModel|WovReturn<Error>} - returns the newly created object.
   */
  static async createOne(_data) { return this.cl.createOne(_data, this); }

  /**
   * Writes back to the DB. Unlike save, this does not require a model.
   *
   * @param {integer} _id -
   * @param {object} _data - data to update on the model
   * @return {?} -
   */
  static async updateOne(_id, _data) { return this.cl.updateOne(_id, _data, this); }


  /**
   * Deletes a row form the table that is the data of the model object.
   *
   * @param {integer} _id -
   * @return {Promise} - returns {id : X} where X is id of the deleted model
   */
  static async deleteByID(_id) { return this.cl.deleteByID(_id, this); }


  /**
   * Asks the client to retrieve this model.
   *
   * @param {integer} _id -
   * @param {string} _fields - for remote clients, a string of the fields you wish to return; null will return all known fields of this model
   * @return {WovModel|Error} -
   */
  static async getByID(_id, _fields = null) { return this.cl.getByID(_id, this, _fields); }


  /**
   * Retrieves multiple models.
   *
   * @param {Array<integer>} _ids - ids of models to load.
   * @param {string} _fields - for remote clients, a string of the fields you wish to return; null will return all known fields of this model
   * @return {Promise} -
   */
  static async getByIDs(_ids, _fields = null) { return this.cl.getByIDs(_ids, this, _fields); }


  /**
   * Get a model instance by the XID (external id) value.
   * XIDs are good ways to hide internal identifiers from misuse (but keep in mind, ids are faster!).
   *
   * @param {integer} _xid -
   * @return {WovModel} -
   */
  static async getByXID(_xid) { return this.cl.getByXID(_xid, this); }


  /**
   * Helper function for isRef.
   *
   * @param {string} _ref - property to check
   * @return {boolean} - true if it is a ref
   */
  static isRef(_ref) {
    let retval = false;
    if ( _ref == null ) {}
    else if ( _ref.startsWith('_') && _ref.endsWith('_ref') ) { retval = true; }
    return retval;
  }


  /**
   * Simple check if `init` has been called on this class definition.
   *
   * @return {boolean} - true if it has, false if not
   */
  static isInited() { let retval = false; if ( this.l != null && this.cl != null ) retval = true; return retval; }

};


/**
 */
class WovClientEntity {


  /**
   * Client.
   *
   * @param {WoveonLogger} _l -
   * @param {Array<WovModel>} _models - models on this client
   */
  constructor(_l, _models) {
    this.l = _l;
    this._models = _models;

    _models.forEach( function(m) {
      this.l.aspect('ms.WovClient.constructor', `...loading WovModel : '${m.name}'. has child: ${m._haschildren}`);
      this.l.aspect('ms.wovClient.constructor', `...loading WovModel : '${m.name}' on client as 'model_${m.name.toLowerCase()}' and '${m.name}'`);
      m.init(this.l, this);
      this[m.name] = m;
      this[`model_${m.name.toLowerCase()}`] = m;
    }.bind(this));
  }


  /**
   * Sets the statelayer for the client.
   *
   * @param {WovStateLayer} _sl -
   * @return {undefined} -
   */
  async init(_sl) { this.statelayer = _sl; }

  /**
   * Does nothing, but is basically pure virtual.
   *
   * @return {null} -
   */
  static async init() { throw Error('Implement me: WovClientEntity::init.'); }


  /**
   * Saves this model to persistent storage via the client.
   *
   * @param {WovModel} _model - the model to save
   * @return {boolean|Error} - true if was saved, false if not saved (no dirty data), Error if error
   */
  async saveOne(_model) { throw Error('Implement me: WovClientEntity::saveOne.'); }


  /**
   * Generates graphql schemas for the client. Override as needed.
   *
   * @return {string} -
   */
  /*
  getGraphQLSchemas() {
    return {
      queries   : '',    // query definitions ex. getX(id : ID!) : X
      mutations : '',    // mutations. ex. createX(xToCreate : iCreateX!) : X
      query_t   : '',    // query/mutation types for mutations and create/update. ex. iCreateX { foo : String! }
      schemas   : '',    //
    };
  }
  */


  /**
   * Generate the javascript code to resolve the schema for this client. Override as needed.
   *
   * @return {object} - {modeljs:,exportsjs:}
   */
  /*
  getGraphQLResolvers() {
    return {
      queryjs    : '',   // query implementations
      mutationjs : '',   // mutation implementations
      modeljs    : '',   // data relationships of models (ex. const Car = { tires : async function(...) {...}}, )
      exportsjs  : '',   // the models to export ex. "X, Y"
    };
  }
  */

};


module.exports = {WovClientEntity, WovModelEntity};
