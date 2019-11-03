
/**
 * @typedef Promise
 * @typedef WovStateLayer
 * @typedef WovDBPostgres
 * @typedef WovModel
 * @typedef integer
 */

const Logger    = require('woveon-logger');
const WovReturn = require('./wovreturn');
const entity    = require('./entity');
// const {ApolloServer}    = require('apollo-server-express');
// const requireFromString = require('require-from-string');


// const WovModel  = require('./wovmodel');

module.exports = class WovClientLocal extends entity.WovClientEntity {


  /**
   * Constructor.
   *
   * @param {Logger} _l -
   * @param {Array<WovModel>} _models - the models this loads onto this
   * @param {WovDBPostgres} _wmdb - WovDBPostgres (does not have to be connected yet)
   * @param {Array<string>} _safeTables - database tables user can directly call selects on
   * @param {object} _modelInitOptions -
   */
  constructor(_l, _models, _wmdb, _safeTables, _modelInitOptions) {
    super(_l, _models);
    this.wmdb = _wmdb;
    this.gqlrs = null; // GraphQL Remote Server for the client

    // only Postgres for now (maybe additional sql servers as well, but untested)
    if ( _wmdb.constructor.name != 'WovDBPostgres' ) {
      this.l.throwError('ERROR: WovClientLocal only works for Postgres wovdbs. TODO.', _wmdb.name, _wmdb.constructor.name);
    }

    this._safeTables = {};
    if ( _safeTables != null && Array.isArray(_safeTables) ) {
      for (let i=0; i<_safeTables.length; i++) { this._safeTables[_safeTables[parseInt(i)]] = true; } // create hash
    }

    // Add each model to this, with its name. ex. this.User is a class for the User model
    this.table2model = {};
    _models.forEach( function(m) {
      this.table2model[m.tablename] = m;
      this._safeTables[m.tablename] = true;          // auto-add each model's table
      this._safeTables[`wsv_${m.tablename}`] = true; // auto-add each model's view
    }.bind(this));
  }


  /**
   * Initialize stuff.
   *
   * @param {boolean} _doDrop - if true, drop tables if exist
   * @param {boolean} _doTable - if true, create tables
   * @param {boolean} _doView - if true, create views
   * @return {Promise<undefined>} -
   */
  /*
  async initModelDB(_doDrop, _doTable, _doView) {
    this.l.logDeprecated('Call init, not initModelDB');
    return this.init(null, _doDrop, _doTable, _doView);
  }
  */


  /**
   * A helper function to run doInitDB for the Wovclient's WovModels.
   *
   * @param {WovStateLayer} _sl - the state layer of the microservice being passed in
   * @param {boolean} _doDrop  - if true, drop the table
   * @param {boolean} _doTable - if true, create the table
   * @param {boolean} _doView  - if true, create the view
   * @return {Promise<undefined>} -
   */
  async init(_sl, _doDrop, _doTable, _doView) {
    entity.WovClientEntity.prototype.init.call(this, _sl);
    let models = Object.values(this.table2model);
    for (let i=0; i<models.length; i++) {
      // this.l.info(`model k  ${i} ,  len:${models.length}`);
      // if ( models.hasOwnProperty(k) ) {
        let m = models[i];
        // this.l.info(`model ${m.name}: isInited? ${m.isInited()}.`);
        if ( m.isInited() ) {
          // this.l.info('WovClientLocal initDB for model : ', m.name);
          // let result = await models[k].doInitDB(_doDrop, _doTable, _doView);
          let result = await this.doInitDB(_doDrop, _doTable, _doView, models[i]);
          if ( result instanceof WovReturn ) {
            // this.l.info('result: ', result);
            this.l.rethrowError(result.data, `Error creating table for model '${m.name}'.`);
          }

          // place on statelayer if it exists
          // this.statelayer[`model_${m.name}`] = m;
          // if ( this.statelayer != null ) this.statelayer[`${m.name}`] = m;
        }
      // }
    }
    // this.l.info(`done ClientLocal init`);
  }


  /**
   * Helper function to get all GraphQL schemas in the model.
   *
   * @return {string} - all schemas
   */
  getGraphQLSchemas() {
    let models = Object.values(this.table2model);
    let retval = entity.getBlankServerConfig_Schemas();
    for (let k in models ) {
      if ( models.hasOwnProperty(k) ) {
        let m = models[k];
        let s = m.getGraphQLSchema();
        retval.queries   += s.queries;
        retval.mutations += s.mutations;
        retval.query_t   += s.query_t;
        retval.schemas   += s.schemas;
      }
    }
    return retval;
  }


  /**
   * Returns the object that returns the db queries that generate the object.
   *
   * @return {object} - {modeljs:,exportsjs:}
   */
  getGraphQLResolvers() {
    let models = Object.values(this.table2model);
    let retval = entity.getBlankServerConfig_Resolvers();
    for (let k in models ) {
      if ( models.hasOwnProperty(k) ) {
        let m = models[k];
        let s = m.getGraphQLResolver();
        retval.queryjs    += s.queryjs;
        retval.mutationjs += s.mutationjs;
        retval.modeljs    += s.modeljs;
        retval.exportsjs  += s.exportsjs;
      }
    }

    // retval.exportsjs += '};\n';

    return retval;
  }

  /**
   * NOTE: when switching to pools, have to set a client, cleared on endTransaction()
   * NOTE2: never tested this so commenting out for now
   * @ return {bool|Error} - true on success, Error on failure
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
   *
   * @param {string} _t - table name
   * @return {WovModel} -
   */
  getModelByTablename(_t) { return this.table2model[_t]; }


  /**
   * Runs a query, handles errors, standardizes Logging aspects. Returns a promise
   * (as opposed to being async) so these can be chained.
   *
   * @param {string} _q      - SQL query to run
   * @param {Array} _d       - data array to pass to query (or null if _q is an object)
   * @param {string} _aspect - name of logging aspect to test
   * @param {boolean} _wr    - true to return value in WovReturn object
   * @return {Array} - Promise that returns results. or, throws error
   *                 - for updates, r.rows is [], and is not an error.
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
      // this.l.info('_runQueyr ret: ', retval);
      ret(retval); // return retval;
    }.bind(this));
  }


  /**
   * A helper for update functions. Returns number of rows changed and rows.
   *
   * @param {string} _q      - SQL query to run
   * @param {Array} _d       - data array to pass to query (or null if _q is an object)
   * @param {string} _aspect - name of logging aspect to test
   * @param {boolean} _wr    - true to return value in WovReturn object
   * @return {Array<integer>|Error|WovReturn<Error>} - Array of rows changed, for your error checks,
   * then rows after if 'RETURNING X' used.
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
   *
   * @param {string} _q      - SQL query to run
   * @param {Array} _d       - data array to pass to query (or null if _q is an object)
   * @param {string} _aspect - name of logging aspect to test
   * @param {boolean} _wr    - true to return value in WovReturn object
   * @return {integer|Error|WovReturn<Error>} - Returns # of rows changed, for your error checks, rows after if 'RETURNING X' used.
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
   *
   * @param {string} _q      - SQL query to run
   * @param {Array} _d       - data array to pass to query
   * @param {string} _aspect - name of logging aspect to test
   * @param {boolean} _wr    - true to return value in WovReturn object
   * @return {object} - Promise that returns a single result. or, throws error
   */
  _runSingularQuery(_q, _d, _aspect, _wr = false) {
    return new Promise( async function(ret, rej) {
      this._runQuery(_q, _d, _aspect, false)
        .then( function(r) {
          let retval = r[0] || null;
          if ( _wr ) retval = WovReturn.retSuccess(retval); // TODO: This should not be needed since _runQueyr has this already?
          ret(retval);
        })
        .catch( function(e) { if ( _wr ) e = WovReturn.retError(e, `FAILED Postgres Singular Query '${_aspect}'`); rej(e); } );
    }.bind(this));
  }


  /**
   * Helper function to directly select by id on a table named by the variable. As this is a potentially
   * dangerous call, it uses the safeTables hash to limit to certain tables and exact string matches.
   *
   * @param {integer} _id - primary key identifier of type integer
   * @param {string} _t - table name
   * @return {object} - data that was fetched
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
   *
   * @param {string} _t - table name
   * @return {object} - data that was fetched
   */
  async _selectAll(_t) {
    if ( this._safeTables[_t] === undefined ) { this.l.throwError(_t, `***Unknown _selectByID type '${_t}'. Possibly an attack!!!!`); }

    let q = `SELECT * FROM ${_t}`;
    let d = [];
    return this._runQuery(q, d, `selectAll${_t}`);
  }


  /**
   * Like selectByID, but select by non-id and non-integer.
   *
   * @param {string}    _k   - key to search for
   * @param {undefined} _v   - value of key
   * @param {string}    _v_t - value type
   * @param {string}    _t   - table
   * @return {object} - data that was fetched
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


  // =====================================================================
  // ---------------------------------------------------------------------
  // Virtual Functions from WovEntityClient
  // ---------------------------------------------------------------------


  /**
   * Creates it in the database, then creates and returns the model.
   *
   * @param {object} _data           -
   * @param {WovModel.class} _Model - the class to create an object from
   * @return {WovModel|WovReturn<Error>} - returns the newly created object.
   */
  async createOne(_data, _Model) {
    let retval = null;
    let Mod = _Model;

    // veryify data in
    if ( ! (_data instanceof Object) ) {
      retval = WovReturn.retError(_data, `${Mod.name}::createOne(...) requires _data to be an Object.`);
    }

    // Polymorphic models are possible when _data has _model_t.
    if ( _data._model_t !== undefined ) {
      // TODO create a test case for this
      if ( _data._model_t != Mod.name ) { // polymorphic
        Mod = this[_data._model_t]; // get the model
        if ( Mod == null ) { this.l.throwError(`createOne for '${_data._model_t}' failed to find model on client.`); }
      }
    }

    if ( retval == null ) {
      // this.l.info('createOne with model ', Mod.name);
      let qp = this._buildQueryParams(_data, _data, 'insert', Mod);
      let q = `INSERT INTO ${Mod.tablename} (${qp.colnames.join(', ')})
               VALUES (${qp.cols.join(', ')})
               RETURNING *`;

      let result = await this._runSingularQuery(q, qp.data, `createOne${Mod.name}`).catch(function(e) { return e; });
      if ( result == null ) retval = WovReturn.retError(_data, `Failed to create ${Mod.name}'.`);
      else if ( result instanceof Error ) { retval = WovReturn.retError(result, `Failed to create '${Mod.name}'.`); }
      else retval = new Mod(result);
    }

    // this.l.info('ClientLocal: createOne retval : ', retval);
    this.l.aspect('ws.createOne', `createOne( ${_data} ) of ${Mod.tablename} : `, retval);

    return retval;
  }


  /**
   * Writes back to the DB. Unlike save, this does not require a model.
   *
   * @param {integer} _id -
   * @param {object} _data - data to update on the model
   * @param {WovModel.class} _Model - the class to create an object from
   * @return {object} - data
   */
  async updateOne(_id, _data, _Model) {
    // this.l.throwError(`Need to implement 'updateOne' for ${_Model.name}.`);
    let qp = this._buildQueryParams(_data, _data, 'update', _Model);
    // Logger.g().info('updateOne: ', qp);
    let q = `UPDATE ${_Model.tablename}
               SET ${qp.cols.join(', ')}
               WHERE id = ${_id}
               RETURNING *`;
    return await this._runSingularQuery(q, qp.data, `updateOne${_Model.name}`)
      .then(function(r, r2) {
        if ( r == null ) return new Error(`WovClientLocal::updateOne(${_id}, ${JSON.stringify(_data)}, ${_Model.name}) : model of id not found`);
        // Logger.g().info('updateOne returning: ', r, r2);
        return r;
      })
      .catch(function(e) { return e; });
  }


  /**
   * Deletes a row form the table that is the data of the model object.
   *
   * @param {integer} _id -
   * @param {WovModel.class} _Model - the model class
   * @return {Promise} - ?returns I think the number of rows deleted?
   */
  async deleteByID(_id, _Model) {
    let q = `DELETE FROM ${_Model.tablename} WHERE id=$1::integer RETURNING id`;
    let d = [_id];
    return this._runSingularQuery(q, d, `deleteByID${_Model.name}`);
  }


  /**
   * Reads in the data by the id. For polymorphic models, requires a 2nd read since the first read returns _model_t.
   *
   * @param {integer} _id -
   * @param {WovModel} _Model - the Model class
   * @return {WovModel|null} -
   */
  async getByID(_id, _Model) {
    // this.l.aspect('ws.getByID', `getByID(${_id} : this: `, this, this.tablename);
    let retval = await this._selectByID(_id, `wsv_${_Model.tablename}`);
    if ( retval != null && !(retval instanceof Error) ) {
      retval = await this._polyReadCheck(retval, _Model);
    }
    this.l.aspect('ws.getByID', `getByID( ${_id} ) of ${_Model.tablename} : `, retval);
    // this.l.aspect('ws.getByID', 'retval is ', retval);
    return retval;
  }


  /**
   * Gets model instances by id array.
   *
   * @param {Array<integer>} _ids - ids of models to load.
   * @param {WovModel.class} _Model - the model class
   * @return {Promise<WovModel|null>} - just like getByID
   */
  async getByIDs(_ids, _Model) {
    let p = [];
    let qqs = [];
    let xoff= 1; // offset from 0 due to parameters (starts at 1 anywany, then tablename param is 2)

    // do all DB queries at once (instead of caling getByID repeatedly)
    for (let i = 0; i< _ids.length; i++) { qqs.push(`id=$${i+xoff}::integer`); }
    let q = `SELECT * FROM "wsv_${_Model.tablename}" WHERE ${qqs.join(' OR ')}`;
    let result = await this._runQuery(q, _ids, 'ws.src.WovModel_getByIDs');
    // this.l.info('result of fetching all models: ', result);

    for (let i = 0; i< _ids.length; i++) {
      let rid = _ids[i];
      let r = result.find((e) => { return e.id == rid; });

      // add Error or promise to array (Errors will just return, Promises we will wait for)
      if ( r != null && !(r instanceof Error) ) { p[i] = await this._polyReadCheck(r, _Model); }
      else p[i] = null; // Error(`_Model not found, of id(${rid}).`);
    }

    return Promise.all(p);
  }

  /**
   * Get a model instance by the XID (external id) value.
   * XIDs are good ways to hide internal identifiers from misuse (but keep in mind, ids are faster!).
   *
   * @param {string} _xid -
   * @param {WovModel.class} _Model - the model class
   * @return {WovModel} -
   */
  async getByXID(_xid, _Model) {
    let retval = null;

    if ( _Model._schema.xid == null ) { retval = WovReturn.retError(this.name, `Called 'getByXID' on model without 'xid'.`); }

    if ( retval == null ) {
      // console.log('getByXID : ', this.name, this.tablename, _xid);
      let q = `SELECT * FROM wsv_${_Model.tablename} WHERE xid=$1::uuid`;
      let d = [_xid];
      let result = await this._runSingularQuery(q, d, `${_Model.name}.getByXID`);
      // console.log('result is ', result);
      if ( result != null && !(result instanceof Error) ) { retval = new _Model(result); }
    }

    return retval;
  }


  /**
   * Gets all of this model using the _ref, which is to the 'me' model.
   *
   * Ex. A.getToMe(x, '_a_ref', B) would find every B pointing to A.
   *
   * @param {integer} _id -
   * @param {string} _ref - the ref to 'me'
   * @param {WovModel.class} _Model - the model class that references 'me'
   * @param {object} _limiters - restricts which models to return
   * @return {object} -
   */
  async getToMe(_id, _ref, _Model, _limiters = null) {
    // this.l.info('getToMe hit: ', _Model.name);

    let q = `SELECT * FROM wsv_${_Model.tablename} WHERE ${_ref}=$1::integer`;
    let d = [_id];

    // this.l.info('  - getToMe q:', q, d);
    // transform limiters
    let ql = WovClientLocal._genLimiterQueries(_limiters, _Model, d.length);
    if ( ql.q != '' ) {
      q += ` AND ${ql.q}`;
      d = d.concat(ql.d);
    }
    // this.l.info('  - getToMe q now :', q, d);

    let to_mes= await this._runQuery(q, d, `ws.src.${_Model.name}_getToMe`)
      .catch( function(e) {
        return WovReturn.retError(e, `getToMe Failed reading table '${_Model.tablename}', column '${_ref}'.`);
      });

    // this.l.info('WovClientLocal::getToMe ', _id, _ref, to_mes);

    // convert all to models
    let p = [];
    for (let i = 0; i< to_mes.length; i++) { p[i] = await this._polyReadCheck(to_mes[i], _Model); }

    return Promise.all(p);
  }

  // ---------------------------------------------------------------------
  // end Virtual Functions from WovEntityClient
  // ---------------------------------------------------------------------
  // =====================================================================


  /**
   * Build a query to save dirty values.
   * TODO
   *
   * @return {boolean|Error} - true if was saved, false if not saved (no dirty data), Error if error.
   */
  async saveOne(_model) {
    let retval = false;
    let qtype = null;
    let savedata = null;

    {
      qtype    = 'update';
      savedata = Object.assign({}, _model._dirty, {id : _model.get('id')});
    }

    this.l.aspect(`${_model.constructor.name}::save`, 'ws.WovModel.save()', _model.savedata);
    let qp = this._buildQueryParams(savedata, _model.get(), qtype, _model.constructor);
    if ( qp.found == true ) {

      let q = `UPDATE ${_model.constructor.tablename}
                 SET ${qp.cols.join(', ')}
                 WHERE id=$1::integer`;
      // this.l.info('q: ', q);

      retval = this._runSingularQuery(q, qp.data, `ws.WovModel.save ${_model.constructor.name}::save`).then(function() { return true; }).catch(function(e) { return e; });

      // reset dirty
      _model._dirty = {};
    }
    return retval;
  }


  /**
   * Called to initialize the db table for the Model in the WovDB.
   *
   * WoveonService manipulates tables since it handles inheritance between models inside of a database that might not have that.
   *
   * The params set how it should handle existing data. Be VERY careful. doDrop should be false unless you are in testing.
   *
   * @param {boolean} _doDrop  - deletes the table model's table if exists (WARNING!!!!! CAREFULE!!!)
   * @param {boolean} _doTable - create the table if not exists
   * @param {boolean} _doView  - create the view if not exists (enables polyread)
   * @param {WovModel.class} _Model - the model class that we are using.
   * @return {undefined} -
   */
  async doInitDB(_doDrop, _doTable, _doView, _Model) {
    if ( _Model._schema == undefined ) { this.l.throwError(`For model '${_Model.name}', No schema.`); }

    let q1 = `DROP TABLE IF EXISTS ${_Model.tablename} CASCADE;`;
    let q2 = null; // create table
    let q3a = `DROP VIEW IF EXISTS "wsv_${_Model.tablename}"`;
    let q3 = null; // create view
    let qp = null; // query parameters
    let schematouse = null;
    let parent = Object.getPrototypeOf(_Model);
    let d = []; // data

    // handle inheritance tables
    this.l.aspect('ms.WovModel_doCreateTableQuery', `Model ${_Model.name} has parent of ${parent.name}, haschildren ${_Model._haschildren}.`);
    if ( parent.name == 'WovModel' ) { schematouse = _Model._schema; }
    else { schematouse = _Model._ownschema; }

    qp = this._buildQueryParams(schematouse, {}, 'create', _Model);
    // Logger.g().info(`doCreateTableQuery: ${_Model.name} `, qp);

    let cols = [];
    for (let i=0; i< qp.colnames.length; i++) {
      let colname = qp.colnames[parseInt(i)];
      if ( colname != 'id' ) {
        let coltype = qp.coltypes[parseInt(i)];
        cols.push(`${colname} ${coltype}`);
      }
    }

    // TODO _model_t as a lookup table
    //


    // Create tables so that _model_t is only in tables with inheritance. Create the views to fill in model_t.
    if ( parent.name == 'WovModel' ) {
      if ( _Model._haschildren == false ) {
        q2 = `CREATE TABLE IF NOT EXISTS "${_Model.tablename}" ( id SERIAL PRIMARY KEY, ${cols.join(', ')} )`;
        q3 = `CREATE VIEW "wsv_${_Model.tablename}" AS SELECT *, text '${_Model.name}' as _model_t FROM "${_Model.tablename}"`;
      }
      else {
        q2 = `CREATE TABLE IF NOT EXISTS "${_Model.tablename}" ( id SERIAL PRIMARY KEY, _model_t varchar default '${_Model.name}', ${cols.join(', ')} )`;
        q3 = `CREATE VIEW "wsv_${_Model.tablename}" AS SELECT * FROM "${_Model.tablename}"`;
      }
    }
    else  {
      q2 = `CREATE TABLE IF NOT EXISTS ${_Model.tablename} ( _model_t varchar default '${_Model.name}', ${cols.join(', ')} ) INHERITS ( "${parent.tablename}" )`;
      q3 = `CREATE VIEW "wsv_${_Model.tablename}" AS SELECT * FROM "${_Model.tablename}"`;
    }

    this.l.aspect('ms.WovModel_doCreateTableQuery', `q1(${_doDrop}): `,  q1);
    this.l.aspect('ms.WovModel_doCreateTableQuery', `q2(${_doTable}): `, q2);
    this.l.aspect('ms.WovModel_doCreateTableQuery', `q3(${_doView}): `,  q3);

    return (async function() { if ( _doDrop  ) await this._runQuery(q1,  d, 'ms.WovModel__doCreateTableQuery'); }.bind(this))()
      .then(async function() { if ( _doTable ) await this._runQuery(q2,  d, 'ms.WovModel__doCreateTableQuery'); }.bind(this))
      .then(async function() { if ( _doView  ) await this._runQuery(q3a, d, 'ms.WovModel__doCreateTableQuery'); }.bind(this))
      .then(async function() { if ( _doView  ) await this._runQuery(q3,  d, 'ms.WovModel__doCreateTableQuery'); }.bind(this))
      .catch(function(e) {
        this.l.error('error:', e);
        return WovReturn.retError(e, `Failed to create table for '${_Model.tablename}'.`);
      }.bind(this));
  }


  /**
   * From an object with properties, build the col names and data for a query. If id is in _data, it is placed 1st.
   *
   * @param {object} _data - object to pull keys from (ex. this._data or this._dirty can be passed in)
   * @param {object} _vals - object to pull vals from, with key (ex. this._data passed in, or this.get())
   * @param {object} _qtype - query type 'create', 'insert' or 'update'
   * @param {WovModel} _Model - the Model class to use
   * @return {object} - cols : columns in database, data : values for the cols, found : if found some tables (useful for 'dirty')
   */
  _buildQueryParams(_data, _vals, _qtype, _Model) {
    let counter = 1;
    let retval = {colnames : [], cols : [], data : [], found : false, coltypes : [] };

    if ( _Model._schema == undefined ) { this.l.throwError(`For model '${_Model.name}', No schema.`); }

    // update keeps id, if it exists, out of the colnames and cols
    if ( _qtype == 'update' && _data.id != null ) { retval.data.push(_data.id); counter++; }

    let data = _data;
    let vals = _vals;

    // if child, add in _model_t
    // let parent = Object.getPrototypeOf(_Model);
    // if ( parent.name != 'WovModel' ) {
    // Object.assign(data, {_model_t : _Model.name});
    // Object.assign(vals, {_model_t : _Model.name});
    // }

    Object.keys(data).forEach(function(_key) {
      if ( data.hasOwnProperty(_key) ) {
        if ( _key == 'id' && _qtype == 'update' ) {}      // ignore id for updates
        else if ( _key == 'id' && _qtype == 'insert' ) {  // insert uses id
          retval.found = true;
          retval.cols.push(`$${counter++}::integer`);
          retval.colnames.push(`"${_key}"`);
          retval.data.push(vals[_key]);
        }
        else if ( _key == 'id' && _qtype == 'create' ) {
          retval.found = true;
          retval.cols.push(`$${counter++}::integer`);
          retval.colnames.push(`"${_key}"`);
          retval.data.push(vals[_key]);
          retval.coltypes.push(_Model._schema[_key]);
        }
        else {
          retval.found = true;
          let sc = _Model._schema[_key];
          if ( sc === undefined ) this.l.throwError(`For model '${_Model.name}', No schema for key '${_key}'.`);
          if ( _qtype == 'update' )      { retval.cols.push(`${_key}=$${counter++}::${_Model._schema[_key]}`); }
          else if ( _qtype == 'insert' ) { retval.cols.push(`$${counter++}::${_Model._schema[_key]}`); }
          else if ( _qtype == 'create' ) { retval.cols.push(`$${counter++}::${_Model._schema[_key]}`); retval.coltypes.push(_Model._schema[_key]); }
          retval.colnames.push(`"${_key}"`);

          if ( entity.WovModelEntity.isRef(_key) ) {
            // ASSUMPTION: if _key is a ref, then look for _X_ref or if nothing in _vals for that ref, look for X_id
            let v = vals[_key];
            if ( v === undefined ) { v = vals[entity.WovModelEntity.refToID(_key)]; }
            retval.data.push(v); // als[_key]);
          }
          else { retval.data.push(vals[_key]); }
        }
      }
    }.bind(this));


    return retval;
  }


  /**
   * Internal function that is passed the data from a read of a model's table.
   * If the _model_t does not match the model, reread correct table.
   *
   * @param {object} _data - data read in from some other read. (getByID, getByXID, readIn, readInMany, etc)
   * @param {WovModel} _Model - this model that the _data matches to; could be this, or another model
   * if reading in from another; creates an instance of this normally, if the _model_t matches.
   * Otherwise, gets the model of _model_t and creates.
   * @return {WovModel} - the object.
   */
  async _polyReadCheck(_data, _Model) {
    let retval = null;
    let Mod = _Model;
    // let Mod = _ModelOther || _Model;  NOTE: there used to be a _model passed in but never used in testing cases so removed it

    this.l.aspect('polyReadCheck', '_polyReadCheck: ', _data, Mod.name);
    if ( _data._model_t === undefined ) { throw Error('How did this happen. You have failed me.', _data, Mod); }
    else if ( _data._model_t == Mod.name ) { retval = new Mod(_data); }
    else { // polymorphic
      Mod = this[_data._model_t]; // get the model
      if ( Mod == null ) { this.l.throwError(`polyReadCheck for '${Mod.name}' returned _model_t of '${_data._model_t}' which does not exist on client.`); }
      retval = await Mod.getByID(_data.id);
    }
    return retval;
  }


  /**
   * A builder of an SQL query's WHERE part.
   * {x:y}, {or : [{x1: y1}, {x2: y2}]}, etc.
   *
   * @param {object} _l - limiter query object
   * @param {WovModel} _omod - model this is querying; needed for it's schema
   * @param {integer} _doff - data array offset for naming variables in assignment statement
   * @param {string} _op - operation to use
   * @param {integer} _depth - tracks how deep this recurses
   * @return {object<{q,v}>} - additions to a SELECT query
   */
  static _genLimiterQueries(_l, _omod, _doff, _op = 'AND', _depth = 1) {
    let retval = {q : '', d : [] };
    let q = [];

    // Logger.g().info('_genLimiterQueries :', _l, typeof _l, Array.isArray(_l), _omod.name, _op, _depth);
    // this.constructor.l.info(`${''.padEnd(_depth*2, ' ')}_genLimiterQueries`, _l, _omod.name, _op);

    if ( _l == null ) {
    }
    else if ( Array.isArray(_l) ) {
      // this.constructor.l.info(`...array`);
      _l.forEach(function(v) {
        let r = this._genLimiterQueries(v, _omod, _doff+retval.d.length, _op, _depth+1);
        // this.constructor.l.info(`    ...aret ${JSON.stringify(r, null, 2)}`);
        q.push(r.q);
        retval.d = retval.d.concat(r.d);
        // this.constructor.l.info(`    ...aret d after : `,  retval.d);
      }.bind(this));
    }
    else if ( (typeof _l) == 'object' ) {
      // this.constructor.l.info(`...object:`, _l);
      Object.keys(_l).forEach(function(k) {
        // this.constructor.l.info(`  ...object ${k}`);
        if ( k.toLowerCase() == 'or' ) {
          let r = this._genLimiterQueries(_l[k], _omod, _doff + retval.d.length, 'OR', _depth+1);
          // this.constructor.l.info(`    ...ret ${JSON.stringify(r, null, 2)}`);
          q.push(r.q);
          retval.d = retval.d.concat(r.d);
          // this.constructor.l.info(`    ...obj d after : `,  retval.d);
        }
        else if ( k.toLowerCase() == 'and' ) {
          let r = this._genLimiterQueries(_l[k], _omod, _doff + retval.d.length, 'AND', _depth+1);
          // this.constructor.l.info(`    ...ret ${JSON.stringify(r, null, 2)}`);
          q.push(r.q);
          retval.d = retval.d.concat(r.d);
          // this.constructor.l.info(`    ...obj d after : `,  retval.d);
        }
        else {
          // this.constructor.l.info(`  ... omod scehmas : `, _omod._schema);
          q.push(`${k} = $${ _doff +1}::${_omod._schema[k]}`); // TODO type
          retval.d.push(_l[k]);
        }
      }.bind(this));
    }
    else { throw Error(`unknown '${_l}'`); }

    if ( q.length != 0 ) { retval.q = ` (${q.join(` ${_op} `)})`; }
    // this.constructor.l.info(`${''.padEnd(_depth*2, ' ')}_genLimiterQueries returning : `, retval);
    return retval;
  }


  // getRemotesServerConfigStrings()
  /**
   * Called to generate configuration for a GraphQL Server from the models on this local client, plus passed in code.
   *
   * @return {object} - schema and resolver strings
   */
  /*
  getGraphQLServerConfigStrings(_schemaadditions, _resolveradditions) {
    let retval = {schemas : null, resolvers : null};
    let customschema = Object.assign(entity.getBlankServerConfig_Schema(), _schemaadditions);


    // Model Remote Schema
    // ---------------------------------------------------------------------
    let genschemadata = this.getGraphQLSchemas();
    let gqlschemas = `

# ---------------------------------------------------------------------
# Query Definitions
# ---------------------------------------------------------------------
type Query {
${genschemadata.queries}
${customschema.queries}
}

  
# ---------------------------------------------------------------------
# Mutation Definitions
# ---------------------------------------------------------------------
type Mutation {
${genschemadata.mutations}
${customschema.mutations}
}


# ---------------------------------------------------------------------
# Query Input Types
# ---------------------------------------------------------------------
# input IDs { ids : [ID!] }
${genschemadata.query_t}
${customschema.query_t}

  
# ---------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------
${genschemadata.schemas}
${customschema.schemas}

`;

    keep working below

    // Model Remote Resolvers
    // ---------------------------------------------------------------------
    let gqlresolversdata = this.getGraphQLResolvers();
    let gqlresolvers = `

// --------------------------------------------------------------------- 
// Query Implementations
// --------------------------------------------------------------------- 
const Query = {
${gqlresolversdata.queryjs}
};

// --------------------------------------------------------------------- 
// Mutation Implementations
// --------------------------------------------------------------------- 
const Mutation = {
${gqlresolversdata.mutationjs}
};

// --------------------------------------------------------------------- 
// Model Implementations
// --------------------------------------------------------------------- 
${gqlresolversdata.modeljs}

module.exports = {Query, Mutation, ${gqlresolversdata.exportsjs}}
`;

    Logger.g().info('Model Remote Schema');
    Logger.g().h3().info(gqlschemas);

    Logger.g().info('Model Remote Resolvers');
    Logger.g().h3().info(gqlresolvers);

    retval.schemas   = gqlschemas;
    retval.resolvers = gqlresolvers;

    return retval;
  }
  */


  // end GraphQL Server for Remote MS
  // =====================================================================

};
