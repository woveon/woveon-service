
const addContext = require('mochawesome/addContext');
const expect    = require('chai').expect;
const Logger    = require('woveon-logger');
const Service   = require('../src/index');
const C         = require('woveon-service').Config;

let mtag ='10_mongo';

let logger = new Logger(mtag, {
  debug    : true,
  showName : true,
  level    : 'info',
  color    : 'inverse',
}, {
  titles : false,
});

let userSchema = Service.WovDBMongo.Mongoose.Schema({firstName : String, lastName  : String});

describe(`> ${mtag}: `, async function() {
  let testdb = null;

  // setup the service
  before(async function() {
    this.timeout(3000);

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
        .then(function(d) { logger.info('then: ', d); created=d; })
        .catch(function(e) { logger.throwError(e); } );
      addContext(this, {title : 'Created result', value : created});

      let ruser = await User.findOne({_id : user._id});

      addContext(this, {title : 'Read result', value : ruser});
      expect(ruser.toString()).to.deep.equal(created.toString());

    });
  });
});
