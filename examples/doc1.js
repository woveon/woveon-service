
const Service = require('../../woveon-service');
const {DocPath, DocMethod, DocParam} = Service.Listener;
const Logger  = require('woveon-logger');
const cors    = require('cors');


const logger = new Logger('glob',
  {debug : true, level : 'verbose'},
  {
    'listener.route'    : true,
    'listener.incoming' : true,
    'listener.result'   : true,
  });


/**
 */
class MyListener extends Service.Listener {

  /**
   */
  async init() {
    await super.init();

    this.app.options('/*', cors({method : '\'GET\', \'PUT\', \'POST\', \'OPTIONS\''}));

    logger.info('...my init');


    this.onGet('/foo/bar', async (_args, _res) => {
      return this.retSuccess(true);
    }, __filename, new DocMethod({
      summary   : 'bar',
      responses : {'200' : 'true'},
    }).options);

    this.onPost('/health2', async (_args, _res) => {
      return this.retSuccess(true);
    }, __filename);

    this.onPost('/health', async (_args, _res) => {
      return this.retSuccess(true);
    }, __filename);

    this.onGet('/health', async (_args, _res) => {
      return this.retSuccess(true);
    }, __filename);

    this.onDoc('/health', new DocPath({
      summary : 'Health check route.',
      desc    : 'Useful for heartbeat checks',
      methods : {
        get : new DocMethod({
          summary   : 'Returns true always.',
          desc      : null,
          docs      : [],
          params    : [new DocParam({name : 't', desc : 'Desc'}).options],
          responses : {'200' : {desc : 'true'}},
        }).options,
      },
      params : {},
    }).options);

    this.onPut('/health', async (_args, _res) => {
      return this.retSuccess(true);
    }, __filename);

    /*
    this.onDoc('/foo', {name : 'foo'}, __filename);
    */
  }


  /**
   * Returns string of this.
   * @return {string} -
   */
  toString() {return this.options;}

};

(async function() {
  logger.info('here');

  const l = new MyListener(9232, logger);
  await l.init();
  await l.listen();

})();
