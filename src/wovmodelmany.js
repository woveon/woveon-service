
/**
 * @typedef integer
 * @typedef WovModel
 * @typedef Promise
 */

const Logger = require('woveon-logger');

/**
 * A class to store one to many relationships when they are read in. Provides some helper functions.
 *
 * replaces: Object.values(x)[0]
 * with    : x.pos(0)
 */
class _WovModelMany {


  /**
   * Gets each key's value from the objects in this as an array.
   *
   * @param {string} _key - data item to return from all
   * @return {Array} - array of that key for all in this
   */
  get(_key = null ) {
    let retval = [];
    for (let k in this) { if ( this.hasOwnProperty(k) ) { retval.push(this[k].get(_key)); } }
    return retval;
  }


  /**
   * Gets the ith model instance in this.
   *
   * @param {integer} _i - index to return
   * @return {WovModel} -
   */
  pos(_i) { return Object.values(this)[_i]; }


  /**
   * Returns the number of model instances in this. Emulates syntax of Array.length.
   *
   * @return {integer} -
   */
  get length() { return Object.values(this).length; }


  /**
   * Merges from another WovModelMany.
   *
   * @param {WovModelMany} _wmm -
   * @return {undefined} -
   */
  merge(_wmm) {
    let ks = Object.keys(_wmm);
    // Logger.g().info('merge');
    for (let i=0; i<ks.length; i++) {
      let k = `${ks[i]}`;
      // Logger.g().info(` merge: i:${i} k:${k}`);
      if ( _wmm.hasOwnProperty(k) ) {
        // Logger.g().info(` merging i:${i} k:${k}`);
        this[k] = _wmm[k];
      }
    }
  }


  /**
   * Converts this to an array.
   *
   * @return {Array<WovModel>} - all values
   */
  all() { return Object.values(this); }


  /**
   * Returns the model instance in this with the id of _id.
   *
   * @param {integer} _id - object with id to return
   * @return {WovModel} -
   */
  id(_id) { return this[_id]; }


  /**
   * Calls readInMany on each item.
   *
   * @param {string} _t - model to read in
   * @param {object} _limiters -
   * @return {Array<WovModel>} - models read in
   */
  /*
  async readInMany(_t, _limiters = {}) {
    let retval = [];
    let proms = [];
    for (let k in this) {
      if ( this.hasOwnProperty(k) ) {
        // Logger.g().info(`${this[k].constructor.name}(id ${k}).readInMany ${_t}`);
        proms.push( this[k].readInMany(_t, _limiters).then( function(_m) { retval.push(_m); })); // does this maintain the order?
      }
    }
    await Promise.all(proms);
    return retval;
  }
  */


  /**
   * Read In called on each.
   *
   * @param {string} _selector - Selector passed to each model instance in this.
   * @return {Array<Promise>} - the array of promises of the reading in model instances.
   */
  async readIn(_selector) {
    let retval = [];
    let proms = [];

    for (let k in this) {
      if ( this.hasOwnProperty(k) ) {
        // Logger.g().info(`WovModelMany(${_selector}) '${k}' :`);
        proms.push( this[k].readIn(_selector).then( function(_m) { retval.push(_m); })); // does this maintain the order?
      }
    }
    await Promise.all(proms);

    return retval;
  }


  /**
   * For readIn models of _k, on each Model in htis, place into a new WovModelMany and return
   * ex. car.tires.select('wheel') -> returns WovModelMany<Wheel>, one for each tire.
   *
   * @param {string} _k -
   * @return {WovModelMany<WovModel>} -
   */
  select(_k) {
    let retval = new WovModelMany();
    for (let k in this) {
      if ( this.hasOwnProperty(k) ) {
        // Logger.g().info(`WovModelMany select (${_k}) '${k}' :`);
        // Logger.g().info(`   WovModelMany select k: `, this[k][_k]);
        let t = this[k][_k];
        // Logger.g().info(`   WovModelMany select t: `, t);
        if ( t == null ) Logger.g().throwError(`Nothing readIn for '${_k}'`);
        if ( t instanceof WovModelMany ) { retval.merge(t); }
        else retval[t.get('id')] = t;
        // Logger.g().info('retval: ', retval);
      }
    }
    // Logger.g().info('WovModelMany returning: ', retval);
    return retval;
  }


  /**
   * Calls flatten on all objects in this.
   *
   * @param {boolean} _recurse - whether to continue flattening the objects in this.
   * @return {Array} - array of flattened model instances
   */
  flatten(_options = {}) {
    let retval = [];
    for (let k in this) { if ( this.hasOwnProperty(k) ) { retval.push(this[k].flatten(_options)); } }
    return retval;
  }


}


/**
 * so 'this' won't have utility functions and will look like a regular hash
 */
class WovModelMany extends _WovModelMany {};

module.exports = WovModelMany;
