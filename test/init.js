
// This file creates the Config object for all test cases
const C      = require('../src/config');
const Logger = require('woveon-logger');
const Pg     = require('pg').Client;


if ( ! C.isInited() ) {
  let logger = new Logger('config', {debug : true, showName : true, dbCharLen : 40, color : 'bgBlue white'}, {});
  // logger.info('INITING in init.js');

  // Set up config
  new C(logger, [
    'WOV_apidb_username',     // ex. 'postgres'
    'WOV_apidb_host',         // 'localhost' for ssh tunneling, AWS db for pod
    'WOV_apidb_database',     // 'woveon' is default
    'WOV_apidb_port',         // ssh tunneling port, or postgres default port 5432
    'WOV_apidb_type',         // postgres, mongo, etc.
  ],
    ['WOV_apidb_password']);  // random: try `openssl rand -hex 40`

  // Set up a database connection
  const dbconf = {
    user     : C.get('WOV_apidb_username'),
    host     : C.get('WOV_apidb_host'),
    database : C.get('WOV_apidb_database'),
    port     : C.get('WOV_apidb_port'),
    password : C.sget('WOV_apidb_password'),
  };
  C.setData('db', new Pg(dbconf));
  // C.displayMe();
}
