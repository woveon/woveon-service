
const Logger = require('woveon-logger');

/**
 * A class to store one to many relationships when they are read in. Provides some helper functions.
 *
 * replaces: Object.values(x)[0]
 *     with: x.pos(0)
 */
class _WovModelMany {

  /**
   * @param {string} _key - data item to return from all
   * @return {Array} - array of that key for all in this
   */
  get(_key = null ) {
    let retval = [];
    for (let k in this) { if ( this.hasOwnProperty(k) ) { retval.push(this[k].get(_key)); } }
    return retval;
  }

  /**
   * @param {integer} _i - index to return
   * @return {WovModel}
   */
  pos(_i) { return Object.values(this)[_i]; }

  /**
   * @return {Array<WovModel>} - all values
   */
  all() { return Object.values(this); }

  /**
   * @param {integer} _id - object with id to return
   * @return {WovModel}
   */
  id(_id) { return this[_id]; }

  /**
   * Calls readInMany on each item.
   * @param {String} _t - model to read in
   * @return {Array<WovModel>} - models read in
   */
  async readInMany(_t, _limiters = {}) {
    let retval = [];
    let proms = [];
    for (let k in this) {
      if ( this.hasOwnProperty(k) ) {
        Logger.g().info(`${this[k].constructor.name}(id ${k}).readInMany ${_t}`);
        proms.push( this[k].readInMany(_t, _limiters).then( function(_m) { retval.push(_m); })); // does this maintain the order?
      }
    }
    await Promise.all(proms);
    return retval;
  }

  /**
   */
  async readIn(_t) {
    let retval = [];
    let proms = [];
    // let modref = await this._getModelRelation(_t);
    // if ( modref instanceof WovReturn ) { throw Error(modref); }

    for (let k in this) {
      if ( this.hasOwnProperty(k) ) {
        Logger.g().info(`WovModelMany(${_t}) '${k}' :`);
        proms.push( this[k].readIn(_t).then( function(_m) { retval.push(_m); })); // does this maintain the order?
      }
    }
    await Promise.all(proms);

    // this[moderef.propname] = function() { return modref.propname; };


    return retval;
  }

  /**
   * For readIn models of _k, on each Model in htis, place into a new WovModelMany and return
   * ex. car.tires.select('wheel') -> returns WovModelMany<Wheel>, one for each tire.
   * @return {WovModelMany<WovModel>} - 
   */
  select(_k) {
    let retval = new WovModelMany();
    for (let k in this) {
      if ( this.hasOwnProperty(k) ) {
        let t = this[k][_k];
        if ( t == null ) Logger.g().throwError(`Nothing readIn for '${_k}'`);
        retval[t.get('id')] = t;
      }
    }
    return retval;
  }

  /**
   */
  flatten(_recurse = true ) {
    let retval = [];
    for (let k in this) { if ( this.hasOwnProperty(k) ) { retval.push(this[k].flatten(_recurse)); } }
    return retval;
  }


}

/**
 * so 'this' won't have utility functions and will look like a regular hash
 */
class WovModelMany extends _WovModelMany {};

module.exports = WovModelMany;
