
const WovReturn = require('./wovreturn');

module.exports = class WovModelClient {

  /**
   * @param {WoveonLogger} _l -
   * @param {WovDBPostgres} _wmdb - WovDBPostgres (does not have to be connected yet)
   * @param {Array<models>} _models - the models this loads onto this
   * @param {Array<string>} _safeTables - database tables user can directly call selects on
   * @param {Object} _modelInitOptions -
   */
  constructor(_l, _wmdb, _models, _safeTables, _modelInitOptions) {
    this.l = _l; this.wmdb = _wmdb;

    // only Postgres for now (maybe additional sql servers as well, but untested)
    if ( _wmdb.constructor.name != 'WovDBPostgres' ) {
      this.l.throwError('ERROR: wovmodelclient only works for Postgres wovdbs. TODO.', _wmdb.name, _wmdb.constructor.name);
    }

    this._safeTables = {};
    if ( _safeTables != null && Array.isArray(_safeTables) ) {
      for (let i=0; i<_safeTables.length; i++) { this._safeTables[_safeTables[parseInt(i)]] = true; } // create hash
    }

    // Add each model to this, with its name. ex. this.User is a class for the User model
    this.table2model = {};
    _models.forEach( function(m) {
      this.l.aspect('ms.wovmodelclient.constructor', `...loading WovModel : '${m.name}'. has child: ${m._haschildren}`);
      this.l.aspect('ms.wovmodelclient.constructor', `...loading WovModel : '${m.name}' on client as 'model_${m.name.toLowerCase()}' and '${m.name}'`);
      m.init(this.l, this); this[m.name] = m; this[`model_${m.name.toLowerCase()}`] = m; this.table2model[m.tablename] = m;
      this._safeTables[m.tablename] = true;          // auto-add each model's table
      this._safeTables[`wsv_${m.tablename}`] = true; // auto-add each model's view
    }.bind(this));
  }

  /**
   * A helper function to run WovModel.doInitDB on the Wovclient WovModels.
   * @param {bool} _doDrop  - if true, drop the table
   * @param {bool} _doTable - if true, create the table
   * @param {bool} _doView  - if true, create the view
   */
  async initModelDB(_doDrop, _doTable, _doView) {
    let models = Object.values(this.table2model);
    for (let k in models ) {
      if ( models.hasOwnProperty(k) ) {
        let m = models[k];
        if ( m.isInited() ) {
          let result = await models[k].doInitDB(_doDrop, _doTable, _doView);
          if ( result instanceof WovReturn ) {
            this.l.info('result: ', result);
            this.l.rethrowError(result.data, `Error creating table for model '${m.name}'.`);
          }
        }
      }
    }
  }

  /**
   * Helper function to get all GraphQL schemas in the model.
   * @return {string} - all schemas
   */
  getGraphQLSchemas() {
    let models = Object.values(this.table2model);
    let retval = '';
    for (let k in models ) {
      if ( models.hasOwnProperty(k) ) {
        let m = models[k];
        let s = m.getGraphQLSchema();
        retval += '\n'+s;
      }
    }
    return retval;
  }

  /**
   * Returns the object that returns the db queries that generate the object.
   * @return {string} - the model code
   */
  getGraphQLModelResolvers() {
    let models = Object.values(this.table2model);
    let retval = {
      modeljs   : '',
      exportsjs : 'module.exports = {',
    };
    for (let k in models ) {
      if ( models.hasOwnProperty(k) ) {
        let m = models[k];
        let s = m.getGraphQLModelResolver();
        retval.modeljs += '\n'+s;
        retval.exportsjs += `${m.name}, `;
      }
    }

    retval.exportsjs += '};\n';

    return retval;
  }

  /**
   * NOTE: when switching to pools, have to set a client, cleared on endTransaction()
   * NOTE2: never tested this so commenting out for now
   * @return {bool|Error} - true on success, Error on failure
   */
  /*
  async transactionBegin()    { return this._transaction('BEGIN'); }
  async transactionCommit()   { return this._transaction('COMMIT'); }
  async transactionRollback() { return this._transaction('ROLLBACK'); }
  async _transaction(_cmd) {
    let retval = false;
    await this.wmdb.client.query(_cmd).then(function() { retval = true; }).catch(function(e) { retval = e; });
    return retval;
  };
  */


  /**
   * Lookup model by the table in the database it is attached to.
   * @param {string} _t - table name
   * @return {WovModel}
   */
  getModelByTablename(_t) { return this.table2model[_t]; }


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
      try {
        let r = await this.wmdb.client.query(_q, _d);
        this.l.with('add_to_stacklvl', 0).aspect(`modelresult ${_aspect}`, `R(${_aspect}): `, r.rows);
        retval = r.rows;
      }
      catch (e) {
        /*
        this.l.with('add_to_stacklvl', 1).error(`FAILED Postgres Query '${_aspect}'`);
        this.l.with('add_to_stacklvl', 1).error(`Q: `, _q);
        this.l.with('add_to_stacklvl', 1).error(`D: `, _d);
        */
        if ( _wr ) e = WovReturn.retError(e, `FAILED Postgres Query '${_aspect}'`);
        rej(e);
      }
      if ( _wr ) retval = WovReturn.retSuccess(retval);
      ret(retval); // return retval;
    }.bind(this));
  }


  /**
   * A helper for update functions. Returns number of rows changed and rows.
   * @param {string} _q      - SQL query to run
   * @param {array} _d       - data array to pass to query (or null if _q is an object)
   * @param {string} _aspect - name of logging aspect to test
   * @param {boolean} _wr    - true to return value in WovReturn object
   * @return {Array<rowCount,rows>|Error|WovReturn_Error} - Returns # of rows changed, for your error checks, rows after if 'RETURNING X' used.
   */
  _runUpdateQuery(_q, _d, _aspect, _wr = false ) {
    if ( (typeof _q) != 'string' ) { _wr = _aspect; _aspect = _d; _d = null; }
    return new Promise( async function(ret, rej) {
      let retval = null;
      this.l.with('add_to_stacklvl', 1).aspect(`model ${_aspect}`, `Query '${_aspect}'`);
      this.l.with('add_to_stacklvl', 1).aspect(`modelquery ${_aspect}`, `Q(${_aspect}): `, _q);
      this.l.with('add_to_stacklvl', 1).aspect(`modeldata ${_aspect}`, `D(${_aspect}): `, _d);
      try {
        let r = await this.wmdb.client.query(_q, _d);
        this.l.with('add_to_stacklvl', 0).aspect(`modelresult ${_aspect}`, `R(${_aspect}): `, r.rows);
        retval = [r.rowCount, r.rows];
      }
      catch (e) {
        if ( _wr ) e = WovReturn.retError(e, `FAILED Postgres Update Query '${_aspect}'`);
        rej(e);
      }
      if ( _wr ) retval = WovReturn.retSuccess(retval);
      ret(retval); // return retval;
    }.bind(this));
  }

  /**
   * A helper for update functions. Returns number of rows changed and rows.
   * @param {string} _q      - SQL query to run
   * @param {array} _d       - data array to pass to query (or null if _q is an object)
   * @param {string} _aspect - name of logging aspect to test
   * @param {boolean} _wr    - true to return value in WovReturn object
   * @return {row|Error|WovReturn_Error} - Returns # of rows changed, for your error checks, rows after if 'RETURNING X' used.
   */
  /*
  _runSingularUpdate(_q, _d, _aspect, _wr = false ) {
    if ( (typeof _q) != 'string' ) { _wr = _aspect; _aspect = _d; _d = null; }
    return new Promise( async function(ret, rej) {
      let retval = null;
      this.l.with('add_to_stacklvl', 1).aspect(`model ${_aspect}`, `Query '${_aspect}'`);
      this.l.with('add_to_stacklvl', 1).aspect(`modelquery ${_aspect}`, `Q(${_aspect}): `, _q);
      this.l.with('add_to_stacklvl', 1).aspect(`modeldata ${_aspect}`, `D(${_aspect}): `, _d);
      try {
        let r = await this.wmdb.client.query(_q, _d);
        this.l.with('add_to_stacklvl', 0).aspect(`modelresult ${_aspect}`, `R(${_aspect}): `, r.rows);
        if ( r.rowCount != 1 ) {
          if ( _wr ) e = WovReturn.retError(e, `FAILED Postgres Update Query '${_aspect}'`);
          rej(e);
        }
        retval = r.rows[0];
      }
      catch (e) {
        if ( _wr ) e = WovReturn.retError(e, `FAILED Postgres Singular Update Query '${_aspect}'`);
        rej(e);
      }
      if ( _wr ) retval = WovReturn.retSuccess(retval);
      ret(retval); // return retval;
    }.bind(this));
  }
  */

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
        .then( function(r) {
          let retval = r[0] || null;
          if ( _wr ) retval = WovReturn.retSuccess(retval);
          ret(retval);
        })
        .catch( function(e) { if ( _wr ) e = WovReturn.retError(e, `FAILED Postgres Singular Query '${_aspect}'`); rej(e); } );
    }.bind(this));
  }


  /**
   * Helper function to directly select by id on a table named by the variable. As this is a potentially
   * dangerous call, it uses the safeTables hash to limit to certain tables and exact string matches.
   * @param {integer} _id - primary key identifier of type integer
   * @param {string} _t - table name
   */
  async _selectByID(_id, _t) {
    if ( _id == null ) throw Error(`selection from table '${_t}' has id of: '${_id}'.`);
    if ( this._safeTables[_t] === undefined ) { this.l.throwError(_t, `***Unknown _selectByID type '${_t}'. Possibly an attack!!!!`); }

    let q = `SELECT * FROM ${_t} WHERE id=$1::integer`;
    let d = [_id];
    return this._runSingularQuery(q, d, `selectByID${_t}`);
  }

  /**
   * Helper function to select all from a table.
   * @param {string} _t - table name
   */
  async _selectAll(_t) {
    if ( this._safeTables[_t] === undefined ) { this.l.throwError(_t, `***Unknown _selectByID type '${_t}'. Possibly an attack!!!!`); }

    let q = `SELECT * FROM ${_t}`;
    let d = [];
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
    if ( this._safeTables[_t] === undefined ) { this.l.throwError(_t, `***Unknown _selectByRef type '${_t}'. Possibly an attack!!!!`); }

    let vt = _v_t.replace(/[^A-Za-z_0-9\(\)]+/g, ''); // remove all but these characters ex. varchar(2)
    let k  = _k.replace(/[^A-Za-z_0-9\"]+/g, '');     // remove all but these characters ex. "ATable"
    let q = `SELECT * FROM ${_t} WHERE ${k}=\$1::${vt}`;
    let d = [_v];
    return this._runSingularQuery(q, d, `selectByRef${_t}`);
  }

  /** Capitalize string.
   * @param {string} _s -
   * @return {string}
   */
  static capitalize(_s)   { return _s.charAt(0).toUpperCase() + _s.slice(1); };

  /** Uncapitalize string.
   * @param {string} _s -
   * @return {string}
   */
  static uncapitalize(_s) { return _s.charAt(0).toLowerCase() + _s.slice(1); };


  /** Tests if an email is valid.
   * NOTE: since _email is often from the commandline, and could be malicious, timeout
   * @param {string} _email -
   * @return {string} - 'valid', 'invalid' and 'timeout' if took too long
   */
  static async validateEmail(_email) {
    const re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/; //eslint-disable-line 

    return new Promise( function(ret, rej) {
      let retval = 'timeout';
      setTimeout( function() { rej(retval); }, 500); // milliseconds
      if ( re.test(_email) ) retval = 'valid';
      else retval = 'invalid';
      ret(retval);
    });

  }
};
