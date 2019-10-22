const Logger = require('woveon-logger');
const WovReturn = require('./wovreturn');
const WovModelMany = require('./wovmodelmany');

const entity = require('./entity');

/**
 * @typedef integer
 * @typedef WovClientEntity
 * @typedef Promise
 * @typedef symbol
 */

/**
 * This is a base class of every "thing" which has a model in our system.
 * It connects to the persistent store through a WovClient, which can be local via WovDB or remote via graphql calls.
 */
class WovModel extends entity.WovModelEntity {

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

  // Static connections to client and logger
  static cl = null;
  static l  = null;

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
          if ( v instanceof WovModel || v instanceof WovModelMany ) { retval[k] = v.flatten(options); }
        }
      }
    }

    // retain link to model instance
    if ( options.keepinstance) { retval.wov_model_instance = this; }
    else delete(retval.wov_model_instance);

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

    models.forEach(function(_m) {
      try {
        retval.push(_m.flatten(_options));
      }
      catch (e) {
        Logger.g().info('e: ', e);
        Logger.g().info('_m: ', models);
        exit(1);
      }
    });

    return retval;
  }


  /**
   * Reads in models by their relationship. (see deRef).
   *
   * @param {string} _selector - the selection of the relationship. Form of '_(selector)_ref' or Model[.backselector].
   * @param {object} _limiters - additional params sent to the SQL SELECT statement... see _genLimiterQueries
   * @return {WovReturn<WovModel|WovModelMany>} -
   */
  async readIn(_selector, _limiters = {}) {
    let retval       = null;

    let resolved = this.constructor.deRef(null, _selector);
    this.constructor.l.aspect('deRef', `deRef (${_selector}): `, resolved);

    if ( resolved == null ) {
      retval = WovReturn.retError(_selector, `'${_selector}' of '${this.constructor.name}' could not resolve.`);
      throw Error(retval);
    }
    else if ( !(resolved.model.prototype  instanceof WovModel) ) {
      retval = WovReturn.retError(_selector, `'${_selector}' of '${this.constructor.name}' returned non-model.`);
      throw Error(retval);
    }
    else {
      if ( resolved.dir == 'to' ) {
        let result = await resolved.model.getByID(this.get(resolved.ref));
        if ( result != null ) {
          this[resolved.sel] = result;
          retval = result;
        }
      }
      else if ( resolved.dir == 'from' ) {

        this.constructor.l.aspect('ws.src.WovModel_readIn', `handle from: `, resolved.model.name);

        // let result = await resolved.model.getToMe(this.get('id'), resolved.ref, _limiters);
        let result = await this.constructor.cl.getToMe(this.get('id'), resolved.ref, resolved.model, _limiters);

        this.constructor.l.aspect('ws.src.WovModel_readIn', `Q result:`, result);

        if ( result != null ) {
          if (result instanceof Error) { retval = result; }
          else {
            let models = null;
            let proms  = [];
            for (let i in result ) {
              if ( result.hasOwnProperty(i) ) {
                let row = result[i];
                let m = this.constructor.cl._polyReadCheck(row, resolved.model); // TODO/ doesn't getByID also call polyReadCheck/ ??? passing resolved.model and not this.constructor? I think this is ok, since the poly is done here already
                proms.push(m);
              }
            }
            await Promise.all(proms).then(function(_models) { models = _models; });
            // this.constructor.l.info('all loaded model instances: ', models);

            // add these to this
            if ( resolved.erel == this.constructor.ER_ONE ) {
              if ( models.length > 1 ) {
                this.constructor.l.error(`There is more than one model on a one-way reference. `+
                                         `Using 1st and continuing.`, resolved, models);
              }
              retval = models[0]; // use 1st
              // Logger.g().info(`setting object on ${this.name} with resolved: `, resolved);
              if ( resolved.selbak ) this[resolved.selbak.toLowerCase()] = retval;
              else this[resolved.sel.toLowerCase()] = retval;
            }
            else if ( resolved.erel == this.constructor.ER_MANY ) {
              let plural = resolved.model._plural || `${resolved.model.name.toLowerCase()}s`;

              // create WovModelMany if does not exist (will add to it next)
              if ( this[plural] == null ) { this[plural] = new WovModelMany(); }
              for (let k in models ) { this[plural][models[k].get('id')] = models[k]; }
              retval = models;
            }
            else {
              throw new Error(`Unknown ER type of '${resolved.erel}' using '${_selector}' for : `, resolved);
            }
          }
        }
      }
      else {
        throw Error(`'${_selector}' of '${this.constructor.name}' bad direction (to/from only): `, resolved );
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
  /*
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
  */


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
   * Rewrite of deRef.
   *
   * Selector format: Model|Model[:Backselector]|Transmodel|Model[:Transmodel].
   *
   * BB -> to Model BB.
   * BB:b -> to Model BB, with BB._b_ref pointing to this (ambigous TO/MANY).
   * tob -> in this._transmodel['tob'] points to model BB, and this._schema['_tob_ref'] exists.
   * BB:toa -> in BB._transmodel['toa'] points to this, and BB._schema['_toa_ref'] exists (ambigious TO/MANY).
   *
   * @param {string} _ref - a ref. ex. _tire_ref
   * @param {string} _sel - a selctor. ex. tire aka from _tire_ref.
   * @param {boolean} _usecache - toggle caching results of deRef (on by default)
   * @return {object} - of { model, dir, sel, ref, erel }
   */
  static deRef(_ref, _sel, _usecache = true) {
    let retval = null;
    let sel    = null;
    let selmod = null;
    let selbak = null;
    let ref    = null;
    let selsplit = null;

    // console.log('------WovModel::deRef : ', this);

    // set the selector and ref to use, generated from either the _ref or _selector param
    if ( _ref ) { sel = _ref.substring(0, _ref.length - 4).substring(1).toLowerCase(); ref = _ref; }
    else if ( _sel) {

      // use cache
      if ( this._usecache && this._cachesel && this._cachesel[_sel] !== undefined ) {
        return this._cachesel[_sel];
      }

      selsplit = _sel.split(':');
      sel = selsplit[0];
      if ( selsplit[1] != null ) { sel = null; selbak = selsplit[1]; selmod = this.cl.statelayer.getModel(selsplit[0]); }
      else sel = sel.toLowerCase();
      ref = `_${sel}_ref`;
    }
    else {
      throw Error('Passed neither a _ref or _sel to deRef.');
    }
    this.l.aspect('deRef', `${this.name}.deRef ${_ref}:${_sel} -> ${ref}:${sel}${selbak}  : selmod(${(selmod?selmod.name:selmod)})`);

    // selector is in transmodel
    if ( selmod == null && this._transmodel[sel] != null ) {
      this.l.aspect('deRef', `  - selector is in transmodel as model : ${this._transmodel[sel]}`);
      retval = {
        model : this.cl.statelayer.getModel(this._transmodel[sel]),
        sel   : sel,
        ref   : ref,
        dir   : 'to',
        erel  : WovModel.ER_ONE,
      };
    }

    // selector is a modelname
    else if ( selmod == null && this._schema[ref] != undefined ) {
      this.l.aspect('deRef', `  - selector is a model name`);
      retval = {
        model : this.cl.statelayer.getModel(sel),
        sel   : sel,
        ref   : ref,
        dir   : 'to',
        erel  : WovModel.ER_ONE,
      };
    }

    // from
    else {

      // Cases:
      // - selmod from above, with backref (ex. BB:b)
      // - modelname is sel, with ref _(this.name)_ref (ex. BB) (NOTE: this._(this.tablename)_ref)

      if ( selmod == null ) {
        selmod = this.cl.statelayer.getModel(sel); // getModel operates on lowercase to this is ok
        selbak = this.name.toLowerCase();
        this.l.aspect('deRef', `  - from with assumed backselector : ${selbak}`);
        if ( selmod == this) selmod = null;
      }
      else { this.l.aspect('deRef', `  - from with assigned backselector : ${selbak}`); }

      if ( selmod ) {
        try {
          let result = selmod.deRef(null, selbak); // sel can be a backref or the original sel
          this.l.aspect('deRef', '    - from returned : ', result);
          if ( result != null ) {
            retval = {
              model : selmod,
              sel   : (_sel?_sel:selmod.name),
              ref   : `_${selbak}_ref`,
              dir   : 'from',
              erel  : WovModel.ER_MANY, // TODO : read from erels
            };
            if ( selsplit && selsplit.length > 1 ) { retval.selbak = selmod.name.toLowerCase(); } // if provided a backselector, then need to return that

            //  so selmod has (selmod erels entry for the selbak) of this
            let erel = selmod._erels[selbak];
            this.l.aspect('deRef', '    - erel of from : ', erel);
            if ( erel == null ) {
              this.l.warn(`Ambiguous erel: ${selmod.name} has ? of ${this.name}. Set ${selmod.name}._erel['${selbak}'].`);
              retval.ambiguous = true;
            }
            else retval.erel = erel;
          }

        }
        catch (e) { throw Error(`Bad deRef of ${_ref} ${_sel}.`); }
      }
      else {
        throw Error(`Bad deRef of ${_ref} ${_sel}.`);
      }
    }

    if ( _usecache && _sel != null ) {
      if ( this._cachesel === undefined ) { this._cachesel = {}; }
      this._cachesel[_sel] = retval;
    }

    return retval;
  }


  /**
   * Init the model and check all is ok.
   *
   * @param {Logger}         _logger         - woveon logger
   * @param {WovClientEntity} _wovclient -
   * @return {undefined} -
   */
  static init(_logger, _wovclient) {

    // set static values
    this.cl = _wovclient;
    this.l  = _logger;
    if ( entity.WovModelEntity.l == undefined ) entity.WovModelEntity.l = _logger;

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
  static markHasChild() {
    this._haschildren = true;
    /* this.l.info(`marking '${this.name}' as having children'.`); */
  }


  /**
   * Retreives models pointing to this, with limiters to restrict results.
   *
   * @param {string} _ref - the ref to look up
   * @param {object} _limiters - object of the format in getToMe comments
   * @return {object} - ?
   */
  async getToMe(_id, _limiters = null) { return this.constructor.cl.getToMe(_id, _ref, this, _limiters); }


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
      if (this.debugme) this.l.info(`initGraphQLSchema: ${this.name}: `, this._ownschema);
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
            if ( this.debugme ) this.l.info(`${this.name} : own var is a ref: ${k}`);
            let kt = k.substring(0, k.length - 4).substring(1);
            let gqlobject = null;
            if ( this.debugme ) this.l.info(`  kt : ${kt} `, this._transmodel);
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
            if ( this.debugme ) this.l.info(`  - self adding obj : ${kt}, ${gqlobject}`);
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
            if ( this.debugme ) this.l.info(`  - self adding var : ${k}, ${qv}`);
            this._graphQL.vars.push([k, qv]);
          }
        }
      }

      if ( this.debugme) this.l.info('  - models to this');

      // for all other models, pointing to this, go through schema
      let models = Object.values(this.cl.table2model);
      for (let i in models) {
        let m = models[i];
        // this.l.info(`${this.name} <== ${m.name} : (tablename '${m.tablename}') : transmodel of : `, m._transmodel);

        // for all in schema
        for (let k in m._ownschema) {
          if ( m._ownschema.hasOwnProperty(k) ) {
            if ( m.debugme ) this.l.info(`  - ${m.name}.${k}`);
            if ( WovModel.isRef(k) ) {
              let addit = false;

              let mm = m.deRef(k, null);
              if ( m.debugme ) this.l.info(`    - mm is ${(mm != null? mm.model.name: undefined)}: `, mm);
              if ( mm.model == this) addit = true;

              if ( addit ) {
                let kk = k.substring(0, k.length - 4).substring(1); // pluck inner from reference

                // append selector if it is a named selector (not to a model)
                let plural = m._plural || m.name.toLowerCase()+'s';
                if ( mm.sel != mm.model.name.toLowerCase() ) plural += `_${mm.sel}`;

                if ( m.debugme ) {
                  this.l.info(`    - from ${m.name}.${k} adding to ${this.name} obj : ${plural}, [${m.name}]`);
                  this.l.info(`      - ${this.name}.erels : `, this._erels);
                  this.l.info(`      - ${m.name}.erels : `, m._erels);
                }
                if ( m.debugme && m._erels[kk] ) { this.l.info(`    - found erels entry ${this.name}:${m.name}.'${kk}' of `, m._erels[kk]); }


                // if ( m._schema[k] ) {} // ignore since handled in 'vars'

                if ( m._erels[kk] == WovModel.ER_ONE ) {            // forced singular
                  this._graphQL.objs.push([m.name, `${m.name}`]);
                }
                else if ( m._erels[kk] == WovModel.ER_MANY ) {      // forced plural
                  this._graphQL.objs.push([plural, `[${m.name}]`]);
                }
                else if ( m._erels[kk] == undefined ) {             // assumed plural
                  this._graphQL.objs.push([plural, `[${m.name}]`]);
                }
                else { this.l.info(`    - unknown erels entry 'kk:${kk}' 'k:${k}' of `, m, m._erels); }
              }
              // else { this.l.warn(`Unknown Ref '${this.name}.${k}'. Does not match to anything.`); }
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

    return retval;
  };


  /**
   * Inits each model, proceeding back through hierarchy, then builds params, going through hierarchy.
   *
   * @return {string} - GraphQL type definition for this Model
   */
  static getGraphQLSchema() {
    this.initGraphQLSchema();
    let mod = this;

    // this.l.info(`getGraphQLSchema: ${this.name}: `, mod._graphQL );

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
   * From an object with properties, build the col names and data for a query. If id is in _data, it is placed 1st.
   *
   * @param {object} _data - object to pull keys from (ex. this._data or this._dirty can be passed in)
   * @param {object} _vals - object to pull vals from, with key (ex. this._data passed in, or this.get())
   * @param {object} _qtype - query type 'create', 'insert' or 'update'
   * @return {object} - cols : columns in database, data : values for the cols, found : if found some tables (useful for 'dirty')
   */
  /*
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
  */

  // TODO: reload()


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
        throw Error(`Unknown type of Entity Relationship of '${_erel}'.`);
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
