
/**
 * @typedef WoveonLogger
 * @typedef integer
 * @typedef WovModel
 * @typedef Promise
 * @typedef WovReturn
 */


/**
 */
class WovClientEntity {

  /**
   * Client.
   *
   * @param {WoveonLogger} _l -
   */
  constructor(_l) {
    this.l = _l;
  }


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
   * Generate the javascript code to resolve the schema for this client. Override as needed.
   *
   * @return {object} - {modeljs:,exportsjs:}
   */
  getGraphQLModelResolvers() {
    return {
      modeljs   : '',
      exportsjs : '',
    };
  }

  /**
   * Generates graphql schemas for the client. Override as needed.
   *
   * @return {string} -
   */
  getGraphQLSchemas() { return ''; }
};


/**
 */
class WovModelEntity {

  static cl = null; // set by WovClientRemote or WovClientLocal init()


  /**
   * Client.
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
   * @return {Promise} - ?returns I think the number of rows deleted?
   */
  static async deleteByID(_id) { return this.cl.deleteByID(_id, this); }


  /**
   * Asks the client to retrieve this model.
   *
   * @param {integer} _id -
   * @return {WovModel|Error} -
   */
  static async getByID(_id) { return this.cl.getByID(_id, this); }


  /**
   * Retrieves multiple models.
   *
   * @param {Array<integer>} _ids - ids of models to load.
   * @return {Promise} -
   */
  static async getByIDs(_ids) { return this.cl.getByIDs(_ids, this); }


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


module.exports = {WovClientEntity, WovModelEntity};
