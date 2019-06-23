
const Logger = require('woveon-logger');
const WovReturn = require('./wovreturn');

/**
 * This is a base class of every "thing" which has a model in our system.
 * It connects to the database through a wovmodelclient.
 */
class WovModel {

  /**
   * @param {Object} _data - the data stored in this (NOTE> no schema checks yet, but would add WovReturn.checkAttributes)
   */
  constructor(_data) { this._data = _data; this._dirty = {}; }


  /**
   * Gets the data of the key, or if null, returns all data.
   * @param {string} _key
   * @return {*}
   */
  get(_key = null) { if ( _key == null) return this._data; else return this._data[_key]; }


  /**
   * @param {string} _keyOrObj - _key for _key/_val or this is an object with multiple key/vals
   * @param {string} _val
   * @param {string} _pgtype
   */
  set(_keyOrObj, _val) {
    let kv = {};
    if ( (typeof _keyOrObj) == 'object' ) kv = _keyOrObj;
    else kv[_keyOrObj] = _val; // eslint-disable-line security/detect-object-injection

    // save old values as dirty and set
    Object.keys(kv).forEach( function(_k) {
      if ( kv.hasOwnProperty(_k) ) {
        let q = this._dirty[_k] || []; q.push(this.get(_k)); this._dirty[_k] = q; // eslint-disable-line security/detect-object-injection
        this._data[_k] = kv[_k];                                                  // eslint-disable-line security/detect-object-injection
      }
    }.bind(this));
  }


  /**
   * Returns the data of this object, without ids and refs. Any components are flattened by default.
   * @param {bool} _recurse - if true, flattens components that have been dereferenced
   * @return {Object}
   */
  flatten(_recurse = true) {
    let retval = JSON.parse(JSON.stringify(this._data)); // duplicate data
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
   * Reads the component of this and sets on itself. The component should have a data ref (ex. this._data._X_ref for component X).
   *  ex. - readComp('account'), looks for this._data._account_ref, then reads from table 'account'.
   *      _ readComp('user'), looks for this._data._user_ref, then finds model this.cl['model_user'], which reads from model.tablename, which is 'users'
   *      _ readComp('persona') on Person, find no this.get('persona') so looks in _transmodel, getting default_persona, so gets model Persona,
   *        with Person.get('_default_persona')
   * @param {string} _modelname - property to check in data, to read in from, using _[_modelname]_ref. Or, use transref if not found.
   * @return {Object} - the component object if found
   */
  async readIn(_modelname) {

    let retval   = null;
    let mod      = null;
    let propname = null; // data-level name of the property, not model-level
    let cid      = null; // component id

    this.constructor.l.aspect('ws.src.WovModel_readIn', `readIn : ${_modelname} of this model ${this.constructor.name}`);
    this.constructor.l.aspect('ws.src.WovModel__readIn', 'check : ', this.get(`_${_modelname}_ref`));
    this.constructor.l.aspect('ws.src.WovModel__readIn', 'check transmodel : ', this.constructor._transmodel[_modelname]);


    { // already loaded
      let result = this[_modelname];
      if ( result !== undefined ) { retval = result; }
    }

    if ( retval == null ) {

      // check modelname/propname
      if ( this.get(`_${_modelname}_ref`) !== undefined ) {
        this.constructor.l.aspect('ws.src.WovModel_readIn', ' - 1 - ');
        propname = _modelname;
        mod = this.constructor.cl[`model_${_modelname.toLowerCase()}`];
        cid = this.get(`_${propname}_ref`);
      }

      // if not found yet, lookup in transmodel
      else if ( this.constructor._transmodel[_modelname] !== undefined ) {
        this.constructor.l.aspect('ws.src.WovModel__readIn', ' - 2 - ');
        propname = this.constructor._transmodel[_modelname];
        mod = this.constructor.cl[`model_${_modelname.toLowerCase()}`];
        cid = this.get(`_${propname}_ref`);
      }

      // if still not found, is it on the other Object, pointing to this?
      else {
        let t = `model_${_modelname.toLowerCase()}`;
        this.constructor.l.aspect('ws.src.WovModel__readIn', ' - 3.1 - ', t);
        let othermodel = this.constructor.cl[t];
        if ( othermodel != null ) {
          mod = othermodel;

          this.constructor.l.aspect('ws.src.WovModel__readIn', ` - 3.2 - ${this.constructor._transmodel[_modelname]} : ${this.constructor.name} : `, this.constructor._schema);
          //
          // find property (data level) : 1st use transmodel, then tablename if null. Then if schema, check it. use modelname if scema fails.
          propname = this.constructor._transmodel[_modelname];
          if ( propname == null ) { propname = this.constructor.tablename; } // if no transmodel entry, assume tablename (data layer) is correct
          // this.constructor.l.aspect('ws.src.WovModel_readIn', ` - 3.2a - propname : ${propname}`);

          // this.constructor.l.info(`mod's ${mod.name} schema: `, mod._schema);

          // if not tablename, then can correct with schema
          if ( mod._schema && mod._schema[`_${propname}_ref`] == undefined ) { propname = this.constructor.name.toLowerCase(); }
          // this.constructor.l.aspect('ws.src.WovModel_readIn', ` - 3.2b - propname : ${propname}`);
          if ( mod._schema && mod._schema[`_${propname}_ref`] == undefined ) {
            retval = new Error(`no ref to this model ${this.constructor.name} from ${mod.name}`);
          }
          // this.constructor.l.aspect('ws.src.WovModel_readIn', ' - 3.3 - propname : ', propname);

          // query remote reference id into this
          let q = `SELECT id FROM ${mod.tablename} WHERE _${propname}_ref=$1::integer`;
          let d = [this.get('id')];
          let result = await this.constructor.cl._runSingularQuery(q, d, 'ws.src.WovModel_readIn').catch(function(e) { return e; });
          // this.constructor.l.aspect('ws.src.WovModel_readIn', 'result : ', result);
          if ( result != null && (result instanceof Error) ) { retval = result; }
          else { cid = result.id; }
        }
      }
    }
    // this.constructor.l.info(`readIn : modelname(${_modelname}) propname(${propname}) : mod : `, mod.name, ` cid(${cid})`);

    // this.constructor.l.info(`retval 1: `, retval);
    if ( retval == null ) {

      if ( propname == null) this.constructor.l.throwError(`Unknown readIn modelname : '${_modelname}' of '${this.constructor.name}' and not in _transmodel : '${JSON.stringify(this.constructor._transmodel)}'.`);
      if ( mod == null ) this.constructor.l.throwError(`Unknown readIn model for modelname : '${_modelname}' of '${this.constructor.name}'.`);
    }

    // this.constructor.l.info(`retval 2: `, retval);
    if ( retval == null ) {
      // this.constructor.l.info(`setting value ${_modelname} of this`);

      // don't reload again... also prevents overwritting properties of the object
      if ( this[_modelname] === undefined ) {

        if ( (mod.prototype  instanceof WovModel) ) {
          let result = await mod.readByID(cid);
          // this.constructor.l.info(`result mod(${mod.name}) cid(${cid}):`, result);
          if ( result != null ) {
            this[_modelname] = result;
            retval = result;
          }
        }
        else { this.constructor.l.throwError(`Not a model : '${_modelname}'.`); }
      }
      else {
        this.constructor.l.warn(`Attempted to overwrite property '${_modelname}' of object of `+
          `class '${this.constructor.name}' when reading in model '${_modelname}'.`);
        this.constructor.l.printStack();
      }
    }

    return retval;
  }


  /**
   * For this, sets this[`${modelname}s`] = [models], where model's table has an _${this.name}_ref variable, that this reads.
   *  ex. car.readInMany('tire'), sets car.tires to be an array of tires.
   *
   * NOTE: for models where the plural form is not MODEL+'s', set _plural on the class definition.
   *   ex. with Goose._plural = 'geese', cage.readInMany('goose') would set cage.geese.
   *
   * @param {string} _modelname - the name of the model that has a many to one relationship to this.
   * @return {Array<WovModel>} - array of the models loaded
   */
  async readInMany(_modelname) {
    let retval = null;

    let omod     = null; // other model, reading from it
    let table    = null;
    let propname = null; // this.constructor.name;

    this.constructor.l.aspect('ws.src.WovModel_readInMany', `readInMany : from model '${_modelname}' to this model '${this.constructor.name}'`);

    { // already loaded
      let result = this[_modelname];
      if ( result !== undefined ) { retval = result; }
    }

    // get the model
    if ( retval == null ) {
      let t = `model_${_modelname.toLowerCase()}`;
      this.constructor.l.aspect('ws.src.WovModel__readInMany', ' - 3.1 - ', t);
      omod = this.constructor.cl[t];
      if ( omod == null ) retval = WovReturn.retError(this.constructor.name, `Could not find model.`);
    }

    // get table and propname
    if ( retval == null ) {
      table = omod.tablename;
      propname = omod._transmodel[_modelname.toLowerCase()];
      // this.constructor.l.aspect('ws.src.WovModel_readInMany', `propname 1: ${propname}: ${_modelname.toLowerCase()}: `, omod._transmodel);
      if ( propname === undefined ) { propname = this.constructor.name; }
      // this.constructor.l.aspect('ws.src.WovModel_readInMany', `propname 2: ${propname}`);
      if ( propname == null ) retval = WovReturn.retError(this.constructor.name, `No column of '_${_modelname}_ref' on table '${table}'.`);
      // this.constructor.l.aspect('ws.src.WovModel_readInMany', `propname 3: ${propname}`);

      // this.constructor.l.aspect('ws.src.WovModel_readInMany', 
      //  `table '${table}', column '_${propname}_ref' that point to '${this.constructor.name}'.`);
    }



    // read in values
    if ( retval == null ) {
      let q = `SELECT * FROM ${table} WHERE _${propname}_ref=$1::integer`;
      let d = [this.get('id')];
      let result = await omod.cl._runQuery(q, d, `ws.src.${this.constructor.name}_readInMany`)
        .catch( function(e) {
          return WovReturn.retError(e, `Failed reading table '${table}', column '_${propname}_ref' that point to '${this.constructor.name}'.`);
        }.bind(this));

      this.constructor.l.aspect('ws.src.WovModel_readInMany', `Q result:`, result);

      if ( result != null ) {
        if (result instanceof Error) { retval = result; }
        else {
          let models = [];
          result.forEach( function(_row) {
            let m = new omod(_row); // eslint-disable-line new-cap
            models.push(m);
          });
          let plural = omod._plural || `${_modelname}s`;
          this[plural] = models;
          retval = models;
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
    // console.log('isRef: ', _ref, this._data[_ref]);
    let retval = false;
    if ( _ref == null ) {}
    else if ( _ref.startsWith('_') && _ref.endsWith('_ref') && this._data[_ref] !== undefined ) { retval = true; }
    return retval;
  }

  /**
   * Helper function for isRef.
   * @param {WovModel} _obj - model to check for ref
   * @param {string} _ref - property to check
   * @return {boolean} - true if it is a ref
   */
  static isRef(_obj, _ref) { return _obj.isRef(_ref); }

  /**
   * @param {Logger}         _logger         - woveon logger
   * @param {WovModelClient} _wovmodelclient -
   */
  static init(_logger, _wovmodelclient) {
    this.l = _logger;
    this.cl= _wovmodelclient;
    if ( this.tablename   == null ) throw Error(`WovModel of class '${this.name}' requires model to set static: 'tablename'.`);
    if ( this._transmodel == null ) throw Error(`WovModel of class '${this.name}' requires model to set static: '_transmodel'.`);
    if ( this._schema     == null ) throw Error(`WovModel of class '${this.name}' requires model to call : '${this.name}.updateSchema'.`);
    this.l.aspect('wovmodelinit', `...init model '${this.name}', table '${this.tablename}', _transmodel: '${this._transmodel}', schema : `, this._schema);
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
    if ( data != null && !(data instanceof Error) ) { retval = new this(data); }
    return retval;
  }


  /**
   * @param {integer} _xid -
   * @return {WovModel} -
   */
  static async readByXID(_xid) {
    let retval = null;

    if ( this._schema.xid == null ) { retval = WovReturn.retError(this.name, `Called 'readByXID' on model without 'xid'.`); }

    if ( retval == null ) {
      // console.log('readByXID : ', this.name, this.tablename, _xid);
      let q = `SELECT * FROM ${this.tablename} WHERE xid=$1::uuid`;
      let d = [_xid];
      let result = await this.cl._runSingularQuery(q, d, `${this.name}.readByXID`);
      // console.log('result is ', result);
      if ( result != null && !(result instanceof Error) ) { retval = new this(result); }
    }

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
  static async createOne(_data) {
    let retval = null;
    let qp = this._buildQueryParams(_data, _data, 'insert');
    let q = `INSERT INTO ${this.tablename} (${qp.colnames.join(', ')})
             VALUES (${qp.cols.join(', ')})
             RETURNING *`;

    let result = await this.cl._runSingularQuery(q, qp.data, `createOne${this.name}`).catch(function(e) { return e; });
    if ( result != null && !(result instanceof Error) ) retval = new this(result);
    return retval;
  }

  /**
   * @param {integer} _id
   * @param {object} _data
   */
  static async updateOne(_id, _data) {
    // this.l.throwError(`Need to implement 'updateOne' for ${this.name}.`); }
    let qp = this._buildQueryParams(_data, _data, 'update');
    Logger.g().info('updateOne: ', qp);
    let q = `UPDATE ${this.tablename}
             SET ${qp.cols.join(', ')}
             WHERE id = ${_id}
             RETURNING *`;
    return await this.cl._runSingularQuery(q, qp.data, `updateOne${this.name}`).catch(function(e) { return e; });
  }

  /**
   * From an object with properties, build the col names and data for a query. If id is in _data, it is placed 1st.
   * @param {Object} _data - object to pull keys from (ex. this._data or this._dirty can be passed in)
   * @param {Object} _vals - object to pull vals from, with key (ex. this._data passed in, or this.get())
   * @param {Object} _qtype - query type 'insert'
   * @return {Object} - cols : columns in database, data : values for the cols, found : if found some tables (useful for 'dirty')
   */
  static _buildQueryParams(_data, _vals, _qtype) {
    let counter = 1;
    let retval = {colnames : [], cols : [], data : [], found : false};

    // Logger.g().info('buidlueyrParams : ', _data, _vals, _qtype);

    if ( this._schema == undefined ) { this.cl.l.throwError(`For '${this.name}', No schema.`); }

    // update keeps id, if it exists, out of the colnames and cols
    if ( _qtype == 'update' && _data.id != null ) { retval.data.push(_data.id); counter++; }

    Object.keys(_data).forEach(function(_key) {
      if ( _data.hasOwnProperty(_key) ) {
        if ( _key == 'id' && _qtype == 'update' ) {}      // ignore id for updates
        else if ( _key == 'id' && _qtype == 'insert' ) {  // insert uses id
          retval.found = true;
          retval.cols.push(`$${counter++}::integer`);
          retval.colnames.push(_key);
          retval.data.push(_vals[_key]);
        }
        else {
          retval.found = true;
          let sc = this._schema[_key];
          if ( sc === undefined ) this.l.throwError(`For '${this.name}', No schema for key '${_key}'.`);
          if ( _qtype == 'update' )      { retval.cols.push(`${_key}=$${counter++}::${this._schema[_key]}`); }
          else if ( _qtype == 'insert' ) { retval.cols.push(`$${counter++}::${this._schema[_key]}`); }
          retval.colnames.push(_key);
          retval.data.push(_vals[_key]);
        }
      }
    }.bind(this));

    return retval;
  }

  /**
   * Build a query to save dirty values.
   * @return {bool|Error} - true if was run, false if not run, Error if error
   */
  async save() {
    let retval = false;

    let qp = this.constructor._buildQueryParams(Object.assign({}, this._dirty, {id : this.get('id')}), this.get(), 'update');
    if ( qp.found == true ) {

      let q = `UPDATE ${this.constructor.tablename}
               SET ${qp.cols.join(', ')}
               WHERE id=$1::integer`;
      // this.constructor.cl.l.info('q: ', q);

      retval = this.constructor.cl._runSingularQuery(q, qp.data, `save${this.name}`).then(function() { return true; }).catch(function(e) { return e; });

      // reset dirty
      this._dirty = {};
    }
    return retval;
  }

  /**
   * Appends to the static Class._schema. Values in _schema that are null, are deleted from schema.
   * ex. { id : 'integer', name : 'text', xid : 'uuid', ...}
   * NOTE: schema only used so far for `save()`
   * @param {Object} _schema
   */
  static async updateSchema(_schema) {
    Logger.g().aspect('ms.WovModel::updateSchema', 'updateSchema : ', this.name, _schema, this._schema, 'hasOwnProperty: ', this.hasOwnProperty('_schema'));
    if ( this.hasOwnProperty('_schema') == false ) {
      // Logger.g().info('  - setting own property ');
      this._schema = {};
    }
    // else { Logger.g().info('  - existing property '); }

    if ( _schema != null ) {
      Object.keys(_schema).forEach(function(_key) {
        if ( _schema[_key] == null ) delete this._schema[_key];
        else {
          // Logger.g().info(`- add to schema ${_key} : ${_schema[_key]}`);
          this._schema[_key] = _schema[_key];
        }
      }.bind(this));
    }
  }

};


/*
   * _transmodel - routes model names to property names if they differ
   *   (ex. user to table users, persona to use _default_persona_ref of table persona.
   *
   *   Refs generally are 'this._data._X_ref' to load from model X, but sometimes you need model X from property '_Y_ref', creating property this.X.
   *
   *   This stores {Model : property, ...}, where the referene is `_property_ref`, and this is checked if there is no `this.get(X)`.
   *
   *   ex. readIn('persona'), with transmodel table {persona : default_persona} looks up this.get('_default_persona_ref'), to
   *       readIn a model Persona as this.persona.
   */
WovModel._transmodel = {};
WovModel._schema     = undefined;
WovModel._plural     = null;      // set to something else for readInMany

module.exports = WovModel;
