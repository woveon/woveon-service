
/**
 * This is a base class of every "thing" which has a model in our system.
 * It connects to the database through a wovmodelclient.
 */
class WovModel {

  /**
   */
  constructor(_data) { this.data = _data; }

  /**
   * Returns the data of this object, without ids and refs. Any components are flattened by default.
   * @param {bool} _recurse - if true, flattens components that have been dereferenced
   * @return {Object}
   */
  flatten(_recurse = true) {
    let retval = JSON.parse(JSON.stringify(this.data)); // duplicate data
    // console.log('flatten : ', retval);

    // delete id
    delete retval.id;

    // delete all refs
    for ( let k in retval ) {
      if ( retval.hasOwnProperty(k) ) { if ( this.isRef(k) ) { delete retval[k]; } }
    }

    // flatten component WovModels recursively
    if ( _recurse ) {
      for ( let k in this ) {
        if ( this.hasOwnProperty(k) ) {
          let v = this[k];
          if ( v instanceof WovModel ) {
            retval[k] = v.flatten();
          }
        }
      }
    }

    // console.log('  - flattened : ', retval);

    return retval;
  }


  /**
   * Reads the component of this and sets on itself. The component should have a data ref (ex. this.data._X_ref for component X).
   *  ex. readComp('account'), looks for this.data._account_ref, then reads from table 'account'.
   * @param {string} _comp - property to check
   * @return {Object} - the component object if found
   */
  async readComp(_comp) {
    let retval = null;
    // this.constructor.l.info('readComp: ', _comp);
    let mod = this.constructor.cl.getModelByTablename(_comp);
    if ( mod != null && (mod.prototype  instanceof WovModel) ) {
      let cid = this.data[`_${mod.tablename}_ref`];
      if ( cid != null ) {
        let result = await mod.readByID(cid);
        if ( result != null ) {
          this[mod.tablename] = result;
          retval = result;
        }
      }
    }
    return retval;
  }


  /**
   * Refs are _X_ref, where X references an item in a table. 
   * NOTE: refs are to tablenames, NOT model class names
   * @param {string} _ref - property to check
   * @return {boolean} - true if it is a ref
   */
  isRef(_ref) {
    // console.log('isRef: ', _ref, this.data[_ref]);
    let retval = false;
    if ( _ref == null ) {}
    else if ( _ref.startsWith('_') && _ref.endsWith('_ref') && this.data[_ref] !== undefined ) { retval = true; }
    return retval;
  }
  static isRef(_obj, _ref) { return _obj.isRef(_ref); }

  /**
   * @param {Logger}         _logger         - woveon logger
   * @param {WovModelClient} _wovmodelclient -
   * @param {object}         _schema         - ?Do I have a need for this yet?
   * @param {string}         _tablename      - The name of the database table this accesses. Defaults to class name lowercase.
   */
  static init(_logger, _wovmodelclient, _schema = null) {
    this.l = _logger;
    this.cl= _wovmodelclient;
    if ( this.tablename == null ) throw Error(`WovModel(${this.name}) requires model to set static tablename .`);
    this.schema = _schema;
    this.l.aspect('wovmodelinit', `...init model '${this.name}', table '${this.tablename}', schema : `, this.schema);
  }



  /**
   * @param {integer} _id -
   * @return {WovModel} -
   */
  static async readByID(_id) {
    let retval = null;
    // console.log('readByID : this: ', this, this.tablename);
    let data = await this.cl._selectByID(_id, this.tablename);
    // console.log('data is ', data);
    if ( data != null ) { retval = new this(data); }
    return retval;
  }

  /**
   * @param {integer} _id
   */
  static async deleteByID(_id) {
    let q = `DELETE FROM ${this.tablename} WHERE id=$1::integer RETURNING id`;
    let d = [_id];
    return this.cl._runSingularQuery(q, d, `deleteByID${this.name}`);
  }

  /**
   * @param {object} _data
   * @return {this} - returns the newly created object.
   */
  static async createOne(_data) { this.l.throwError(`Need to implement 'createOne' for ${this.name}.`); }

  /**
   * @param {integer} _id
   * @param {object} _data
   */
  static async updateOne(_id, _data) { this.l.throwError(`Need to implement 'updateOne' for ${this.name}.`); }

};

module.exports = WovModel;
