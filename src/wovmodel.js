
const Logger = require('woveon-logger');
const WovReturn = require('./wovreturn');
const WovModelMany = require('./wovmodelmany');

const entity = require('./entity');

/**
 * @typedef integer
 * @typedef WovModelClient
 * @typedef Promise
 * @typedef symbol
 */

/**
 * This is a base class of every "thing" which has a model in our system.
 * It connects to the database through a wovmodelclient.
 */
class WovModel extends entity.WovEntityModel {

  static _schema     = null;   // the full schema of this model
  static _transmodel = {};     // defines the models for a ref (i.e. Refs that are not named after the model)
  static _erels      = null;   // entity relationship types (one to one or many) (1-to-1, 1-to-M)

  static _haschildren = false; // set by child models
  static _sensitive   = null;  // sensitive members of a model do not get returned by 'flatten'. Set during 'updateSchema'.
  static _plural     = null;   // for readIn, the plural name used instead of appending 's' to the model name

  // These are non-inherited class schema items
  static _ownschema     = null;
  static _owntransmodel = null;
  static _ownerels      = null;

  // enum basically
  static ER_ONE  = Symbol('one2one');
  static ER_MANY = Symbol('one2many');

  /**
   * Creats a model from data retreived from the database.
   *
   * @param {object} _data - the data stored in this (NOTE> no schema checks yet, but would add WovReturn.checkAttributes)
   */
  constructor(_data) {
    super();

    if ( this.constructor.isInited() == false ) { throw Error(`Creating object of non-inited class ${this.constructor.name}.`); }
    if ( _data['id'] == null ) { throw Error(`Missing '${this.constructor.name}.id' in constructor data. Maybe you should call 'createOne' which creates this object, saves it and returns it with the id.`); }
    this._data = _data;
    this._model_t = this.constructor.name; // _data._model_t || this.name;
    delete this._data._model_t;
    this._dirty = {};
  }


  /**
   * Gets the data of the key, or if null, returns all data.
   *
   * @param {string} _key -
   * @param {object} _options - additional options
   * @return {*} -
   */
  get(_key = null, _options = null) {
    let options = Object.assign({}, {
      stringify : false, // if true, then all objects are JSON.stringified
    }, _options);
    let retval = null;

    if ( _key == null) {
      let result = this._data;
      if ( options.stringify ) {
        retval = {};
        let keys = Object.keys(result);
        for (let i=0; i<keys.length; i++) {
          let k = keys[i];
          if ( result[k] != null && (typeof result[k]) == 'object' ) { retval[k] = JSON.stringify(result[k]); }
          else retval[k] = result[k];
        }
      }
      else { retval = result; }
    }
    else {
      retval = this._data[_key];
      if ( options.stringify && retval != null && ((typeof retval) == 'object' ) ) { retval = JSON.stringify(retval); }
    }

    return retval;
  }


  /**
   * Set a value of the model and mark it as needing to be saved (dirty).
   *
   * @param {object|string} _keyOrObj - _key for _key/_val or this is an object with multiple key/vals
   * @param {string|null} _val - a value if _keyOrObj is a string, null if object
   * @param {boolean} _markdirty - if true, marks as needing to be saved. If false, assuming it is because it is already changed in database.
   * @return {undefined} -
   */
  set(_keyOrObj, _val, _markdirty= true) {
    let kv = {};
    if ( (typeof _keyOrObj) == 'object' ) kv = _keyOrObj;
    else kv[_keyOrObj] = _val; // eslint-disable-line security/detect-object-injection

    // save old values as dirty and set
    Object.keys(kv).forEach( function(_k) {
      if ( kv.hasOwnProperty(_k) ) {
        let q = this._dirty[_k] || [];
        q.push(this.get(_k));
        if ( _markdirty == true ) { this._dirty[_k] = q; } // eslint-disable-line security/detect-object-injection
        this._data[_k] = kv[_k];                                                  // eslint-disable-line security/detect-object-injection
      }
    }.bind(this));
  }


  /**
   * Checks if the model has changes needing to be saved.
   *
   * @return {boolean} - true means it needs to save.
   */
  isDirty() {
    let retval = false;
    if ( Object.keys(this._dirty).length > 0 ) retval = true;
    return retval;
  }

  /**
   * Goes through an Object (not class) and deletes it's ids.
   *
   * @param {object} _objOrArray -
   * @param {boolean} _recurse - if true, go down all paths
   * @param {boolean} _deleteid -
   * @param {boolean} _deleterefs -
   * @return {object} -
   */
  /*
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
  */


  /**
   * Flattens a model instance.
   * Returns the data of this object, without ids and refs. Any components are flattened by default.
   * OLD: flatten(_recurse = true, _deleteid = true, _deleterefs = true, _deletesensitive = true).
   *
   * @param {object} _options - named options passed to the flatten
   * - recurse         - if true, flattens components that have been dereferenced
   * - deleteid        - default true
   * - deleterefs      - default true
   * - deletesensitive - default true
   * - keepinstance    - default true
   * @return {object} - clean data object
   */
  flatten(_options = {}) {
    let options = Object.assign({
      recurse         : true,
      deleteid        : true,
      deleterefs      : true,
      deletesensitive : true,
      keepinstance    : true,
    }, _options);
    let retval = JSON.parse(JSON.stringify(this._data)); // duplicate data

    // delete id
    if ( options.deleteid ) { delete retval.id; }

    // delete all refs
    if ( options.deleterefs ) {
      for ( let k in retval ) {
        if ( retval.hasOwnProperty(k) ) { if ( this.isRef(k) ) { delete retval[k]; } }
      }
    }

    // delete all 'sensitive' members
    if ( options.deletesensitive ) {
      for ( let i in this.constructor._sensitive) { let k = this.constructor._sensitive[i]; delete retval[k]; }
    }

    // flatten component WovModels recursively
    if ( options.recurse ) {
      for ( let k in this ) {
        if ( this.hasOwnProperty(k) ) {
          let v = this[k];
          if ( v instanceof WovModel ) { retval[k] = v.flatten(options); }
        }
      }
    }

    // retain link to model instance
    if ( options.keepinstance) { retval.wov_model_instance = this; }

    // console.log('  - flattened : ', retval);
    return retval;
  }


  /**
   * Helper function that calls flatten on model(s).
   *
   * @param {Array<WovModel>|WovModel|object} _model_array_hash - model(s) to flatten, in different 'containers'
   * @param {object} _options -
   * @return {Array<object>} -
   */
  static flatten(_model_array_hash, _options = {}) {
    let models = null; // to be an Array<WovModel>
    let retval = [];

    if ( Array.isArray(_model_array_hash) )           { models = _model_array_hash; }    // array
    else if ( _model_array_hash instanceof WovModel ) { models = [_model_array_hash]; }  // model
    else { models = Object.values(_model_array_hash); }                                  // hash, so grab values

    models.forEach(function(_m) { retval.push(_m.flatten(_options)); });

    return retval;
  }


  /**
   * Reads the component of this and sets on itself. The component should have a data ref (ex. this._data._X_ref for component X).
   * ex. - readComp('account'), looks for this._data._account_ref, then reads from table 'account'.
   * .    _ readComp('user'), looks for this._data._user_ref, then finds model this.cl['model_user'], which reads from model.tablename, which is 'users'.
   * .    _ readComp('persona') on Person, find no this.get('persona') so looks in _transmodel, getting default_persona, so gets model Persona,.
   * .      with Person.get('_default_persona').
   *
   * @param {string} _modelnameU - property to check in data, to read in from, using _[_modelname]_ref. Or, use transref if not found.
   * @return {object} - the component object if found
   */
  async __readIn(_modelnameU) {

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
          let result = await modref.mod.getByID(modref.cid);
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
   * ex. Tire._getModelRelation('wheel') -> {_wheel_ref, Wheel, #}.
   *
   * @param {string} _modelnameU - property to check in data, to read in from, using _[_modelname]_ref. Or, use transref if not found.
   * @return {object} - {propname:, mod:, cid:,} or WovReturn<Error>
   */
  async _getModelRelation(_modelnameU) {
    let retval = null;
    this.constructor.l.info(`_getModelRelation ${_modelnameU} : transmodel `, this.constructor._transmodel);

    this.constructor.l.logDeprecated('NO LONGER USED. Whatever called this should not be called either.');

    let modelname = _modelnameU.toLowerCase();

    // check modelname/propname
    if ( this.get(`_${modelname}_ref`) !== undefined ) {
      this.constructor.l.aspect('ws.src.WovModel_readIn', ' - 1 - ');
      this.constructor.l.info(' - 1 - ');
      retval = {
        propname : modelname,
        mod      : this.constructor.cl[`model_${modelname}`],
        cid      : null,
      };

      // if mod (model) not found, look up in transmodel
      /*
      if (retval.mod == null ) {
        console.log('mod is null');
        let mm = this.constructor._transmodel[_modelnameU];
        console.log('mm: ', mm);
        if ( mm != null ) retval.mod = this.constructor.cl[`model_${mm.toLowerCase()}`];
      }
      */
      retval.cid = this.get(`_${retval.propname}_ref`);
      this.constructor.l.info(`_getModelRelation retval of '${_modelnameU}' is :`, retval);
    }

    // if not found yet, lookup in transmodel
    else if ( this.constructor._transmodel[_modelnameU] !== undefined ) {
      this.constructor.l.aspect('ws.src.WovModel__readIn', ' - 2 - ');
      this.constructor.l.info(' - 2 - ');
      retval = {
        propname : this.constructor._transmodel[_modelnameU],
        mod      : this.constructor.cl[`model_${modelname}`],
        cid      : null,
      };
      retval.cid = this.get(`_${retval.propname}_ref`);
      this.constructor.l.info(`_getModelRelation retval of '${_modelnameU}' is :`, retval);
    }

    // else, if still not found, is it on the other Object, pointing to this?
    // (i.e. could potentially be a 1-Many relationship but user believes it is a 1-1)
    else {
      let t = `model_${modelname}`;
      this.constructor.l.aspect('ws.src.WovModel__readIn', ' - 3.1 - ', t);
      this.constructor.l.info(' - 3 - ');
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
   * Reads in models by their relationship.
   *
   * @param {string} _selector - the selection of the relationship. Form of selector[.backselector].
   * @param {object} _limiters - additional params sent to the SQL SELECT statement... see _genLimiterQueries
   * @return {WovReturn<WovModel|WovModelMany>} -
   */
  async readIn(_selector, _limiters = {}) {
    let retval       = null;
    let selector     = _selector;
    let backselector = null;

    // split the selector to get backselector
    let thesplit = _selector.split('.');
    if ( thesplit.length > 1 ) { selector = thesplit[0]; backselector = thesplit[1]; }

    // resolve all this to find the model and all that.
    let resolved = this._readInResolveModel(selector, backselector);
    this.constructor.l.aspect('readInResolvedModel', `_readInResolvedModel (${selector}, ${backselector}): `, resolved);


    if ( resolved == null ) {
      retval = WovReturn.retError(_selector, `'${_selector}' of '${this.constructor.name}' could not resolve.`);
      throw Error(retval);
    }
    else if ( !(resolved.model.prototype  instanceof WovModel) ) {
      retval = WovReturn.retError(_selector, `'${_selector}' of '${this.constructor.name}' returned non-model.`);
      throw Error(retval);
    }
    else {
      if ( resolved.direction == 'to' ) {
        let result = await resolved.model.getByID(resolved.cid);
        if ( result != null ) {
          this[selector] = result;
          retval = result;
        }
      }
      else if ( resolved.direction == 'from' ) {

        let q = `SELECT * FROM wsv_${resolved.model.tablename} WHERE ${resolved.ref}=$1::integer`;
        let d = [this.get('id')];

        // transform limiters
        let ql = this._genLimiterQueries(_limiters, resolved.model, d.length); // omod was 2nd param
        if ( ql.q != '' ) {
          q += ` AND ${ql.q}`;
          d = d.concat(ql.d);
          // this.constructor.l.info('q now: ', q);
          // this.constructor.l.info('d now: ', d);
        }

        let result = await resolved.model.cl._runQuery(q, d, `ws.src.${this.constructor.name}_readIn`)
          .catch( function(e) {
            return WovReturn.retError(e, `Failed reading table '${resolved.model.tablename}', column '${resolved.ref}' that point to '${this.constructor.name}, ${backselector}'.`);
          }.bind(this));

        this.constructor.l.aspect('ws.src.WovModel_readIn', `Q result:`, result);

        if ( result != null ) {
          if (result instanceof Error) { retval = result; }
          else {
            let models = null;
            let proms  = [];
            for (let i in result ) {
              if ( result.hasOwnProperty(i) ) {
                let row = result[i];
                let m = this.constructor._polyReadCheck(row, resolved.model);
                proms.push(m);
              }
            }
            await Promise.all(proms).then(function(_models) { models = _models; });
            // this.constructor.l.info('all loaded model instances: ', models);

            // check if singular
            /*
            this.constructor.l.info('singular check model        : ', resolved.model);
            this.constructor.l.info('singular check backselector : ', backselector);
            this.constructor.l.info('singular check              : ', resolved.model._erels[_backselector]);
            */

            // choose backselector, otherwise selector
            let bs = backselector;
            if ( bs == null ) bs = this._model_t.toLowerCase();
            // Logger.g().info(`selector(${selector})  backselector(${backselector})  bs(${bs}), resolved: `, resolved);

            // check for Entity Relationship
            if ( resolved.model._erels[bs] == this.constructor.ER_ONE ) {
              if ( models.length > 1 ) {
                this.constructor.l.error(`There is more than one model on a one-way reference. `+
                                         `Using 1st and continuing.`, resolved, models);
              }
              retval = models[0]; // use 1st
              this[bs] = retval;
            }
            else if ( resolved.model._erels[bs] == null ||
                      resolved.model._erels[bs] == this.constructor.ER_MANY ) {
              if ( resolved.model._erels[bs] == null ) {
                this.constructor.l.warn(`Called ${this._model_t}.readIn('${_selector}') but no Entity Relationship of one/many set. Set ${selector}'s erels['${bs}'] to WovModel.ER_ONE or WovModel.ER_MANY. For now, assuming ER_MANY and continuing.`);
              }

              let plural = resolved.model._plural || `${resolved.model.name.toLowerCase()}s`;
              if ( this[plural] == null ) this[plural] = new WovModelMany();
              for (let k in models ) { this[plural][models[k].get('id')] = models[k]; }
              // this.constructor.l.info('PLural : ', this[plural]);
              retval = models;
            }
            else {
              throw new Error(`Unknown ER type of '${resolved.model[bs]}' `+
                          `using '${_selector}' for : `, resolved);
            }
          }
        }
      }
      else {
        retval = WovReturn.retError(_selector, `'${_selector}' of '${this.constructor.name}' bad direction (to/from only): `, resolved );
      }
    }

    return retval;
  }


  /**
   * Takes the selector and backselector and finds the information needed for readIn.
   *
   * @param {string} _selector - the model or selector to use
   * @param {string} _backselector - if needed, the model key pointing back
   * @return {object} - direction, ref, model and cid
   */
  _readInResolveModel(_selector, _backselector = null) {
    let retval = null;
    /* {
      direction : null,  // to or from
      ref       : null,  // ref to use ex. _X_ref
      model     : null,  // model
    };*/
    let backselector = (_backselector?_backselector:this.constructor.name).toLowerCase();
    // this.constructor.l.info(`_readInResolveModel : selector(${_selector})  backselector(${backselector})`);

    // 1st case : to via transmodel
    if ( this.constructor._transmodel[_selector] !== undefined ) {
      this.constructor.l.aspect('ws.src.WovModel__readIn', ' - 1 - ');
      retval = {
        direction : 'to',
        ref       : `_${_selector}_ref`,
        model     : null,
        cid       : null,
      };
      // this.constructor.l.info('cl keys : ', Object.keys(this.constructor.cl), 'selector : ', _selector, this.constructor._transmodel);
      retval.model = this.constructor.cl[`model_${this.constructor._transmodel[_selector].toLowerCase()}`],
      retval.cid = this.get(retval.ref);
    }

    // 2nd case : to via selector
    else if ( this.get(`_${_selector}_ref`) !== undefined ) {
      this.constructor.l.aspect('ws.src.WovModel__readIn', ' - 2 - ');
      retval = {
        direction : 'to',
        ref       : `_${_selector}_ref`,
        model     : this.constructor.cl[`model_${_selector}`],
        cid       : null,
      };
      retval.cid = this.get(retval.ref);
    }

    // looking at 'from' cases now (which could be 1-to-many
    else {
      this.constructor.l.aspect('ws.src.WovModel__readIn', ' - from: ', `model_${_selector.toLowerCase()}`);
      let frommodel = this.constructor.cl[`model_${_selector.toLowerCase()}`];

      // 5th case - no model from selector
      if ( frommodel == null ) { throw Error(`5th case : no model of selector '${_selector}'.`); }

      // 3rd case : from via transmodel
      else if ( frommodel._transmodel[backselector] !== undefined ) {
        this.constructor.l.aspect('ws.src.WovModel__readIn', ' - 3 - ');
        retval = {
          direction : 'from',
          ref       : `_${backselector}_ref`,
          model     : frommodel,
          cid       : null,
        };
      }

      // 4th case : from via selector
      else if ( frommodel._schema[`_${backselector}_ref`] !== undefined ) {
        this.constructor.l.aspect('ws.src.WovModel__readIn', ` - 4 - ${JSON.stringify(this.get(), null, 2)} -- this is ${this.constructor.name}`);
        retval = {
          direction : 'from',
          ref       : `_${backselector}_ref`,
          model     : frommodel,
          cid       : null, // this.get('id'), // null,
        };

        this.constructor.l.aspect('ws.src.WovModel__readIn', ` - 4 - retval ${JSON.stringify(retval, null, 2)}`);
        this.constructor.l.aspect('ws.src.WovModel__readIn', ` - 4 - frommodel ${JSON.stringify(frommodel, null, 2)}`);
      }

      // 6th case - bad back selector
      else { throw Error(`6th case - bad back selector '${backselector}'.`); }
    }

    this.constructor.l.aspect('readInResolveModel', `readInResolveModel retval of '${_selector}' '${backselector}' is :`, retval);
    return retval;
  }


  /**
   * For this, sets this[`${modelname}s`] = [models], where model's table has an _${this.name}_ref variable, that this reads.
   * ex. car.readInMany('tire'), sets car.tires to be an array of tires.
   *
   * NOTE: for models where the plural form is not MODEL+'s', set _plural on the class definition.
   * ex. with Goose._plural = 'geese', cage.readInMany('goose') would set cage.geese.
   *
   * @param {string} _modelnameU - the name of the model that has a many to one relationship to this.
   * @param {object} _limiters - limits query results ex {xid : [a, b, c]}
   * @return {Array<WovModel>|WovReturn<Error>} - array of the models loaded
   */
  async __readInMany(_modelnameU, _limiters = {}) {
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
   * {x:y}, {or : [{x1: y1}, {x2: y2}]}, etc.
   *
   * @param {object} _l - limiter query object
   * @param {WovModel} _omod - model this is querying; needed for it's schema
   * @param {integer} _doff - data array offset for naming variables in assignment statement
   * @param {string} _op - operation to use
   * @param {integer} _depth - tracks how deep this recurses
   * @return {object<{q,v}>} - additions to a SELECT query
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
   * Refs are _X_ref, where X references an item in a table. NOTE: refs are to tablenames, NOT model class names.
   *
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
   * Init the model and check all is ok.
   *
   * @param {Logger}         _logger         - woveon logger
   * @param {WovModelClient} _wovmodelclient -
   * @return {undefined} -
   */
  static init(_logger, _wovmodelclient) {
    // this.l = _logger;
    // this.cl= _wovmodelclient;
    entity.WovEntityModel.init(_logger, _wovmodelclient);
    let parent = Object.getPrototypeOf(this);


    // _logger.info(`init: this('${this.name}') parent('${parent.name}')  WovModel('${WovModel.name}').`);
    if ( parent.name != WovModel.name ) { parent.markHasChild();  }
    if ( this.tablename   == null ) throw Error(`WovModel of class '${this.name}' requires model to set static: 'tablename'.`);
    if ( this._transmodel == null ) throw Error(`WovModel of class '${this.name}' requires model to set static: '_transmodel'.`);
    if ( this._schema     == null ) throw Error(`WovModel of class '${this.name}' requires model to call : '${this.name}.updateSchema'.`);
    this.l.aspect('wovmodelinit', `...init model '${this.name}', table '${this.tablename}', _transmodel: '${this._transmodel}', schema : `, this._schema);
  }


  /**
   * Marks this WovModel class as having children. This is useful for other datastructures and database schemas.
   *
   * @return {undefined} -
   */
  static markHasChild() { this._haschildren = true; /* this.l.info(`marking '${this.name}' as having children'.`); */ }


  /**
   * Simple check if `init` has been called on this class definition.
   *
   * @return {boolean} - true if it has, false if not
   */
  static isInited() { let retval = false; if ( this.l != null && this.cl != null ) retval = true; return retval; }


  /**
   * DEPRECATED.
   *
   * @param {integer} _id -
   * @return {WovModel|Error} -
   */
  static async readByID(_id) {
    Logger.g().logDeprecated('readByID -> getByID');
    return this.getByID(_id);
  }

  /**
   * Reads in the data by the id. For polymorphic models, requires a 2nd read since the first read returns _model_t.
   *
   * @param {integer} _id -
   * @return {WovModel|Error} -
   */
  static async getByID(_id) {
    let retval = null;
    // console.log(`getByID(${_id} : this: `, this, this.tablename);
    let data = await this.cl._selectByID(_id, `wsv_${this.tablename}`);
    // console.log('data is ', data);
    if ( data != null && !(data instanceof Error) ) {
      retval = await this._polyReadCheck(data);
      /*
      if ( data._model_t == this.name ) { retval = new this(data); }
      else { // polymorphic
        let Mod = this.cl[data._model_t];
        if ( Mod == null ) { this.cl.l.throwError(`ms.WovModel_getByID for '${this.name}' returned _model_t of '${data._model_t}' which does not exist on client.`); }
        retval = await Mod.getByID(_id);
      }
      */
    }
    // Logger.g().info(`getByID( ${_id} ) of ${this.tablename} : `, retval);
    return retval;
  }


  /**
   * DEPRECATED.
   *
   * @param {Array<integer>} _ids - ids of models to load.
   * @return {Promise} -
   */
  static async readByIDs(_ids) { Logger.g().logDeprecated('readByIDs -> getByIDs'); return this.getByIDs(_ids); }


  /**
   * Gets model instances by id array.
   *
   * @param {Array<integer>} _ids - ids of models to load.
   * @return {Promise} -
   */
  static async getByIDs(_ids) {
    let qqs = [];
    let xoff= 2; // offset from 0 due to parameters (starts at 1 anywany, then tablename param is 2)
    // let retval = null;
    // let x = 1;
    // for (let id in _ids ) { qqs.push(`id=$${x++}::integer`); }

    for (let i = 0; i< _ids.length; i++) { qqs.push(`id=$${i+xoff}::integer`); }
    let q = `SELECT * FROM "wsv_${this.tablename}" WHERE ${qqs.join(' AND ')}`;
    return this.cl._runQuery(q, _ids, 'ws.src.WovModel_getByIDs');
  }

  /**
   * Internal function that is passed the data from a read of a model's table.
   * If the _model_t does not match the model, reread correct table.
   *
   * @param {object} _data - data read in from some other read. (getByID, getByXID, readIn, readInMany, etc)
   * @param {WovModel} _model - this model that the _data matches to; could be this, or another model
   * if reading in from another; creates an instance of this normally, if the _model_t matches.
   * Otherwise, gets the model of _model_t and creates.
   * @return {WovModel} - the object.
   */
  static async _polyReadCheck(_data, _model = null) {
    let retval = null;
    let Mod = _model || this;

    this.cl.l.aspect('polyReadCheck', '_polyReadCheck: ', _data, (_model?_model.name:null));
    if ( _data._model_t === undefined ) { throw Error('How did this happen. You have failed me.', _data, _model); }
    else if ( _data._model_t == Mod.name ) { retval = new Mod(_data); }
    else { // polymorphic
      Mod = this.cl[_data._model_t]; // get the model
      if ( Mod == null ) { this.cl.l.throwError(`ms.WovModel_getByID for '${this.name}' returned _model_t of '${_data._model_t}' which does not exist on client.`); }
      retval = await Mod.getByID(_data.id);
    }
    return retval;
  }


  /**
   * DEPRECATED: use getByXID.
   *
   * @param {string} _xid -
   * @return {WovModel} - model instance
   */
  static async readByXID(_xid) { Logger.g().logDeprecated('readByXID -> getByXID'); return this.getByXID(_xid); }


  /**
   * Get a model instance by the XID (external id) value.
   * XIDs are good ways to hide internal identifiers from misuse (but keep in mind, ids are faster!).
   *
   * @param {integer} _xid -
   * @return {WovModel} -
   */
  static async getByXID(_xid) {
    let retval = null;

    if ( this._schema.xid == null ) { retval = WovReturn.retError(this.name, `Called 'getByXID' on model without 'xid'.`); }

    if ( retval == null ) {
      // console.log('getByXID : ', this.name, this.tablename, _xid);
      let q = `SELECT * FROM wsv_${this.tablename} WHERE xid=$1::uuid`;
      let d = [_xid];
      let result = await this.cl._runSingularQuery(q, d, `${this.name}.getByXID`);
      // console.log('result is ', result);
      if ( result != null && !(result instanceof Error) ) { retval = new this(result); }
    }

    return retval;
  }


  /**
   * Deletes a row form the table that is the data of the model object.
   *
   * @param {integer} _id -
   * @return {Promise} - ?returns I think the number of rows deleted?
   */
  static async deleteByID(_id) {
    let q = `DELETE FROM ${this.tablename} WHERE id=$1::integer RETURNING id`;
    let d = [_id];
    return this.cl._runSingularQuery(q, d, `deleteByID${this.name}`);
  }


  /**
   * Creates it in the database, then creates and returns the model.
   *
   * @param {object} _data -
   * @return {WovModel|WovReturn<Error>} - returns the newly created object.
   */
  static async createOne(_data) {
    let retval = null;

    // veryify data in
    if ( ! (_data instanceof Object) ) {
      retval = WovReturn.retError(_data, `${this.name}::createOne(...) requires _data to be an Object.`);
    }

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
    // this.l.throwError(`Need to implement 'updateOne' for ${this.name}.`);
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
   * - Build all vars and objs for this object (heritable traits stay in parent class).
   *
   * @return {string} -
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
              let mod = this.cl.statelayer.getModel(kt);
              // let mod = this.cl.statelayer[kt]; // get from statelayer
              // let mod = this.cl.getModelByTablename(kt);
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
   * Generates the code to access the data.
   *
   * @return {string} - javascript code
   */
  static getGraphQLModelResolver() {
    let retval = '';

    // this.l.info('_graphQL object ', this._graphQL);
    if ( this._graphQL == null ) this.initGraphQLSchema();

    // ex. this._graphQL.objs =  [ 'account', 'Account']
    retval += `const ${this.name} = {\n`;
    for (let i=0; i<this._graphQL.objs.length; i++) {
      let o = this._graphQL.objs[i];
      if ( o[1][0] != '[' ) {

        // rewrite readIn and readInMany so that if there is no model, use __resolveType to select Model

        retval +=
          `  ${o[0]} : async function(_parent, __, {args, dataSources}) {\n`+
          // `    console.log('asking to readIn: ${o[1]} : ${this.name}  ${o[0]}');\n`+
          // `    console.log(' __: ', __);\n`+
          // `    console.log(' _parent: ', _parent);\n`+
          // `    console.log(' context ', Object.keys(__));\n`+
          // `    console.log(' this.__resolveType: ', dataSources.statelayer.${this.name}.__resolveType);\n`+
          // `    let mm = dataSources.statelayer['${o[1]}'];\n`+
          // `    console.log('  dataSources model for ',mm);\n`+ // model does not exist
          // `    if ( mm == null ) mm = dataSources.statelayer[dataSources.statelayer.${this.name}.__resolveType(_parent)];\n`+
          // `    console.log('  need to read in model of : ', mm);\n`+
          `    let me = new dataSources.statelayer.${this.name}(_parent);\n`+
          // `    if ( me == null ) { console.log('ERROR: no model "${this.name}".'); return null; }\n`+
          // `    else { await me.readIn('${o[1]}'); return me.${o[0]}.get(); }\n`+
          `    console.log('**** resolver ${this.name} : readin : ${o[0]}, ${o[1]}');\n`+
          `    await me.readIn('${o[0]}');\n`+
          `    console.log('  after readin : ', me);\n`+
          `    if ( me.${o[0]} == null ) { console.log('WARNING: no value for "${this.name}.${o[0]}".'); }\n`+
          `    return me.${o[0]}.get();\n`+
          `  },\n`;
      }
      else {
        retval +=
          `  ${o[0]} : async function(_parent, __, {args, dataSources}) {\n`+
          `    console.log('asking to readInMany: ${o[1]}');\n`+
          `    let me = new dataSources.statelayer.${this.name}(_parent);\n`+
          `    await me.readInMany('${o[1].slice(1, -1)}');\n`+
          `    return me.${o[0]}.get();\n`+
          `  },\n`;
      }
    }

    // extra resolver functionality
    if ( this._graphQLExtResolvers != undefined ) {
      let ks = Object.keys(this._graphQLExtResolvers);
      for (let i=0; i<ks.length; i++) {
        let k = ks[i];
        let o = this._graphQLExtResolvers[k];
        retval += `  ${k} : ${o.toString()},\n`;
      }
    }

    retval += `}`;

    /*
    retval += `const ${mod.name} = {\n`;
    do {
      this.l.info(`getGraphQLModelResolver : ${this.name}`);

      // populate this
      let mdata = {
        attribname  : 'attribname',  // accountapplications
        modelname   : 'ModelName',   // Account
        modelreadin : 'ModelReadIn', // AccountApplications
      };
      mdata.modelname = mod.name;

      // For own schema (pointing to another model)
      for (let k in this._ownschema) {
        if ( this._ownschema.hasOwnProperty(k) ) {
          let v = this._ownschema[k];
          let qv = null;

          // objects
          if ( this.isRef(k) ) {
            this.l.info(`${this.name} : own var is a ref: ${k}`);
            let kt = k.substring(0, k.length - 4).substring(1);
            let gqlobject = null;
            this.l.info(`  kt : ${kt} `, this._transmodel);
            if ( this._transmodel[kt] !== undefined ) {
              if ( kt != null ) { gqlobject = this._transmodel[kt]; }
            }
            else {
              let mod = this.cl.getModelByTablename(kt);
              if ( mod == null ) {
                this.l.throwError(`Model '${this.name}' references '${kt}', but no known model. Add transmodel entry of '${this.name}::{ $  {kt} : X }'?`);
              }
              gqlobject = mod.name;
            }
            // this._graphQL.objs.push([kt, gqlobject]);

            this.l.info(`  ${k} : ${qv}`);
            mdata.modelreadin = `${gqlobject}`;
            mdata.attribname = `${kt}`;

            // echo it
            let c = `  ${mdata.attribname} : async function(_parent, __, {args, dataSources}) {\n`+
              `    let u = new dataSources.model.${mdata.modelname}(_parent);\n`+
              `    await u.readIn('${mdata.modelreadin}');\n`+
              `    return u.${mdata.attribname}.get();\n`+
              `  },\n`;
            this.l.info(`${c}`);
            retval += c;
          }
        }
      }

      // for all other models, pointing to this, go through schema
      let models = Object.values(this.cl.table2model);
      for (let i in models) {
        let m = models[i];
        this.l.info(`${this.name} <== ${m.name} : (tablename '${m.tablename}') : transmodel of : `, m._transmodel);

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
              this.l.info(`    * adding ${m.name}.${k}`);
              mdata.modelreadin = `${m.name}`;
              mdata.attribname = m._plural || m.name.toLowerCase()+'s';

              // echo it
              let c = `  ${mdata.attribname} : async function(_parent, __, {args, dataSources}) {\n`+
                `    let me = new dataSources.model.${mdata.modelname}(_parent);\n`+
                `    await me.readInMany('${mdata.modelreadin}');\n`+
                `    return me.${mdata.attribname}.get();\n`+
                `  },\n`;
              this.l.info(`${c}`);
              retval += c;
            }
          }
        }

      }


      mod = Object.getPrototypeOf(mod);
    } while ( mod != WovModel );
    */

    // retval += `}`;

    return retval;
  };


  /**
   * Inits each model, proceeding back through hierarchy, then builds params, going through hierarchy.
   *
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
   * Called to initialize the db table for the Model.
   *
   * WoveonService manipulates tables since it handles inheritance between models inside of a database that might not have that.
   *
   * The params set how it should handle existing data. Be VERY careful. doDrop should be false unless you are in testing.
   *
   * @param {boolean} _doDrop  - deletes the table model's table if exists (WARNING!!!!! CAREFULE!!!)
   * @param {boolean} _doTable - create the table if not exists
   * @param {boolean} _doView  - create the view if not exists (enables polyread)
   * @return {undefined} -
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
        q2 = `CREATE TABLE IF NOT EXISTS "${this.tablename}" ( id SERIAL PRIMARY KEY, ${cols.join(', ')} )`;
        q3 = `CREATE VIEW "wsv_${this.tablename}" AS SELECT *, text '${this.name}' as _model_t FROM "${this.tablename}"`;
      }
      else {
        q2 = `CREATE TABLE IF NOT EXISTS "${this.tablename}" ( id SERIAL PRIMARY KEY, _model_t varchar default '${this.name}', ${cols.join(', ')} )`;
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
   *
   * @param {object} _data - object to pull keys from (ex. this._data or this._dirty can be passed in)
   * @param {object} _vals - object to pull vals from, with key (ex. this._data passed in, or this.get())
   * @param {object} _qtype - query type 'create', 'insert' or 'update'
   * @return {object} - cols : columns in database, data : values for the cols, found : if found some tables (useful for 'dirty')
   */
  static _buildQueryParams(_data, _vals, _qtype) {
    let counter = 1;
    let retval = {colnames : [], cols : [], data : [], found : false, coltypes : [] };

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
   *
   * @return {boolean|Error} - true if was saved, false if not saved (no dirty data), Error if error.
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
   *
   * @param {object} _schema - schema object
   * @param {object} _trans - updates transmodel too
   * @return {undefined} -
   */
  static async updateSchema(_schema, _trans) {
    Logger.g().aspect('ms.WovModel::updateSchema', 'updateSchema : ', this.name, _schema, this._schema, 'hasOwnProperty: ', this.hasOwnProperty('_schema'));

    Logger.g().logDeprecated('use setSchema');

    this.setSchema({schema : _schema, trans : _trans});
  }


  /**
   * Called once on each 'class definition' of a model to define the schema and to extend it from a child.
   *
   * @param {object} _sc - schema additions of schema, trans and erels(entity relations)
   * @return {undefined} -
   */
  static async setSchema(_sc) {

    if ( _sc.schema == undefined ) _sc.schema = {};
    if ( _sc.trans  == undefined ) _sc.trans  = {};
    if ( _sc.erels  == undefined ) _sc.erels  = {};

    // plural
    // if ( _sc.plural ) this._plural = _sc.plural;

    // schema init and duplicate child
    if (true) {
      // duplicate schema on this class from parent so parent has it's own copy
      if ( this._schema != null ) {
        this._schema = JSON.parse(JSON.stringify(this._schema));

        // for inheritance, add in _model_t
        this._schema._model_t = 'varchar';
      }
      else { this._schema = {}; }

      // duplicate trans on this class from parent so parent has it's own copy
      if ( this._transmodel != null ) { this._transmodel = JSON.parse(JSON.stringify(this._transmodel)); }
      else { this._transmodel = {}; }

      // duplicate sensitive on this class from parent so parent has it's own copy
      if ( this._sensitive != null ) {
        this._sensitive = JSON.parse(JSON.stringify(this._sensitive));
      }
      else this._sensitive = {};

      // duplicate erels
      if ( this._erels != null ) {
        this._erels = JSON.parse(JSON.stringify(this._erels));
      }
      else this._erels = {};
    }

    // Own values
    if (true) {
      this._owntransmodel = _sc.trans;
      this._ownschema     = _sc.schema;
      this._ownerels      = _sc.erels;
      if ( this._ownschema.sensitive ) {
        // Logger.g().info(`- found sensitive entry(s) : `, this._ownschema['sensitive']);
        Object.assign(this._sensitive, this._ownschema['sensitive']);
        delete this._ownschema.sensitive;
      }
    }

    // Copy in schema
    Object.keys(_sc.schema).forEach(function(_key) {
      if ( _sc.schema[_key] == null ) delete this._schema[_key];
      else {
        // Logger.g().info(`- add to schema ${_key} : ${_schema[_key]}`);
        this._schema[_key] = _sc.schema[_key];
        // if ( this.isRef(_key) ) this._transmodel[_key] = this.ER_ONE; // one to one by default
      }
    }.bind(this));

    // Copy in trans
    Object.keys(_sc.trans).forEach(function(_key) {
      if ( _sc.trans[_key] == null ) delete this._transmodel[_key];
      else { this._transmodel[_key] = _sc.trans[_key]; }
    }.bind(this));

    // Copy in entity relations
    Object.keys(_sc.erels).forEach(function(_key) {
      if ( _sc.erels[_key] == null ) delete this._erels[_key];
      else {
        this._erels[_key] = this.erelsText2Symbol( _sc.erels[_key] );
      }
    }.bind(this));

  }


  /**
   * Convert string to a Symbol. This symbol is used in comparisons as they are faster to compare.
   *
   * @param {string} _erel - The name of the Entity Relationship.
   * @return {symbol} - The ER symbol of the string.
   */
  static erelsText2Symbol(_erel) {
    let retval = null;

    switch (_erel) {
      case 'one':
        retval = this.ER_ONE;
        break;
      case 'many':
        retval = this.ER_MANY;
        break;
      default:
        this.l.throwError(`Unknown type of Entity Relationship of '${_erel}'.`);
        break;
    }

    return retval;
  }


  /**
   * Display method.
   *
   * @return {undefined} -
   */
  static displayModelConfig() {
    Logger.g().info(`WovModel ${this.name}`);
    Logger.g().info(` - tablename   : `, this.tablename);
    Logger.g().info(` - _plural     : `, this._plural);
    Logger.g().info(` - _schema     : `, this._schema);
    Logger.g().info(` - _transmodel : `, this._transmodel);
    Logger.g().info(` - _erels      : `, this._erels);
    Logger.g().info(` - _sensitive  : `, this._sensitive);
  }

};

module.exports = WovModel;
