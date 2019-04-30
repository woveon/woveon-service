
const WovReturn = require('./WovReturn');

module.exports = class WovModelClient {

  /**
   * @param {WoveonLogger} _l -
   * @param {PGClient} _dbclient - postgres client (does not have to be connected yet)
   * @param {array} _safeTables - database tables user can directly call selects on
   */
  constructor(_l, _dbclient, _safeTables) {
    this.l = _l; this.db = _dbclient;
    this.safeTables = {}; for (let i=0; i<_safeTables.length; i++) { this.safeTables[_safeTables[i]] = true; } // create hashtable
  }


  /**
   * Runs a query, handles errors, standardizes Logging aspects. Returns a promise (as opposed to being async) so these can be chained.
   * @param {string} _q      - SQL query to run
   * @param {array} _d       - data array to pass to query (or null if _q is an object)
   * @param {string} _aspect - name of logging aspect to test
   * @param {boolean} _wr    - true to return value in WovReturn object
   * @return {array} - Promise that returns results. or, throws error
   */
  _runQuery(_q, _d, _aspect, _wr = false) {
    if ( (typeof _q) != 'string' ) { _wr = _aspect; _aspect = _d; _d = null; }
    return new Promise( async function(ret, rej) {
      let retval = null;
      this.l.with('add_to_stacklvl', 1).aspect(`model ${_aspect}`, `Query '${_aspect}'`);
      this.l.with('add_to_stacklvl', 1).aspect(`modelquery ${_aspect}`, `Q(${_aspect}): `, _q);
      this.l.with('add_to_stacklvl', 1).aspect(`modeldata ${_aspect}`, `D(${_aspect}): `, _d);
      try { let r= await this.db.query(_q, _d); this.l.aspect(`modelresult ${_aspect}`, `R(${_aspect}): `, r.rows); retval = r.rows; }
      catch (e) {
        this.l.with('add_to_stacklvl', 1).error(`FAILED Postgres Query '${_aspect}'`);
        this.l.with('add_to_stacklvl', 1).error(`Q: `, _q);
        this.l.with('add_to_stacklvl', 1).error(`D: `, _d);
        if ( _wr ) e = WovReturn.retError(e, `FAILED Postgres Query '${_aspect}'`);
        rej(e);
      }
      if ( _wr ) retval = WovReturn.retSuccess(retval);
      ret(retval); // return retval;
    }.bind(this));
  }


  /**
   * Wraps _runQuery with a promise that returns a single item.
   * @param {string} _q      - SQL query to run
   * @param {array} _d       - data array to pass to query
   * @param {string} _aspect - name of logging aspect to test
   * @param {boolean} _wr    - true to return value in WovReturn object
   * @return {object} - Promise that returns a single result. or, throws error
   */
  _runSingularQuery(_q, _d, _aspect, _wr = false) {
    return new Promise( async function(ret, rej) {
      this._runQuery(_q, _d, _aspect, false)
        .then( function(r) { let retval = r[0]; if ( _wr ) retval = WovReturn.retSuccess(retval); ret(retval); })
        .catch( function(e) { if ( _wr ) e = WovReturn.retError(e, `FAILED Postgres Query '${_aspect}'`); rej(e); } );
    }.bind(this));
  }


  /**
   * Helper function to directly select by id on a table named by the variable. As this is a potentially
   * dangerous call, it uses the safeTables hash to limit to certain tables and exact string matches.
   * @param {integer} _id - primary key identifier of type integer
   * @param {string} _t - table name
   */
  async _selectByID(_id, _t) {
    if ( _id == null ) throw Error(`selection of '${_t}' has ${_id} id.`);
    if ( this.safeTables[_t] === undefined ) { this.l.throwError(_t, `***Unknown _selectByID type '${_t}'. Possibly an attack!!!!`); }

    let q = `SELECT * FROM ${_t} WHERE id=$1::integer`;
    let d = [_id];
    return this._runSingularQuery(q, d, `selectByID${_t}`);
  }

  /**
   * Helper function to select all from a table.
   * @param {string} _t - table name
   */
  async _selectAll(_t) {
    if ( _id == null ) throw Error(`selection of '${_t}' has ${_id} id.`);
    if ( this.safeTables[_t] === undefined ) { this.l.throwError(_t, `***Unknown _selectByID type '${_t}'. Possibly an attack!!!!`); }

    let q = `SELECT * FROM ${_t}`;
    let d = [_id];
    return this._runQuery(q, d, `selectAll${_t}`);
  }


  /** Like selectByID, but select by non-id and non-integer.
   * @param {string}   _k   - key to search for
   * @param {variable} _v   - value of key
   * @param {string}   _v_t - value type
   * @param {string}   _t   - table
   */
  async _selectByRef(_k, _v, _v_t, _t) {
    if ( _k == null   || _k == '' )   this.l.throwError(`selectionByRef of '${_t}' has ${_k} k.`);
    if ( _v == null   || _v == '' )   this.l.throwError(`selectionByRef of '${_t}' has ${_v} v.`);
    if ( _v_t == null || _v_t == '' ) this.l.throwError(`selectionByRef of '${_t}' has ${_v_t} v_t.`);
    if ( this.safeTables[_t] === undefined ) { this.l.throwError(_t, `***Unknown _selectByRef type '${_t}'. Possibly an attack!!!!`); }

    let vt = _v_t.replace(/[^A-Za-z_0-9\(\)]+/g, ''); // remove all but these characters ex. varchar(2)
    let k  = _k.replace(/[^A-Za-z_0-9\"]+/g, '');     // remove all but these characters ex. "ATable"
    let q = `SELECT * FROM ${_t} WHERE ${k}=\$1::${vt}`;
    let d = [_v];
    return this._runSingularQuery(q, d, `selectByRef${_t}`);
  }

};
