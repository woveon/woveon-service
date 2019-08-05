const Service = require('../src/index');
const ML      = require('../src/modelloader');
const expect  = require('chai').expect;

let logger    = new Service.Logger('logger', {debug : true});

describe('model loader test', async function() {

  it('loading models', async function() {
    let models = new ML(__dirname, 'testmodels/*.js', logger);
    logger.info('models.testmodels       : ', models.testmodels);
    logger.info('models.testmodels.m1 is : ', models.testmodels.m1);
    expect(models.testmodels).to.not.equal(null);
    expect(models.testmodels.m1).to.not.equal(null);
    expect(models.testmodels.m2).to.not.equal(null);
    expect(models.testmodels.m1.name).to.equal('m1');
    expect(models.testmodels.m2.name).to.equal('m2');

    let nodir  = new ML(__dirname, 'nodir/*.js', logger);
    logger.info('nodir : ', nodir.nodir);
    expect(nodir.nodir).to.equal(undefined);

    let models2 = new ML(__dirname, 'testmodels2/**/*.js', logger);
    logger.info('models2.testroutes       : ', models2.testmodels2);
    expect(models2.testmodels2).to.not.equal(null);
    expect(models2.testmodels2.a).to.not.equal(null);
    expect(models2.testmodels2.a.aa).to.not.equal(null);
    expect(models2.testmodels2.b).to.not.equal(null);
  });
});


