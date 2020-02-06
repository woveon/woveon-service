/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

/**
 * @typedef WovClientLocal
 * @typedef WovClientRemote
 * @typedef WovModel
 * @typedef WovRemoteServiceClient
 * @typedef WovEntityClient
 * @typedef WovEntityModel
 * @typedef WovStateLayer
 * @typedef Logger
 * @typedef Listener
 */

// const Logger               = require('woveon-logger');
const WovClientLocal   = require('./wovclientlocal');
const WovClientRemote  = require('./wovclientremote');
const Logger           = require('woveon-logger');
const entity           = require('./entity');

const {ApolloServer}    = require('apollo-server-express');
const requireFromString = require('require-from-string');


/**
 * The State Layer manages models (which manage Entity CRUD) and connects to remote services
 * to interact with remote Entities.
 */
module.exports = class WovStateLayer {

  l        = null; // the loggr object
  _clients = null; // the array of WovEntity Clients this layer has
  _models  = null; // the hash (by lowercase model name) of WovModels this state layer serves (added from clients)
  _rs      = {}; // GraphQL Remote Server for all local clients


  /**
   * Constructor.
   *
   * @param {Logger} _l -
   * @param {Array<WovEntityClient>} _woventityclients -
   */
  constructor(_l, _woventityclients) {
    this.l = _l;
    this._clients = _woventityclients;
    this._models  = {};
    this._inited = false;

    // build models into this
    for (let i=0; i<this._clients.length; i++ ) {
      let c = this._clients[i];

      // add to the state layer and check for a few errors
      for (let k in c._models) {
        let m = c._models[k];
        if ( m == null ) throw Error(`Model of index 'k' is null?`);
        if ( this._models[m.name.toLowerCase()] != undefined ) {
          throw Error(`Model named '${m.name}' of index '${k}' already exists in state layer.`);
        }
        this._models[m.name.toLowerCase()] = m;
        this[m.name] = m;
      }
    }
  };


  /**
   * Simple check if this has been inited.
   *
   * @return {boolean} -
   */
  isInited() { return this._inited; }


  /**
   * Any async calls to set up the layer.
   *
   * @param {object} _lcl_i - local client init values
   * @return {WovStateLayer} - returns itself ex. new WovStateLayer(...).init()
   */
  async init(_lcl_i = {}) {

    // this.l.h2().info('Statelayer init');

    // local client init
    let lcl_i = Object.assign({}, {drop : false, table : true, view : true}, _lcl_i);

    // this.l.info('WovStateLayer init called');
    for (let i=0; i<this._clients.length; i++ ) {
      let c = this._clients[i];
      // this.l.info('init client ', c);
      if ( c instanceof WovClientLocal ) {
        await c.init(this, lcl_i.drop, lcl_i.table, lcl_i.view);
      }
      else if ( c instanceof WovClientRemote) {
        await c.init(this);
      }
      else {
        this.l.error('Unknown client to init in state layer : ', c);
      }

    }
    this._inited = true;
    return this;
  }


  /**
   * Returns the model of the given name.
   *
   * @param {string} _n - model name
   * @return {WovModel} -
   */
  getModel(_n) {
    let retval = this._models[_n.toLowerCase()];
    // Logger.g().info(`getModel ${_n} of models: `, Object.keys(this._models));
    return retval;
  }


  /**
   * Call on each client.
   *
   * @return {string} - all schemas
   */
  /*
  getGraphQLSchemas() {
    let retval = {
      queries   : '',   // query definitions ex. getX(id : ID!) : X
      mutations : '',   // mutations. ex. createX(xToCreate : iCreateX!) : X
      query_t   : '',   // query/mutation types for mutations and create/update. ex. iCreateX { foo : String! }
      schemas   : '',   //
    };

    for (let i=0; i<this._clients.length; i++) {
      let cl = this._clients[i];
      let result = cl.getGraphQLSchemas();
      this.l.info('State layer client scheam: ', result);
      retval.queries   += result.queries;
      retval.mutations += result.mutations;
      retval.query_t   += result.query_t;
      retval.schemas   += result.schemas;
    }

    return retval;
  }
  */


  /**
   * Call on each client.
   *
   * @return {object} - {modeljs:,exportsjs:}
   */
  /*
  getGraphQLResolvers() {
    let retval = {
      queryjs    : '',   // query implementations
      mutationjs : '',   // mutation implementations
      modeljs    : '',   // data relationships of models (ex. const Car = { tires : async function(...) {...}}, )
      exportsjs  : '',   // the models to export ex. "X, Y"
    };

    for (let i=0; i<this._clients.length; i++) {
      let cl     = this._clients[i];
      let result = cl.getGraphQLResolvers();
      retval.queryjs    += result.queryjs;
      retval.mutationjs += result.mutationjs;
      retval.modeljs    += result.modeljs;
      retval.exportsjs  += result.exportsjs;
    }


     this.gqlrs= new ApolloServer({
        typeDefs  : gqlschema,
        resolvers : requireFromString(gqlresolvers), // requirefromstring to turn into code
        context   : ({req}) => {
          let retval = {
            httpVersionMajor : req.httpVersionMajor,
            httpVersionMinor : req.httpVersionMinor,
            httpVersion      : req.httpVersion,
            headers          : req.headers,
            rawHeaders       : req.rawHeaders,
            originalUrl      : req.originalUrl,
            args             : Object.assign({}, req.wov, req.params, req.query, req.body),
          };
          return retval;
        },
        dataSources    : () => ({sl : this.statelayer}),  // (State Layer)
        formatError    : (error) => { Logger.g().error(JSON.stringify(error, null, 2)); return error; },
        formatResponse : (_response, {context}) => {
          Logger.g().aspect('listener.incoming', `Handled  : '${context.originalUrl}' with prot GraphQL: '${context.args.query}'`,
            _response.data);
          let retval = _response;
          return retval;
        },
      });

    return retval;
  }
      */


  // =====================================================================
  // ---------------------------------------------------------------------
  // Servers
  // ---------------------------------------------------------------------


  /**
   * The 'pub' server exposes functionality to the world.
   *
   * NOTE: it does not send ids by default, using xid instead.
   *
   * This is a Helper function to call _initServer, creating the 'pub' server..
   *
   * @param {Listener} _listener - listener to listen on. generally, the microservice's listener.
   * @param {string} _endpoint_ext - MACHINE:PORT/ROOT/pubENDPOINT_EXT, where the default is /graphql
   * @param {object} _schemaadditions - additional GraphQL schema additions
   * @param {object} _resolveradditions - object with code to add resolvers : {Query : , Mutation : , ...}
   * @param {object} _options - additional options
   * @return {undefined} -
   */
  async initPubServer(_listener, _endpoint_ext, _schemaadditions = {}, _resolveradditions = {}, _options = {}) {
    let options = Object.assign({
      additionalDataSources : {},
      usedefaultschemas     : false,
      usedefaultresolvers   : false,
      external              : true,
    }, _options);
    return this._initServer('pub', _listener, _endpoint_ext, _schemaadditions, _resolveradditions, options);
  }


  /**
   * The 'prot' server serves models on WovLocalClients (i.e. models it owns) to other microservices in the
   * system and SHOULD NOT BE EXPOSED TO THE WORLD (except for testing/dev).
   *
   * This is a Helper function to call _initServer, creating the 'prot' server..
   *
   * @param {Listener} _listener - listener to listen on. generally, the microservice's listener.
   * @param {string} _endpoint_ext - MACHINE:PORT/ROOT/pubENDPOINT_EXT, where the default is /graphql
   * @param {object} _schemaadditions - additional GraphQL schema additions
   * @param {object} _resolveradditions - object with code to add resolvers : {Query : , Mutation : , ...}
   * @param {object} _options - additional options
   * @return {undefined} -
   */
  async initProtServer(_listener, _endpoint_ext = '/graphql', _schemaadditions = {}, _resolveradditions = {}, _options = {}) {
    let options = Object.assign({
      additionalDataSources : {},
    }, _options);
    this._initServer('prot', _listener, _endpoint_ext, _schemaadditions, _resolveradditions, options);
  }


  /**
   * Initializes the Models Server on the given listener at path _listener.root/models/graphql.
   *
   * The Models Server is how a microservice externalizes its local models to the system for basic
   * crud operations.
   *
   * @param {string} _name - The name/type of the server, used to set the route.
   * @param {Listener} _listener - listener to listen on. generally, the microservice's listener.
   * @param {string} _endpoint_ext - MACHINE:PORT/ROOT/pubENDPOINT_EXT, where the default is /graphql
   * @param {object} _schemaadditions - additional GraphQL schema additions
   * @param {object} _resolveradditions - object with CODE to add resolvers : {Query : , Mutation : , ...}
   * @param {object} _options - additional optional options
   * @return {undefined} -
   */
  async _initServer(_name, _listener, _endpoint_ext = '/graphql', _schemaadditions = {}, _resolveradditions = {}, _options = {}) {
    // this.l.info(`_initServer ${_name}`);
    let servercfgstrings = {schemas : entity.getBlankServerConfig_Schemas(), resolvers : entity.getBlankServerConfig_Resolvers()};
    let options = Object.assign({
      usedefaultschemas     : true,
      usedefaultresolvers   : true,
      external              : false,
      additionalDataSources : {},
    }, _options);
    // this.l.info(`_initServer ${_name} - options`, options);

    // add in passed in at top
    Object.assign(servercfgstrings.schemas, _schemaadditions);

    if ( options.usedefaultschemas == true ) {
      servercfgstrings.schemas = entity.mergeServerConfigStrings_Schemas([
        servercfgstrings.schemas,
        entity.mergeServerConfigStrings_Schemas(this._clients.map( (_cl)=>{ return _cl.getGraphQLSchemas({external : options.external}); })),
      ]);
    }
    if ( options.usedefaultresolvers == true ) {
      servercfgstrings.resolvers = entity.mergeServerConfigStrings_Resolvers([
        servercfgstrings.resolvers,
        entity.mergeServerConfigStrings_Resolvers(this._clients.map( (_cl)=>{
          let retval = '';
          try { retval = _cl.getGraphQLResolvers({external : options.external}); }
          catch (e) { this.l.info('retval err: ', e); }
          // this.l.info('retval: ', retval);
          return retval;
        })),
      ]);
    }

      /*
    for (let i=0; i<this._clients.length; i++) {
      let cl     = this._clients[i];
      if ( cl instanceof WovClientLocal ) {
        if ( options.usedefaultschemas == true ) {
          entity.mergeServerConfigStrings_Schemas([servercfgstrings.schemas, cl.getGraphQLSchemas());
        }
        if ( options.usedefaultresolvers == true ) {
          entity.mergeServerConfigStrings_Resolvers(servercfgstrings.resolvers, cl.getGraphQLResolvers());
        }
      }
    }
    */

    // this.l.info('init server, ', options);
    /*
    if ( options.external == true ) {
      this.l.h3().info('schemas   : ', servercfgstrings.schemas);
      this.l.h3().info('resolvers : ', servercfgstrings.resolvers);
    }
    */
    // resolvers = requireFromString(resolvers);
    // resolvers = Object.assign(resolvers, _resolveradditions);
    // this.l.h3().info('buildGraphQLServer_Resolvers');
    let resolvercode = requireFromString(WovStateLayer.buildGraphQLServer_Resolvers(servercfgstrings.resolvers));
    // this.l.h3().info('mergeServerConfigCode_Resolvers');
    entity.mergeServerConfigCode_Resolvers(resolvercode, _resolveradditions);
    // this.l.h3().info('resolvers2 : ', resolvercode);

    // if ( _name == 'pub' ) this.l.h3().info('Pub Resolvers : ', resolvercode);

    // this.l.info('start apolo server with ', _name);
    // Start GraphQL server for the Remote Server
    // NOTE: creates a schema text file, and a resolver code object
    this._rs[_name] = new ApolloServer({
      typeDefs  : WovStateLayer.buildGraphQLServer_Schemas(servercfgstrings.schemas),
      // 'type Query { greeting : String }', // WovStateLayer.buildGraphQLServer_Schemas(servercfgstrings.schemas),
      resolvers : resolvercode,
      context   : ({req}) => {  // eslint-disable-line key-spacing
        let retval = {
          httpVersionMajor : req.httpVersionMajor,
          httpVersionMinor : req.httpVersionMinor,
          httpVersion      : req.httpVersion,
          headers          : req.headers,
          rawHeaders       : req.rawHeaders,
          originalUrl      : req.originalUrl,
          args             : Object.assign({}, req.wov, req.params, req.query, req.body),
        };
        return retval;
      },
      dataSources : () => (Object.assign({}, {statelayer : this}, options.additionalDataSources)),  // (State Layer)
      formatError : function(error) {
        Logger.g().error(JSON.stringify(error, null, 2));
        return error;
      },
      formatResponse : (_response, {context}) => {
        // Logger.g().info('response:', _response);
        // Logger.g().info('context:', context); // JSON.stringify(context, null, 2));
        Logger.g().aspect('listener.incoming', `Handled  : '${context.originalUrl}' with prot GraphQL: '${context.args.query}'`);
        Logger.g().aspect('listener.incoming', `    args : {\n`,
          Object.keys(context.args).map((k)=>{ if ( k != 'query' ) return `${k} : ${JSON.stringify(context.args[k], null, 2)},`; }), '}\n');

        Logger.g().aspect('listener.result', `Response: `, JSON.stringify(_response, null, 2));
        // let retval = _response.flatten(true, false, false, true);
        // return retval;
        return _response;
      },
    });

    // this.l.info('_listener root : ', _listener.root);
    this._rs[_name].applyMiddleware({app : _listener.app, path : `${_listener.root}/${_name}${_endpoint_ext}`});
    // this.l.info(`... loaded StateLayer '${_name}' server as GraphQL at route: '${this._rs[_name].graphqlPath}'`);
  }


  /**
   * Given an entity.getBlankServerConfig_Schema() object (build from custom and LocalClient model data), write a
   * GraphQL server schema.
   *
   * @param {object} _schemastrings - a entity.getBlankServerConfig_Schema() object
   * @return {string} -
   */
  static buildGraphQLServer_Schemas(_schemastrings) {
    let retval = `

  scalar JSON
  `;

    if ( _schemastrings.queries != '' ) {
      retval += `

  # ---------------------------------------------------------------------
  # Query Definitions
  # ---------------------------------------------------------------------
  type Query {
  ${_schemastrings.queries}
  }
  `;
    }

    if ( _schemastrings.mutations != '' ) {
      retval += `

# ---------------------------------------------------------------------
# Mutation Definitions
# ---------------------------------------------------------------------
type Mutation {
  ${_schemastrings.mutations}
}
`;
    }

    if ( _schemastrings.query_t != '' ) {
      retval += `

  # ---------------------------------------------------------------------
  # Query Input Types
  # ---------------------------------------------------------------------
  ${_schemastrings.query_t}
  `;
    }


      retval += `
  # ---------------------------------------------------------------------
  # Schemas
  # ---------------------------------------------------------------------
  type deletedID   { id : ID }         # internal id
  type deletedXID  { xid : String }    # external id (xid, as a uuid)
  ${_schemastrings.schemas}

  `;

    // Logger.g().info('buildGraphQLServer_Schemas : ', retval);

    return retval;
  }


  /**
   * Given an entity.getBlankServerConfig_Resolver() object (build from custom and LocalClient model data), write a
   * javascript for a server resolver.
   *
   * @param {object} _resolverstrings - a entity.getBlankServerConfig_Resolver() object
   * @return {string} -
   */
  static buildGraphQLServer_Resolvers(_resolverstrings) {

    // Logger.g().info('  _resolverstrings ', _resolverstrings);
    let ex = '';
    let retval = `

// import GraphQLJSON from 'graphql-type-json';
const GraphQLJSON = require('graphql-type-json');
const Logger      = require('woveon-logger');
`;

    if ( _resolverstrings.queryjs != '' ) {
      retval += `

// ---------------------------------------------------------------------
// Query Implementations
// ---------------------------------------------------------------------
const Query = {
${_resolverstrings.queryjs}
};
`;
      if ( ex != '' ) ex += ', '; ex += 'Query';
    }

    if ( _resolverstrings.mutationjs != '' ) {
      retval += `

// ---------------------------------------------------------------------
// Mutation Implementations
// ---------------------------------------------------------------------
const Mutation = {
${_resolverstrings.mutationjs}
};
`;
      if ( ex != '' ) ex += ', '; ex += 'Mutation';
    }

    if ( _resolverstrings.modeljs != '' ) {
      retval += `

// ---------------------------------------------------------------------
// Model Implementations
// ---------------------------------------------------------------------
${_resolverstrings.modeljs}
`;
    }

    if ( ex != '' ) ex += ', ';
    retval += `
module.exports = {${ex} ${_resolverstrings.exportsjs} JSON : GraphQLJSON};
`;

    // Logger.g().info('buildGraphQLServer_Resolvers : ', retval);

    return retval;
  }


  // ---------------------------------------------------------------------
  // end Servers
  // ---------------------------------------------------------------------
  // =====================================================================

};
