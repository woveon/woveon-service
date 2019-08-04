
const Logger = require('woveon-logger');
const WovReturn = require('./wovreturn');
const WovModelMany = require('./wovmodelmany');

/**
 * This is a base class of every "thing" which has a model in our system.
 * It connects to the database through a wovmodelclient.
 */
class WovModel {

  static cl = null;            // WovModelClient
  static _schema = null;       // the full schema of this model
  static _ownschema = null;    // the schema only added to by this model (i.e. not including parent)
  static _haschildren = false; // set by child models
  static _sensitive   = null;  // sensitive members of a model do not get returned by 'flatten'. Set during 'updateSchema'.

  /**
   * Creats a model from data retreived from the database.
   * @param {Object} _data - the data stored in this (NOTE> no schema checks yet, but would add WovReturn.checkAttributes)
   */
  constructor(_data) {
    if ( this.constructor.isInited() == false ) { throw Error(`Creating object of non-inited class ${this.constructor.name}.`); }
    if ( _data['id'] == null ) { throw Error(`Missing '${this.constructor.name}.id' in constructor data. Maybe you should call 'createOne' which creates this object, saves it and returns it with the id.`); }
    this._data = _data;
    this._model_t = this.constructor.name; // _data._model_t || this.name;
    delete this._data._model_t;
    this._dirty = {};
  }


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
   * Goes through an Object (not class) and deletes it's ids.
   * @param {Object} _objOrArray -
   * @param {bool} _recurse - if true, go down all paths
   * @param {bool} _deleteid -
   * @param {bool} _deleterefs -
   * @return {Object} -
   */
  static flattenObj(_objOrArray, _recurse = true, _deleteid = true, _deleterefs = true) {
    let retval = null;

    // Logger.g().info(`flattenObj recurse(${_recurse}) deleteid(${_deleteid}) deleterefs(${_deleterefs}): `, _objOrArray);


    // Array
    if ( Array.isArray(_objOrArray) ) {
      // Logger.g().info(`  array:`);
      let arr = _objOrArray;
      for (let k=0; k<arr.length; k++) {
        arr[k] = WovModel.flattenObj(arr[k], _recurse);
      }
      retval = arr;
    }

    // Object
    else {
      let obj = _objOrArray;
      // Logger.g().info(`  object:`);

      if ( _deleteid ) delete obj.id;


      // delete all refs
      if ( _deleterefs ) {
        for (let k in obj) {
          if ( WovModel.isRef(k) ) {
            // Logger.g().info(`  object: ${k}: delete ref`);
            delete obj[k];
          }
        }
      }

      // delete recursively
      if ( _recurse ) {
        for (let k in obj) {
          // Logger.g().info(`  object rec: ${k}`);
          // Logger.g().info(`  object rec:`, JSON.stringify(obj[k]));
          let v = obj[k];

          // if it's an object (or array) it recurses
          if ( v != null && typeof v == 'object' ) obj[k] = WovModel.flattenObj(v, _recurse);
        }
      }

      retval = obj;
    }

    // Logger.g().info(`  retval: `, retval);
    return retval;
  }


  /**
   * Flattens a class.
   * Returns the data of this object, without ids and refs. Any components are flattened by default.
   * @param {bool} _recurse - if true, flattens components that have been dereferenced
   * @param {bool} _deleteid -
   * @param {bool} _deleterefs -
   * @param {bool} _deletesensitive -
   * @return {Object}
   */
  flatten(_recurse = true, _deleteid = true, _deleterefs = true, _deletesensitive = true) {
    let retval = JSON.parse(JSON.stringify(this._data)); // duplicate data

    // delete id
    if ( _deleteid ) {
      delete retval.id;
    }

    // delete all refs
    if ( _deleterefs ) {
      for ( let k in retval ) {
        if ( retval.hasOwnProperty(k) ) { if ( this.isRef(k) ) { delete retval[k]; } }
      }
    }

    // delete all 'sensitive' members
    // this.constructor.l.info(`delete all 'sensitive' members`, this.constructor._sensitive);
    if ( _deletesensitive ) {
      for ( let i in this.constructor._sensitive) {
        let k = this.constructor._sensitive[i];
        // this.constructor.l.info('delete sensitive member : ', k);
        delete retval[k];
      }
    }
    // console.log('flatten2: ', retval);

    // flatten component WovModels recursively
    if ( _recurse ) {
      for ( let k in this ) {
        if ( this.hasOwnProperty(k) ) {
          let v = this[k];
          if ( v instanceof WovModel ) {
            retval[k] = v.flatten(_recurse, _deleteid, _deleterefs, _deletesensitive);
          }
        }
      }
    }

    // console.log('  - flattened : ', retval);

    return retval;
  }


  /**
   * Helper function that calls model (or if array each model's) flatten function.
   * @param {Array<WovModel>|WovModel|Object} _model_array_hash - model(s) to flatten, in different 'containers'
   * @param {bool} _recurse - if true, flattens components that have been dereferenced
   * @return {Array<Object>} -
   */
  static flatten(_model_array_hash, _recurse = true) {
    let models = null;
    let retval = [];

    if ( Array.isArray(_model_array_hash) )           { models = _model_array_hash; }    // array
    else if ( _model_array_hash instanceof WovModel ) { models = [_model_array_hash]; }  // model
    else { models = Object.values(_model_array_hash); }                                // hash

    models.forEach(function(_m) { retval.push(_m.flatten()); });

    return retval;
  }


  /**
   * Reads the component of this and sets on itself. The component should have a data ref (ex. this._data._X_ref for component X).
   *  ex. - readComp('account'), looks for this._data._account_ref, then reads from table 'account'.
   *      _ readComp('user'), looks for this._data._user_ref, then finds model this.cl['model_user'], which reads from model.tablename, which is 'users'
   *      _ readComp('persona') on Person, find no this.get('persona') so looks in _transmodel, getting default_persona, so gets model Persona,
   *        with Person.get('_default_persona')
   * @param {string} _modelnameU - property to check in data, to read in from, using _[_modelname]_ref. Or, use transref if not found.
   * @return {Object} - the component object if found
   */
  async readIn(_modelnameU) {

    let retval   = null;
    /*
    let mod      = null;
    let propname = null; // data-level name of the property, not model-level
    let cid      = null; // component id
    */

    let modelname = _modelnameU.toLowerCase();
    let modref   = null;

    this.constructor.l.aspect('ws.src.WovModel_readIn', `readIn : ${_modelnameU} of this model ${this.constructor.name}`);
    this.constructor.l.aspect('ws.src.WovModel__readIn', 'check : ', this.get(`_${modelname}_ref`));
    this.constructor.l.aspect('ws.src.WovModel__readIn', 'check transmodel : ', this.constructor._transmodel[modelname]);


    { // already loaded
      let result = this[modelname];
      if ( result !== undefined ) { retval = result; }
    }

    if ( retval == null ) {

      let result = await this._getModelRelation(_modelnameU);
      if ( result instanceof WovReturn ) { retval = result; }
      else modref = result;

      /*
        // check modelname/propname
      if ( this.get(`_${modelname}_ref`) !== undefined ) {
        this.constructor.l.aspect('ws.src.WovModel_readIn', ' - 1 - ');
        propname = modelname;
        mod = this.constructor.cl[`model_${modelname}`];
        cid = this.get(`_${propname}_ref`);
      }

    // if not found yet, lookup in transmodel
      else if ( this.constructor._transmodel[_modelnameU] !== undefined ) {
        this.constructor.l.aspect('ws.src.WovModel__readIn', ' - 2 - ');
        propname = this.constructor._transmodel[_modelnameU];
        mod = this.constructor.cl[`model_${modelname}`];
        cid = this.get(`_${propname}_ref`);
      }

    // if still not found, is it on the other Object, pointing to this?
      else {
        let t = `model_${modelname}`;
        this.constructor.l.aspect('ws.src.WovModel__readIn', ' - 3.1 - ', t);
        let othermodel = this.constructor.cl[t];
        if ( othermodel != null ) {
          mod = othermodel;

          this.constructor.l.aspect('ws.src.WovModel__readIn', ` - 3.2 - ${this.constructor._transmodel[_modelnameU]} : ${this.constructor.name} : `, this.constructor._schema);
//
// find property (data level) : 1st use transmodel, then tablename if null. Then if schema, check it. use modelname if scema fails.
          propname = this.constructor._transmodel[_modelnameU];
          if ( propname == null ) { propname = this.constructor.tablename; } // if no transmodel entry, assume tablename (data layer) is correct
          this.constructor.l.aspect('ws.src.WovModel__readIn', ` - 3.2a - propname : ${propname}`);

// this.constructor.l.info(`mod's ${mod.name} schema: `, mod._schema);

// if not tablename, then can correct with schema
          if ( mod._schema && mod._schema[`_${propname}_ref`] == undefined ) { propname = this.constructor.name.toLowerCase(); }
          this.constructor.l.aspect('ws.src.WovModel__readIn', ` - 3.2b - propname : ${propname}`);
          if ( mod._schema && mod._schema[`_${propname}_ref`] == undefined ) {
            retval = new Error(`no ref to this model ${this.constructor.name} from ${mod.name}`);
          }
          this.constructor.l.aspect('ws.src.WovModel__readIn', ' - 3.3 - propname : ', propname);

// query remote reference id into this
          let q = `SELECT id, _model_t FROM wsv_${mod.tablename} WHERE _${propname}_ref=$1::integer`;
          let d = [this.get('id')];
          let result = await this.constructor.cl._runSingularQuery(q, d, 'ws.src.WovModel_readIn').catch(function(e) { return e; });
          this.constructor.l.aspect('ws.src.WovModel__readIn', 'result : ', result);
          if ( result == null ) { retval = WovReturn.retError(result, `Nothing in '${mod.tablename}._${propname}_ref' references ${this.name}.id = ${this.get('id')} `);  } // nothing
          else if ( result instanceof Error ) { retval = result; }
          else {
            cid = result.id;

            // also, check _model_t, that omod is the correct model
            // this.constructor.l.info(`model ${result._model_t} vs  model ${mod.name}`);
            if ( result._model_t != mod.name ) {
              // this.constructor.l.aspect('ws.src.WovModel_readIn', `using polymorphic model ${result._model_t}, which is child of ${mod.name}`);
              this.constructor.l.warn(`*** using polymorphic model ${result._model_t}, which is child of ${mod.name}`);
              mod = this.constructor.cl[result._model_t];
            }
          }
        }
      }
      */
    }
    // this.constructor.l.info(`readIn : modelname(${_modelname}) propname(${propname}) : mod : `, mod, ` cid(${cid})`);

    // this.constructor.l.info(`retval 1: `, retval);
    if ( retval == null ) {

      if ( modref.propname == null) this.constructor.l.throwError(`Unknown readIn modelname : '${_modelnameU}' of '${this.constructor.name}' and not in _transmodel : '${JSON.stringify(this.constructor._transmodel)}'.`);
      if ( modref.mod == null ) this.constructor.l.throwError(`Unknown readIn model for modelname : '${_modelnameU}' of '${this.constructor.name}'.`);
    }

    // this.constructor.l.info(`retval 2: `, retval);
    if ( retval == null ) {
      // this.constructor.l.info(`setting value ${_modelname} of this`);

      // don't reload again... also prevents overwritting properties of the object
      if ( this[modelname] === undefined ) {

        if ( (modref.mod.prototype  instanceof WovModel) ) {
          let result = await modref.mod.readByID(modref.cid);
          // this.constructor.l.info(`result mod(${mod.name}) cid(${cid}):`, result);
          if ( result != null ) {
            this[modelname] = result;
            retval = result;
          }
        }
        else { this.constructor.l.throwError(`Can't find a model for : '${_modelnameU}'.`); }
      }
      else {
        this.constructor.l.warn(`Attempted to overwrite property '${modelname}' of object of `+
          `class '${this.constructor.name}' when reading in model '${_modelnameU}'.`);
        this.constructor.l.printStack();
      }
    }

    return retval;
  }


  /**
   * For this model, find the property, model and cid that it references.
   * ex. Tire._getModelRelation('wheel') -> {_wheel_ref, Wheel, #}
   * @param {string} _modelnameU - property to check in data, to read in from, using _[_modelname]_ref. Or, use transref if not found.
   * @return {Object} - {propname:, mod:, cid:,} or WovReturn<Error>
   */
  async _getModelRelation(_modelnameU) {
    let retval = null;

    let modelname = _modelnameU.toLowerCase();

    // check modelname/propname
    if ( this.get(`_${modelname}_ref`) !== undefined ) {
      this.constructor.l.aspect('ws.src.WovModel_readIn', ' - 1 - ');
      retval = {
        propname : modelname,
        mod      : this.constructor.cl[`model_${modelname}`],
        cid      : null,
      };
      retval.cid = this.get(`_${retval.propname}_ref`);
    }

    // if not found yet, lookup in transmodel
    else if ( this.constructor._transmodel[_modelnameU] !== undefined ) {
      this.constructor.l.aspect('ws.src.WovModel__readIn', ' - 2 - ');
      retval = {
        propname : this.constructor._transmodel[_modelnameU],
        mod      : this.constructor.cl[`model_${modelname}`],
        cid      : null,
      };
      retval.cid = this.get(`_${retval.propname}_ref`);
    }

    // else, if still not found, is it on the other Object, pointing to this?
    // (i.e. could potentially be a 1-Many relationship but user believes it is a 1-1)
    else {
      let t = `model_${modelname}`;
      this.constructor.l.aspect('ws.src.WovModel__readIn', ' - 3.1 - ', t);
      let othermodel = this.constructor.cl[t];
      if ( othermodel != null ) {
        let mod = othermodel;
        let cid = null;
        let propname = null;

        this.constructor.l.aspect('ws.src.WovModel__readIn', ` - 3.2 - ${this.constructor._transmodel[_modelnameU]} : ${this.constructor.name} : `, this.constructor._schema);
        //
        // find property (data level) : 1st use transmodel, then tablename if null. Then if schema, check it. use modelname if scema fails.
        propname = this.constructor._transmodel[_modelnameU];
        if ( propname == null ) { propname = this.constructor.tablename; } // if no transmodel entry, assume tablename (data layer) is correct
        this.constructor.l.aspect('ws.src.WovModel__readIn', ` - 3.2a - propname : ${propname}`);

        // this.constructor.l.info(`mod's ${mod.name} schema: `, mod._schema);

        // if not tablename, then can correct with schema
        if ( mod._schema && mod._schema[`_${propname}_ref`] == undefined ) { propname = this.constructor.name.toLowerCase(); }
        this.constructor.l.aspect('ws.src.WovModel__readIn', ` - 3.2b - propname : ${propname}`);
        if ( mod._schema && mod._schema[`_${propname}_ref`] == undefined ) {
          retval = new Error(`no ref to this model ${this.constructor.name} from ${mod.name}`);
        }
        this.constructor.l.aspect('ws.src.WovModel__readIn', ' - 3.3 - propname : ', propname);

        // query remote reference id into this
        let q = `SELECT id, _model_t FROM wsv_${mod.tablename} WHERE _${propname}_ref=$1::integer`;
        let d = [this.get('id')];
        let result = await this.constructor.cl._runSingularQuery(q, d, 'ws.src.WovModel_readIn').catch(function(e) { return e; });
        this.constructor.l.aspect('ws.src.WovModel__readIn', 'result : ', result);
        if ( result == null ) { retval = WovReturn.retError(result, `Nothing in '${mod.tablename}._${propname}_ref' references ${this.name}.id = ${this.get('id')} `);  } // nothing
        else if ( result instanceof Error ) { retval = result; }
        else {
          cid = result.id;

          // also, check _model_t, that omod is the correct model
          // this.constructor.l.info(`model ${result._model_t} vs  model ${mod.name}`);
          if ( result._model_t != mod.name ) {
            // this.constructor.l.aspect('ws.src.WovModel_readIn', `using polymorphic model ${result._model_t}, which is child of ${mod.name}`);
            this.constructor.l.warn(`*** using polymorphic model ${result._model_t}, which is child of ${mod.name}`);
            mod = this.constructor.cl[result._model_t];
          }

          retval = {
            propname : propname,
            mod      : mod,
            cid      : cid,
          };
        }
      }
    }

    // at this point, if retval is null, you have a problem
    if ( retval == null ) {
      retval = WovReturn.retError(_modelnameU, `'${_modelnameU}' of this model ${this.constructor.name} could not find a Model ref.`);
    }

    return retval;
  };

  /**
   * For this, sets this[`${modelname}s`] = [models], where model's table has an _${this.name}_ref variable, that this reads.
   *  ex. car.readInMany('tire'), sets car.tires to be an array of tires.
   *
   * NOTE: for models where the plural form is not MODEL+'s', set _plural on the class definition.
   *   ex. with Goose._plural = 'geese', cage.readInMany('goose') would set cage.geese.
   *
   * @param {string} _modelname - the name of the model that has a many to one relationship to this.
   * @param {Object} _limiters - limits query results ex {xid : [a, b, c]}
   * @return {Array<WovModel>|WovReturn<Error>} - array of the models loaded
   */
  async readInMany(_modelnameU, _limiters = {}) {
    let retval = null;

    let omod     = null; // other model, reading from it
    let table    = null;
    let propname = null; // this.constructor.name;
    let modelname = _modelnameU.toLowerCase();

    this.constructor.l.aspect('ws.src.WovModel_readInMany', `readInMany : from model '${modelname}' to this model '${this.constructor.name}'`);

    { // already loaded
      let result = this[modelname];
      if ( result !== undefined ) { retval = result; }
    }

    // get the model
    if ( retval == null ) {
      let t = `model_${modelname}`;
      this.constructor.l.aspect('ws.src.WovModel__readInMany', ' - 3.1 - ', t, Object.keys(this.constructor.cl));
      omod = this.constructor.cl[t];
      if ( omod == null ) {
        this.constructor.l.throwError(`'${this.constructor.name}::readInMany' called with unknown _modelname : ${_modelnameU}`);
        // retval = WovReturn.retError(this.constructor.name, `Could not find model.`);
      }
    }

//    this.constructor.l.info(`omod: ${omod}`); this.constructor.l.info(`retval: ${retval}`);

    // get table and propname
    if ( retval == null ) {
      table = omod.tablename;
      propname = omod._transmodel[modelname];
      this.constructor.l.aspect('ws.src.WovModel__readInMany', `propname 1: ${propname}: ${modelname}: `, omod._transmodel);
      if ( propname === undefined ) { propname = this.constructor.name.toLowerCase(); }
      this.constructor.l.aspect('ws.src.WovModel__readInMany', `propname 2: ${propname}`);
      if ( propname == null ) retval = WovReturn.retError(this.constructor.name, `No column of '_${modelname}_ref' on table '${table}'.`);
      this.constructor.l.aspect('ws.src.WovModel__readInMany', `propname 3: ${propname}`);

      this.constructor.l.aspect('ws.src.WovModel__readInMany',
        `table '${table}', column '_${propname}_ref' that point to '${this.constructor.name}'.`);
    }

    // this.constructor.l.info(`table: ${table}`);

    // read in values
    if ( retval == null ) {

      // transform limiters

      let q = `SELECT * FROM wsv_${table} WHERE _${propname}_ref=$1::integer`;
      let d = [this.get('id')];

      let ql = this._genLimiterQueries(_limiters, omod, d.length);
      if ( ql.q != '' ) {
        q += ` AND ${ql.q}`;
        d = d.concat(ql.d);
        this.constructor.l.info('q now: ', q);
        this.constructor.l.info('d now: ', d);
      }

      let result = await omod.cl._runQuery(q, d, `ws.src.${this.constructor.name}_readInMany`)
        .catch( function(e) {
          return WovReturn.retError(e, `Failed reading table '${table}', column '_${propname}_ref' that point to '${this.constructor.name}'.`);
        }.bind(this));

      this.constructor.l.aspect('ws.src.WovModel_readInMany', `Q result:`, result);

      if ( result != null ) {
        if (result instanceof Error) { retval = result; }
        else {
          let models = null;
          let proms  = [];
          for (let i in result ) {
            if ( result.hasOwnProperty(i) ) {
              let row = result[i];
              let m = this.constructor._polyReadCheck(row, omod);
              // let m = new omod(_row); // eslint-disable-line new-cap
              proms.push(m);
            }
          }
          await Promise.all(proms).then(function(_models) { models = _models; });
          // this.constructor.l.info('Models: ', models);
          let plural = omod._plural || `${modelname}s`;
          if ( this[plural] == null ) this[plural] = new WovModelMany();
          for (let k in models ) { this[plural][models[k].get('id')] = models[k]; }
          // this.constructor.l.info('PLural : ', this[plural]);
          retval = models;
        }
      }
    }

    return retval;
  }


  /**
   * A builder of an SQL query's WHERE part.
   *  {x:y}, {or : [{x1: y1}, {x2: y2}]}, etc
   * @param {Object} _l - limiter query object
   * @param {WovModel} _omod - model this is querying; needed for it's schema
   * @param {integer} _doff - data array offset for naming variables in assignment statement
   * @param {string} _op - operation to use
   * @param {integer} _depth - tracks how deep this recurses
   * @return {Object<{q,v}>} - additions to a SELECT query
   */
  _genLimiterQueries(_l, _omod, _doff, _op = 'AND', _depth = 1) {
    let retval = {q : '', d : [] };
    let q = [];

    // this.constructor.l.info(`${''.padEnd(_depth*2, ' ')}_genLimiterQueries`, _l, _omod.name, _op);

    if ( Array.isArray(_l) ) {
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


  /**
   * Refs are _X_ref, where X references an item in a table.
   * NOTE: refs are to tablenames, NOT model class names
   * @param {string} _ref - property to check
   * @return {boolean} - true if it is a ref
   */
  isRef(_ref) {
    let retval = false;
    if ( this.constructor.isRef(_ref) && this._data[_ref] !== undefined ) { retval = true; }
    return retval;
  }

  /**
   * Helper function for isRef.
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
   * @param {Logger}         _logger         - woveon logger
   * @param {WovModelClient} _wovmodelclient -
   */
  static init(_logger, _wovmodelclient) {
    this.l = _logger;
    this.cl= _wovmodelclient;
    let parent = Object.getPrototypeOf(this);

    // _logger.info(`init: this('${this.name}') parent('${parent.name}')  WovModel('${WovModel.name}').`);
    if ( parent.name != WovModel.name ) { parent.markHasChild();  }
    if ( this.tablename   == null ) throw Error(`WovModel of class '${this.name}' requires model to set static: 'tablename'.`);
    if ( this._transmodel == null ) throw Error(`WovModel of class '${this.name}' requires model to set static: '_transmodel'.`);
    if ( this._schema     == null ) throw Error(`WovModel of class '${this.name}' requires model to call : '${this.name}.updateSchema'.`);
    this.l.aspect('wovmodelinit', `...init model '${this.name}', table '${this.tablename}', _transmodel: '${this._transmodel}', schema : `, this._schema);
  }


  /**
   */
  static markHasChild() { this._haschildren = true; /* this.l.info(`marking '${this.name}' as having children'.`); */ }


  /**
   * Simple check if `init` has been called on this class definition.
   * @return {boolean} - true if it has, false if not
   */
  static isInited() { let retval = false; if ( this.l != null && this.cl != null ) retval = true; return retval; }


  /**
   * Reads in the data by the id. For polymorphic models, requires a 2nd read since the first read returns _model_t.
   * @param {integer} _id -
   * @return {WovModel|Error} -
   */
  static async readByID(_id) {
    let retval = null;
    // console.log('readByID : this: ', this, this.tablename);
    let data = await this.cl._selectByID(_id, `wsv_${this.tablename}`);
    // console.log('data is ', data);
    if ( data != null && !(data instanceof Error) ) {
      retval = await this._polyReadCheck(data);
      /*
      if ( data._model_t == this.name ) { retval = new this(data); }
      else { // polymorphic
        let Mod = this.cl[data._model_t];
        if ( Mod == null ) { this.cl.l.throwError(`ms.WovModel_readByID for '${this.name}' returned _model_t of '${data._model_t}' which does not exist on client.`); }
        retval = await Mod.readByID(_id);
      }
      */
    }
    return retval;
  }

  static async readByIDs(_ids) {
    let retval = null;

    let x = 1;
    let qqs = [];
    for (let id in _ids ) { qqs.push(`id=$${x++}::integer`); }
    let q = `SELECT * FROM "wsv_${this.tablename}" WHERE ${qqs.join(' AND ')}`;
    return this.cl._runQuery(q, _ids, 'ws.src.WovModel_readByIDs');
  }

  /**
   * Internal function that is passed the data from a read of a model's table. If the _model_t does not match the model, reread correct table.
   * @param {Object} _data - data read in from some other read. (readByID, readByXID, readIn, readInMany, etc)
   * @param {WovModel} _model - this model that the _data matches to; could be this, or another model 
   *      if reading in from another; creates an instance of this normally, if the _model_t matches. 
   *      Otherwise, gets the model of _model_t and creates.
   * @return {WovModel} - the object.
   */
  static async _polyReadCheck(_data, _model = null) {
    let retval = null;
    let Mod = _model || this;

    // this.cl.l.info('_polyReadCheck: ', _data); // , _model);
    if ( _data._model_t === undefined ) { throw Error('How did this happen. You have failed me.', _data, _model); }
    else if ( _data._model_t == Mod.name ) { retval = new Mod(_data); }
    else { // polymorphic
      Mod = this.cl[_data._model_t]; // get the model
      if ( Mod == null ) { this.cl.l.throwError(`ms.WovModel_readByID for '${this.name}' returned _model_t of '${_data._model_t}' which does not exist on client.`); }
      retval = await Mod.readByID(_data.id);
    }
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
      let q = `SELECT * FROM wsv_${this.tablename} WHERE xid=$1::uuid`;
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
   * Creates it in the database, then creates and returns the model.
   * @param {object} _data
   * @return {this|WovReturn<error>} - returns the newly created object.
   */
  static async createOne(_data) {
    let retval = null;

    // veryify data in
    if ( ! (_data instanceof Object) ) { retval = WovReturn.retError(_data, `${this.name}::createOne(...) requires _data to be an Object.`); }

    if ( retval == null ) {
      let qp = this._buildQueryParams(_data, _data, 'insert');
      let q = `INSERT INTO ${this.tablename} (${qp.colnames.join(', ')})
             VALUES (${qp.cols.join(', ')})
             RETURNING *`;

      let result = await this.cl._runSingularQuery(q, qp.data, `createOne${this.name}`).catch(function(e) { return e; });
      if ( result == null ) retval = WovReturn.retError(_data, `Failed to create ${this.name}'.`);
      else if ( result instanceof Error ) { retval = WovReturn.retError(result, `Failed to create '${this.name}'.`); }
      else retval = new this(result);
    }

    return retval;
  }

  /**
   * Writes back to the DB. Unlike save, this does not require a model.
   *
   * @param {integer} _id -
   * @param {object} _data - data to update on the model
   * @return {?} -
   */
  static async updateOne(_id, _data) {
    // this.l.throwError(`Need to implement 'updateOne' for ${this.name}.`); }
    let qp = this._buildQueryParams(_data, _data, 'update');
    // Logger.g().info('updateOne: ', qp);
    let q = `UPDATE ${this.tablename}
             SET ${qp.cols.join(', ')}
             WHERE id = ${_id}
             RETURNING *`;
    return await this.cl._runSingularQuery(q, qp.data, `updateOne${this.name}`).catch(function(e) { return e; });
  }


  /**
   * Convert a schema to a GraphQL schema.
   * - Build all vars and objs for this object (heritable traits stay in parent class)
   * @return {string}
   */
  static initGraphQLSchema() {
    let retval = null;


    // skip if already done
    if ( this.hasOwnProperty('_graphQL') == false ) {
      // this.l.info(`initGraphQLSchema: ${this.name}: `, this._ownschema);
      this._graphQL = {
        model : this.name,
        vars  : [],
        objs  : [],
      };

      // for own vars and objects
      for (let k in this._ownschema) {
        if ( this._ownschema.hasOwnProperty(k) ) {
          let v = this._ownschema[k];
          let qv = null;

          // skip _model_t
          if ( k == '_model_t' ) {}

          // objects
          else if ( this.isRef(k) ) {
            // this.l.info(`${this.name} : own var is a ref: ${k}`);
            let kt = k.substring(0, k.length - 4).substring(1);
            let gqlobject = null;
            // this.l.info(`  kt : ${kt} `, this._transmodel);
            if ( this._transmodel[kt] !== undefined ) {
              if ( kt != null ) { gqlobject = this._transmodel[kt]; }
            }
            else {
              let mod = this.cl.getModelByTablename(kt);
              if ( mod == null ) {
                this.l.throwError(`Model '${this.name}' references '${kt}', but no known model. Add transmodel entry of '${this.name}::{ ${kt} : X }'?`);
              }
              gqlobject = mod.name;
            }
            this._graphQL.objs.push([kt, gqlobject]);
          }
          else {
            let isarray = false;
            if ( v.endsWith('[]') ) { isarray = true; v = v.substring(0, v.length-2); }

            switch (v) {
              case 'text':
              case 'varchar':
              case 'uuid':
              case 'timestamp':
              case 'timestamp without time zone':
              case 'json':
                qv = 'String';
                break;
              case 'float':
                qv = 'Float';
                break;
              case 'integer':
                qv = 'Int';
                break;
              case 'bool':
              case 'boolean':
                qv = 'Boolean';
                break;
              default:
                // throw Error(`Unknown pgtype for '${k}' of '${v}'.`);
                this.l.warn(`Unknown pgtype for '${k}' of '${v}'. Assuming 'String' and continuing.`);
                qv = 'String';
                break;
            }
            if ( isarray ) qv = `[${qv}]`;
            this._graphQL.vars.push([k, qv]);
          }
        }
      }

      // for all other models, pointing to this, go through schema
      let models = Object.values(this.cl.table2model);
      for (let i in models) {
        let m = models[i];
        // this.l.info(`${this.name} <== ${m.name} : (tablename '${m.tablename}') : transmodel of : `, m._transmodel);

        // for all in schema
        for (let k in m._ownschema) {
          if ( m._ownschema.hasOwnProperty(k) ) {
            // this.l.info(`  - ${m.name}.${k}`);
            let addit = false;

            // deref k and see if the transmodel entry points to this model's name
            let kt = m._transmodel[k.substring(0, k.length - 4).substring(1)]; // see if dereffed k points to a model
            // this.l.info('ktt : ', k.substring(0, k.length - 4).substring(1));
            // this.l.info('kt : ', kt);
            if ( kt == this.name ) addit = true;

            // see if this other model's property points to the tablename of this model
            if ( k == `_${this.tablename}_ref` ) { addit = true; }

            if ( addit ) {
              // this.l.info(`    * adding ${m.name}.${k}`);
              this._graphQL.objs.push([m._plural || m.name.toLowerCase()+'s', `[${m.name}]`]);
            }
          }
        }
      }
    }

    // go to parent
    let parent = Object.getPrototypeOf(this);
    if ( parent.name != WovModel.name ) parent.initGraphQLSchema();


    // this.l.info(`${this.name} : `, this._graphQL);
    return retval;
  }


  /**
   * Inits each model, proceeding back through hierarchy, then builds params, going through hierarchy.
   * @return {string} - GraphQL type definition for this Model
   */
  static getGraphQLSchema() {
    this.initGraphQLSchema();

    // this.l.info(`getGraphQLSchema: ${this.name}`);

    let mod = this;
    let lines = [];
    let firstvarlength = null;
    let extlines = [];
    do {
      let varlength = 0;

      // extension lines (additions to GraphQL Schema from the Models)
      if ( mod.hasOwnProperty('_graphQLExt') ) {
        extlines.push(`# Extensions -- from ${mod.name}`);
        Object.assign(extlines, mod._graphQLExt); // add extentions from each module
        extlines.push('');
      }

      // directly translated lines of the schema
      if ( mod != this ) { lines.push(''); lines.push(`# -- from ${mod.name}`); }
      mod._graphQL.vars.forEach(function(p) { varlength = Math.max(varlength, p[0].length); });
      mod._graphQL.objs.forEach(function(p) { varlength = Math.max(varlength, p[0].length); });
      mod._graphQL.vars.forEach(function(p) { lines.push(`${p[0].padEnd(varlength)} : ${p[1]}`); });
      mod._graphQL.objs.forEach(function(p) { lines.push(`${p[0].padEnd(varlength)} : ${p[1]}`); });

      if ( firstvarlength == null ) firstvarlength = varlength;
      mod = Object.getPrototypeOf(mod);
    } while ( mod != WovModel );

    let retval = '';
    if ( extlines.length != 0 ) retval += extlines.join('\n');
    retval += `type ${this.name} {\n`+
              `  ${'id'.padEnd(firstvarlength)} : ID!\n`+
              `  ${lines.join('\n  ')}`+
              `\n}`;
    return retval;
  }


  /**
   */
  static async doInitDB(_doDrop, _doTable, _doView) {
    if ( this._schema == undefined ) { this.cl.l.throwError(`For model '${this.name}', No schema.`); }

    let q1 = `DROP TABLE IF EXISTS ${this.tablename} CASCADE;`;
    let q2 = null; // create table
    let q3a = `DROP VIEW IF EXISTS "wsv_${this.tablename}"`;
    let q3 = null; // create view
    let qp = null; // query parameters
    let schematouse = null;
    let parent = Object.getPrototypeOf(this);
    let d = []; // data

    // handle inheritance tables
    this.cl.l.aspect('ms.WovModel_doCreateTableQuery', `Model ${this.name} has parent of ${parent.name}, haschildren ${this._haschildren}.`);
    if ( parent.name == 'WovModel' ) { schematouse = this._schema; }
    else { schematouse = this._ownschema; }

    qp = this._buildQueryParams(schematouse, {}, 'create');
    // Logger.g().info(`doCreateTableQuery: ${this.name} `, qp);

    let cols = [];
    for (let i=0; i< qp.colnames.length; i++) {
      let colname = qp.colnames[parseInt(i)];
      if ( colname != 'id' ) {
        let coltype = qp.coltypes[parseInt(i)];
        cols.push(`${colname} ${coltype}`);
      }
    }

    // TODO _model_t as a lookup table

    // Create tables so that _model_t is only in tables with inheritance. Create the views to fill in model_t.
    if ( parent.name == 'WovModel' ) {
      if ( this._haschildren == false ) {
        q2 = `CREATE TABLE "${this.tablename}" ( id SERIAL PRIMARY KEY, ${cols.join(', ')} )`;
        q3 = `CREATE VIEW "wsv_${this.tablename}" AS SELECT *, text '${this.name}' as _model_t FROM "${this.tablename}"`;
      }
      else {
        q2 = `CREATE TABLE "${this.tablename}" ( id SERIAL PRIMARY KEY, _model_t varchar default '${this.name}', ${cols.join(', ')} )`;
        q3 = `CREATE VIEW "wsv_${this.tablename}" AS SELECT * FROM "${this.tablename}"`;
      }
    }
    else  {
      q2 = `CREATE TABLE ${this.tablename} ( _model_t varchar default '${this.name}', ${cols.join(', ')} ) INHERITS ( "${parent.tablename}" )`;
      q3 = `CREATE VIEW "wsv_${this.tablename}" AS SELECT * FROM "${this.tablename}"`;
    }

    this.cl.l.aspect('ms.WovModel_doCreateTableQuery', `q1(${_doDrop}): `, q1);
    this.cl.l.aspect('ms.WovModel_doCreateTableQuery', `q2(${_doTable}): `, q2);
    this.cl.l.aspect('ms.WovModel_doCreateTableQuery', `q3(${_doView}): `, q3);

    return (async function() { if ( _doDrop  ) await this.cl._runQuery(q1,  d, 'ms.WovModel__doCreateTableQuery'); }.bind(this))()
      .then(async function() { if ( _doTable ) await this.cl._runQuery(q2,  d, 'ms.WovModel__doCreateTableQuery'); }.bind(this))
      .then(async function() { if ( _doView  ) await this.cl._runQuery(q3a, d, 'ms.WovModel__doCreateTableQuery'); }.bind(this))
      .then(async function() { if ( _doView  ) await this.cl._runQuery(q3,  d, 'ms.WovModel__doCreateTableQuery'); }.bind(this))
      .catch(function(e) {
        this.cl.l.error('error:', e);
        return WovReturn.retError(e, `Failed to create table for '${this.tablename}'.`);
      }.bind(this));
  }


  /**
   * From an object with properties, build the col names and data for a query. If id is in _data, it is placed 1st.
   * @param {Object} _data - object to pull keys from (ex. this._data or this._dirty can be passed in)
   * @param {Object} _vals - object to pull vals from, with key (ex. this._data passed in, or this.get())
   * @param {Object} _qtype - query type 'create', 'insert' or 'update'
   * @return {Object} - cols : columns in database, data : values for the cols, found : if found some tables (useful for 'dirty')
   */
  static _buildQueryParams(_data, _vals, _qtype) {
    let counter = 1;
    let retval = {colnames : [], cols : [], data : [], found : false, coltypes : []};

    if ( this._schema == undefined ) { this.cl.l.throwError(`For model '${this.name}', No schema.`); }

    // update keeps id, if it exists, out of the colnames and cols
    if ( _qtype == 'update' && _data.id != null ) { retval.data.push(_data.id); counter++; }

    let data = _data;
    let vals = _vals;

    // if child, add in _model_t
    // let parent = Object.getPrototypeOf(this);
    // if ( parent.name != 'WovModel' ) {
      // Object.assign(data, {_model_t : this.name});
      // Object.assign(vals, {_model_t : this.name});
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
          retval.coltypes.push(this._schema[_key]);
        }
        else {
          retval.found = true;
          let sc = this._schema[_key];
          if ( sc === undefined ) this.l.throwError(`For model '${this.name}', No schema for key '${_key}'.`);
          if ( _qtype == 'update' )      { retval.cols.push(`${_key}=$${counter++}::${this._schema[_key]}`); }
          else if ( _qtype == 'insert' ) { retval.cols.push(`$${counter++}::${this._schema[_key]}`); }
          else if ( _qtype == 'create' ) { retval.cols.push(`$${counter++}::${this._schema[_key]}`); retval.coltypes.push(this._schema[_key]); }
          retval.colnames.push(`"${_key}"`);
          retval.data.push(vals[_key]);
        }
      }
    }.bind(this));


    return retval;
  }

  // TODO: reload()

  /**
   * Build a query to save dirty values.
   * @return {bool|Error} - true if was saved, false if not saved (no dirty data), Error if error.
   */
  async save() {
    let retval = false;
    let qtype = null;
    let savedata = null;

    /*
    if ( this.get('id') == null ) {
      qtype    = 'insert';
      savedata = this._data;
    }
    else*/ {
      qtype    = 'update';
      savedata = Object.assign({}, this._dirty, {id : this.get('id')});
    }

    this.constructor.cl.l.aspect(`${this.constructor.name}::save`, 'ws.WovModel.save()', this.savedata);
    let qp = this.constructor._buildQueryParams(savedata, this.get(), qtype);
    if ( qp.found == true ) {

      let q = `UPDATE ${this.constructor.tablename}
               SET ${qp.cols.join(', ')}
               WHERE id=$1::integer`;
      // this.constructor.cl.l.info('q: ', q);

      retval = this.constructor.cl._runSingularQuery(q, qp.data, `ws.WovModel.save ${this.constructor.name}::save`).then(function() { return true; }).catch(function(e) { return e; });

      // reset dirty
      this._dirty = {};
    }
    return retval;
  }

  /**
   * Appends to the static Class._schema. Values in _schema that are null, are deleted from schema. If parent has _schema, duplicates
   * those then adds to it (overwriting so be warned).
   * ex. { id : 'integer', name : 'text', xid : 'uuid', ...}
   * NOTE: 'sensitive' is a separate key, which stores an array of attributes to remove from 'flatten'.
   * @param {Object} _schema
   */
  static async updateSchema(_schema) {
    Logger.g().aspect('ms.WovModel::updateSchema', 'updateSchema : ', this.name, _schema, this._schema, 'hasOwnProperty: ', this.hasOwnProperty('_schema'));

    // duplicate schema on this class from parent so parent has it's own copy
    if ( this._schema != null ) {
      this._schema = JSON.parse(JSON.stringify(this._schema));

      // for inheritance, add in _model_t
      this._schema._model_t = 'varchar';
    }
    else { this._schema = {}; }

    // duplicate sensitive on this class from parent so parent has it's own copy
    if ( this._sensitive != null ) {
      this._sensitive = JSON.parse(JSON.stringify(this._sensitive));
    }
    else this._sensitive = {};

    this._ownschema = _schema;
    if ( this._ownschema.sensitive ) {
      // Logger.g().info(`- found sensitive entry(s) : `, this._ownschema['sensitive']);
      Object.assign(this._sensitive, this._ownschema['sensitive']);
      delete this._ownschema.sensitive;
    }

    Object.keys(_schema).forEach(function(_key) {
      if ( _schema[_key] == null ) delete this._schema[_key];
      else {
        // Logger.g().info(`- add to schema ${_key} : ${_schema[_key]}`);
        this._schema[_key] = _schema[_key];
      }
    }.bind(this));

  }


  /**
   */
  static displayModelConfig() {
    Logger.g().info(`WovModel ${this.name}`);
    Logger.g().info(` - tablename   : `, this.tablename);
    Logger.g().info(` - _transmodel : `, this._transmodel);
    Logger.g().info(` - _plural     : `, this._plural);
    Logger.g().info(` - _schema     : `, this._schema);
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
