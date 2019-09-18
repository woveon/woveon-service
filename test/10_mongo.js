
const addContext = require('mochawesome/addContext');
const expect     = require('chai').expect;
const Logger     = require('woveon-logger');

let mtag ='10_mongo';

let logger = new Logger(mtag, {
  debug    : true,
  showName : true,
  level    : 'info',
  color    : 'inverse',
}, {
  titles : false,
});


describe(`> ${mtag}: `, async function() {
  let testdb = null;
  const Service    = require('../src/index');
  let userSchema = Service.WovDBMongo.Mongoose.Schema({firstName : String, lastName  : String});
  Service.Config.staticconfig=1;
  let clogger = new Logger('config', {debug : true, showName : true, dbCharLen : 40, color : 'bgBlue white'}, {});
  new Service.Config(clogger, [
    'WOV_testdb_type',         // postgres, mongo, etc.
    'WOV_testdb_username',     // ex. 'postgres'
    'WOV_testdb_endpoint',     // 'localhost' for ssh tunneling, AWS db for pod
    'WOV_testdb_database',     // 'woveon' is default
    'WOV_testdb_port',         // ssh tunneling port, or postgres default port 5432
  ],
    ['WOV_testdb_password'], {blankenvvars : false});
  const C = Service.Config;

  // setup the service
  before(async function() {
    this.timeout(3000);


    // logger.info('waiting for config: ', C);
    // await C.blockForInit();
    // logger.info('Showing config', C);
    // logger.info('Showing config', await C.staticpromise);
    // C.displayMe();
    testdb = new Service.WovDBMongo('testdb', logger);
    await testdb.connect();
    C.setData('db', testdb);
  });

  describe('> Mongo tests', async function() {

    it(`> Create and Read test with Mongoose Model: ${__fileloc}`, async function() {
      let User = testdb.connection.model('User', userSchema);
      let user = new User({_id : new Service.WovDBMongo.Mongoose.Types.ObjectId(), firstName : 'Jamie', lastName : 'Munro'});

      let created = null;
      await user.save()
        .then(function(d) { /* logger.info('then: ', d); */ created=d; })
        .catch(function(e) { logger.throwError(e); } );
      addContext(this, {title : 'Created result', value : created});

      let ruser = await User.findOne({_id : user._id});

      addContext(this, {title : 'Read result', value : ruser});
      expect(ruser.toString()).to.deep.equal(created.toString());

    });
  });
});
