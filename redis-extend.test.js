const RedisExtend = require('./redis-extend');

const redis = new RedisExtend('redis://localhost:6379');

const HKEY = 'Test';
const HFIELD = 'chickyky';
const VALUE = 'vip_pro';

const SET_KEY = `SET_${HKEY}`;
const SORTED_SET_KEY = `SORTED_SET_${HKEY}`;

redis.on('expired', (data) => {
  console.log(`\n**************
    --> [expired] data:`, data, `
****************\n`);
});

redis.on('hexpired', (data) => {
  console.log(`\n**************
    --> [hexpired] data:`, data, `
****************\n`);
});

redis.on('zexpired', (data) => {
  console.log(`\n**************
    --> [zexpired] data:`, data, `
****************\n`);
});

redis.on('keyevent', (data) => {
  console.log(`\n**************
    --> [keyevent] data:`, data, `
****************\n`);
});

;(async () => {
  await redis.hset(HKEY, HFIELD, VALUE);
  await redis.hexpire(HKEY, HFIELD, 5);

  await redis.hset(HKEY, 'xxxxx', VALUE);
  await redis.hexpire(HKEY, 'xxxxx', 1);

  setTimeout(async _ => {
    let _field = `${HFIELD}_999`;

    await redis.hset(HKEY, _field, count);
    let res = await redis.hexpire(HKEY, _field, 5);

    console.log(`--> ${_field} res=`, res);
  }, 15e3)

  let count = 0;

  let interval = setInterval(async function () {
    count++;
    let _field = `${HFIELD}_${count}`;

    await redis.hset(HKEY, _field, count);
    let res = await redis.hexpire(HKEY, _field, 5);

    console.log(`--> res=`, res);

    if (count >= 5) clearInterval(interval);
  }, 1e3);

  let zResult = await redis.zadd('myzset', 10, 'one');
  let score = await redis.zscore('myzset', 'one');
  let isZMember = await redis.zismember('myzset', 'one');

  console.log('zResult=', zResult, 'score=', score, 'isZMember=', isZMember);

  isZMember = await redis.zismember('myzset', 'two');
  console.log('isZMember=', isZMember);

  let zmismember = await redis.zmismember('myzset', 'one', 'two');
  console.log('zmismember=', zmismember);

  zmismember = await redis.zmismember('myzset', ['one', 'two']);
  console.log('zmismember=', zmismember);

  let zmembers = await redis.zmembers('myzset');
  console.log('zmembers=', zmembers);

  let zexpire = await redis.zexpire('myzset', 'one', 5);
  console.log('zexpire=', zexpire);

  let zpttl = await redis.zpttl('myzset', 'one');
  console.log('zpttl=', zpttl);

  await redis.command('SET', 'Chickyky', 'vip pro');

  redis.command('GET', 'Chickyky', (err, result) => {
    console.log('command GET result=', result);
  });

  redis.command('GETXXX', 'Chickyky', (err, result) => {
    console.log('command GET err=', err, result);
  });
})();

/* output:
  zResult= 1 score= 10 isZMember= 1
  isZMember= 0
  zmismember= [ 1, 0 ]
  zmismember= [ 1, 0 ]
  zmembers= [ 'one' ]
  zexpire= 1
  zpttl= 4996

  **************
    --> [zexpired] data: { type: 'zset', key: 'myzset', member: 'one' }
****************
*/








