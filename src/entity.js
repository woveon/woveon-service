/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

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
  async save() {
    if ( this.constructor.cl == null ) {
      throw Error(`in ${this.name}: Model has no client for 'save' call. `+
                  `Make sure a WovClientX has been created with this model passed in.`);
    }
    return this.constructor.cl.saveOne(this);
  }


  /**
   * Creates it in the database, then creates and returns the model.
   *
   * @param {object} _data -
   * @return {WovModel|WovReturn<Error>} - returns the newly created object.
   */
  static async createOne(_data, _nothing) {
    if ( _nothing !== undefined ) {
      throw Error(`in '${this.name}': was called with multiple values, which should have only been one object: _data`);
    }
    if ( this.cl == null ) {
      throw Error(`in '${this.name}': Model has no client for 'createOne' call. `+
                  `Make sure a WovClientX has been created with this model passed in.`);
    }
    return this.cl.createOne(_data, this);
  }

  /**
   * Writes back to the DB. Unlike save, this does not require a model.
   *
   * @param {integer} _id -
   * @param {object} _data - data to update on the model
   * @return {?} -
   */
  static async updateOne(_id, _data) {
    if ( this.cl == null ) {
      throw Error(`in ${this.name}: Model has no client for 'updateOne' call. `+
                  `Make sure a WovClientX has been created with this model passed in.`);
    }
    return this.cl.updateOne(_id, _data, this);
  }


  /**
   * Deletes a row form the table that is the data of the model object.
   *
   * @param {integer} _id -
   * @return {Promise} - returns {id : X} where X is id of the deleted model
   */
  static async deleteByID(_id) {
    if ( this.cl == null ) {
      throw Error(`in ${this.name}: Model has no client for 'deleteByID' call. `+
                  `Make sure a WovClientX has been created with this model passed in.`);
    }
    return this.cl.deleteByID(_id, this);
  }


  /**
   * Asks the client to retrieve this model.
   *
   * @param {integer} _id -
   * @param {string} _fields - for remote clients, a string of the fields you wish to return; null will return all known fields of this model
   * @return {WovModel|Error} -
   */
  static async getByID(_id, _fields = null) {
    if ( this.cl == null ) {
      throw Error(`in ${this.name}: Model has no client for 'getByID' call. `+
                  `Make sure a WovClientX has been created with this model passed in.`);
    }
    return this.cl.getByID(_id, this, _fields);
  }


  /**
   * Retrieves multiple models.
   *
   * @param {Array<integer>} _ids - ids of models to load.
   * @param {string} _fields - for remote clients, a string of the fields you wish to return; null will return all known fields of this model
   * @return {Promise} -
   */
  static async getByIDs(_ids, _fields = null) {
    if ( this.cl == null ) {
      throw Error(`in ${this.name}: Model has no client for 'getByIDs' call. `+
                  `Make sure a WovClientX has been created with this model passed in.`);
    }
    return this.cl.getByIDs(_ids, this, _fields);
  }


  /**
   * Get a model instance by the XID (external id) value.
   * XIDs are good ways to hide internal identifiers from misuse (but keep in mind, ids are faster!).
   *
   * @param {integer} _xid -
   * @return {WovModel} -
   */
  static async getByXID(_xid) {
    if ( this.cl == null ) {
      throw Error(`in ${this.name}: Model has no client for 'getByXID' call. `+
                  `Make sure a WovClientX has been created with this model passed in.`);
    }
    return this.cl.getByXID(_xid, this);
  }


  /**
   * Gets all of this model using the _ref, which is to the 'me' model.
   *
   * Ex. A.getToMe(x, '_a_ref', B) would find every B pointing to A.
   *
   * @param {integer} _id -
   * @param {string} _ref - the ref to 'me'
   * @param {object} _limiters - restricts which models to return
   * @param {string} _fields - for remote clients, a string of the fields you wish to return; null will return all known fields of this model
   * @return {object} -
   */
  static async getToMe(_id, _ref, _limiters = null, _fields = null) {
    // Logger.g().info(`${this.name}::getToMe hit`, _id, _ref, `calling this.cl.getToMe on ${this.cl.constructor.name}`);
    if ( this.cl == null ) {
      throw Error(`in ${this.name}: Model has no client for 'getToMe' call. `+
        `Make sure a WovClientX has been created with this model passed in.`);
    }
    return this.cl.getToMe(_id, _ref, this, _limiters, _fields);
  }


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
   * Converts _X_ref to X_id. (NOTE: does no checking, assuming _ref is in fact a ref. Try isRef(_ref) before.
   *
   * @param {string} _ref - a reference to a table.
   * @return {string} - an id
   */
  static refToID(_ref) { let retval = _ref.slice(1, -4); retval = `${retval}_id`; return retval; }

  /**
   * Converts X_id to _X_ref. (NOTE: does no checking, assuming _id is in fact an id.
   *
   * @param {string} _id - an id of a table.
   * @return {string} - a ref
   */
  static idToRef(_id) { let retval = _id.slice(0, -3); retval = `_${retval}_ref`; return retval; }

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


};


/**
 * Generates graphql schemas for the client. Override as needed.
 *
 * @return {string} -
 */
function getBlankServerConfig_Schemas() {
  let retval = {
    queries   : '',    // query definitions ex. getX(id : ID!) : X
    mutations : '',    // mutations. ex. createX(xToCreate : iCreateX!) : X
    query_t   : '',    // query/mutation types for mutations and create/update. ex. iCreateX { foo : String! } TODO input_t
    schemas   : '',    // output tyeps ex. X { foo : String!}
  };
  return retval;
}

/**
 * Generate the javascript code to resolve the schema for this client. Override as needed.
 *
 * @return {object} - {modeljs:,exportsjs:}
 */
function getBlankServerConfig_Resolvers() {
  let retval = {
    queryjs    : '',   // query implementations
    mutationjs : '',   // mutation implementations
    modeljs    : '',   // data relationships of models (ex. const Car = { tires : async function(...) {...}}, )
    exportsjs  : '',   // the models to export ex. "X, Y"
  };
  return retval;
}


/**
 * Merges contents of _from, into _into.
 *
 * @param {object} _into - appends strings of _from, into this
 * @param {object} _from - copies strings from
 * @return {undefined} -
 */
function mergeServerConfigStrings_Schemas(_into, _from) {
  _into.queries   += `\n${_from.queries}`;
  _into.mutations += `\n${_from.mutations}`;
  _into.query_t   += `\n${_from.query_t}`;
  _into.schemas   += `\n${_from.schemas}`;
}


/**
 * Merges contents of _from, into _into.
 *
 * @param {object} _into - appends strings of _from, into this
 * @param {object} _from - copies strings from
 * @return {undefined} -
 */
function mergeServerConfigStrings_Resolvers(_into, _from) {
  _into.queryjs    += `\n${_from.queryjs}`;
  _into.mutationjs += `\n${_from.mutationjs}`;
  _into.modeljs    += `\n${_from.modeljs}`;
  _into.exportsjs  += `\n${_from.exportsjs}`;
}


/**
 * Merge all code in _from, into _into.
 *
 * @param {object} _into - object containing resolver code (ex. Queries, Mutation, etc)
 * @param {object} _from - object container resolver code to add into _into
 * @return {undefined} -
 */
function mergeServerConfigCode_Resolvers(_into, _from) {
  // Logger.g().info('mergeServerConfigCode_Resolvers called : ');
  // Logger.g().info('  :into: ', Object.keys(_into));
  // Logger.g().info('  :from: ', Object.keys(_from));

  Object.keys(_from).forEach( function(_k) {
    if ( _from.hasOwnProperty(_k) ) {
      // Logger.g().info('mergeServerConfigCode_Resolvers: ', _k);
      // Logger.g().info('into k is : ', _into[_k]);
      if ( _into[_k] == undefined ) _into[_k] = {};
      Object.assign(_into[_k], _from[_k]);
      // Logger.g().info('into k is now : ', _into[_k]);
    }
  });
  // Logger.g().h3().info(_into);
}

module.exports = {WovClientEntity, WovModelEntity, getBlankServerConfig_Schemas, getBlankServerConfig_Resolvers,
                  mergeServerConfigStrings_Schemas, mergeServerConfigStrings_Resolvers, mergeServerConfigCode_Resolvers};
