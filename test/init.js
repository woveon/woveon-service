
// This file creates the Config object for all test cases
const C      = require('../src/config');
const Logger = require('woveon-logger');
const Pg     = require('pg').Client;


if ( ! C.isInited() ) {
  let logger = new Logger('config', {debug : true, showName : true, dbCharLen : 40, color : 'bgBlue white'}, {});
  // logger.info('INITING in init.js');

  // ********************************************************************* 
  // ********************************************************************* 
  // ***** NOTE: use `make pg-start` to start the postgres-local database
  // ********************************************************************* 
  // ********************************************************************* 

  // Set up config
  new C(logger, [
    'WOV_testdb_type',         // postgres, mongo, etc.
    'WOV_testdb_username',     // ex. 'postgres'
    'WOV_testdb_endpoint',     // 'localhost' for ssh tunneling, AWS db for pod
    'WOV_testdb_database',     // 'woveon' is default
    'WOV_testdb_port',         // ssh tunneling port, or postgres default port 5432
  ],
    ['WOV_testdb_password']);  // random: try `openssl rand -hex 40`

  // Set up a database connection
  /*
  const dbconf = {
    user     : C.get('WOV_testdb_username'),
    host     : C.get('WOV_testdb_host'),
    database : C.get('WOV_testdb_database'),
    port     : C.get('WOV_testdb_port'),
    password : C.gET('WOV_testdb_password'),
  };
  C.setData('db', new Pg(dbconf));
  */
  C.displayMe();
}
