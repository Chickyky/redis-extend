# Redis extend
Extend some function utility for redis client.
Somehow solve the problem expire field in hash/member in hash/set/sorted-set.

> example issue:
  issue since 2011 [Implement Expire on hash](https://github.com/redis/redis/issues/167)
  issue since 2013 [Allow to set an expiration on hash field](https://github.com/redis/redis/issues/1042)
  etc ...
# Features
Extend from [ioredis](https://www.npmjs.com/package/ioredis) then create new Redis client with all feature of [ioredis](https://www.npmjs.com/package/ioredis) and add some function helper like **hexpire/sexpire/zexpire/**...

# How does it work?
This package create mini job in background clear field/member expired of hash/set/sorted-set, find the exact next time to remove and use ***setTimeout*** function to schedule remove.
When remove expired field/member success, it will emit a event `expired`.

# Quick Start
## Install
```shell
$ npm install redis-extend
```
## Basic Usage
```javascript
const Redis = require('redis-extend');
const redis = new Redis('redis://localhost:6379');

redis.on('zexpired', (data) => {
  console.log(`\n**************
    --> [zexpired] data:`, data, `
****************\n`);
});

;(async () => {
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
})()

/* output like this:
  zResult= 1 score= 10 isZMember= 1
  isZMember= 0
  zmismember= [ 1, 0 ]
  zmismember= [ 1, 0 ]
  zmembers= [ 'one' ]
  zexpire= 1
  zpttl= 4996

  **************
    --> [zexpired] data: {
      type: 'zset',
      key: 'myzset',
      member: 'one',
      expiredAt: 1619853480176
    }
  ****************
*/
```

## Connect to Redis
When a new `Redis` instance is created,
a connection to Redis will be created at the same time.
You can specify which Redis to connect to by:

```javascript
new Redis(); // Connect to 127.0.0.1:6379
new Redis(6380); // 127.0.0.1:6380
new Redis(6379, "192.168.1.1"); // 192.168.1.1:6379
new Redis("/tmp/redis.sock");
new Redis({
  port: 6379, // Redis port
  host: "127.0.0.1", // Redis host
  family: 4, // 4 (IPv4) or 6 (IPv6)
  password: "auth",
  db: 0,
});
```

You can also specify connection options as a [`redis://` URL](http://www.iana.org/assignments/uri-schemes/prov/redis) or [`rediss://` URL](https://www.iana.org/assignments/uri-schemes/prov/rediss) when using [TLS encryption](#tls-options):

```javascript
// Connect to 127.0.0.1:6380, db 4, using password "authpassword":
new Redis("redis://:authpassword@127.0.0.1:6380/4");

// Username can also be passed via URI.
// It's worth to noticing that for compatibility reasons `allowUsernameInURI`
// need to be provided, otherwise the username part will be ignored.
new Redis(
  "redis://username:authpassword@127.0.0.1:6380/4?allowUsernameInURI=true"
);
```
See [API Documentation](https://github.com/luin/ioredis/blob/HEAD/API.md#new_Redis) for all available options.

## Extend function
> **returns a promise if the last argument isn't a function (no callback)**

### command(cmd, ...opts)
call a redis command with name and dynamic parameter.
```javascript
redis.command('GET', 'Chickyky', (err, value) => {
  console.log('command GET result=', value);
});
```

### hexpire(key,  field,  seconds[, callback]) <br> sexpire(key,  member,  seconds[, callback]) <br> zexpire(key,  member,  seconds[, callback])
set expire for field in hash/set/sorted-set key in seconds

### hpexpire(key,  field,  milliseconds[, callback]) <br> spexpire(key,  member,  milliseconds[, callback]) <br> zpexpire(key,  member,  milliseconds[, callback])
same as hexpire/sexpire/zexpire but expire in milliseconds

### zismember (key, member[, callback])
same [sismember](https://redis.io/commands/sismember), return *integer*:
-  `1`  if the element is a member of the set.
-  `0`  if the element is not a member of the set, or if  `key`  does not exist.

### zmismember (key, ...members[, callback])
same [smismember](https://redis.io/commands/smismember), list representing the membership of the given elements, in the same order as they are requested.
```javascript
  let zmismember = await redis.zmismember('myzset', 'one', 'two');
  console.log('zmismember=', zmismember);

  /* output:
    zmismember= [ 1, 0 ]
  */
```

### zmembers (key[, callback])
same [smembers](https://redis.io/commands/smembers), return all elements of the sorted-set.

### httl (key, field[, callback]) <br> sttl (key, member[, callback]) <br> zttl (key, member[, callback])
Return TTL (Time ti live) in seconds, or a negative value in order to signal an error, corresponding to *hash/set/sorted-set*.
-   returns  `-2`  if the key does not exist.
-   returns  `-1`  if the key exists but has no associated expire.


### hpttl (key, field[, callback])  <br> spttl (key, member[, callback]) <br> zpttl (key, member[, callback])
same httt/sttl/ztt/ but Return TTL  in milliseconds.

## Event
|Event| Description  |
|--|--|
|expired| Emit when one expired field/member was removed successful, include key expired by command `expire` |
|hexpired| Emit when a expired field in hash was removed successful|
|sexpired| Emit when a expired member in set was removed successful|
|zexpired| Emit when a expired member in sorted set was removed successful|
|keyspace| This is **Key-space notification**, read more [Redis Keyspace Notifications](https://redis.io/topics/notifications)|
|keyevent| This is **Key-event notification**, read more [Redis Keyspace Notifications](https://redis.io/topics/notifications) |

#### Data emit:
Event ***expired/hexpired/sexpired/zexpired***:
- type (hash/set/zset): type of key field/member expired.
- key: name of key expired.
- field/member (hash is `field` and set/zset is `member`): name of field/member expired.
- expiredAt (number): timestamp in unix.

Event ***keyevent***:
- channel: channel of notification
- db: database have notification
- event: name of event
- key: key name affected by event

Event ***keyspace***:
- channel: channel of notification
- db: database have notification
- command: name of command
- key: key name affected by command

> Example data of event:
```javascript
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

/* output
**************
--> [zexpired] data: {
  type: 'zset',
  key: 'myzset',
  member: 'one',
  expiredAt: 1619853480176
}
****************

**************
--> [keyevent] data: {
  channel: 'keyevent',
  db: 0,
  event: 'expired',
  key: '__redis-extend:ttl:zset:myzset:one'
}
****************
*/
```

