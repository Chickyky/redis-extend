const Redis = require('ioredis');
const async = require('async');
const debug = require('debug');
const { promisify } = require('util');

const PKG_SORTED_SET = '__redis-extend';
const TYPE = {
  HASH: 'hash',
  SET: 'set',
  SORTED_SET: 'zset'
}
const EACH_LIMIT = 10;

const EVENT_EXPIRED = 'expired';

const EVENT_HEXPIRED = 'hexpired';
const EVENT_SEXPIRED = 'sexpired';
const EVENT_ZEXPIRED = 'zexpired';

const EVENT_KEYSPACE = 'keyspace';
const EVENT_KEYEVENT = 'keyevent';

const PATTERN_NOTIFICATION = '__key*__:*';
const SET_NOTIFY_EVENT = 'KEA';

const noop = () => {}

function parseChunk (chunk) {
  let [keyName, value] = chunk;
  let [type, key, ...field] = keyName.split(':');

  value = Number(value);
  field = field.join(':');

  return {
    zMemberName: keyName,
    type,
    key,
    field,
    value
  }
}

function toChunk(myArray, chunk_size) {
  let results = [];

  while (myArray.length) {
    results.push(myArray.splice(0, chunk_size));
  }

  return results;
}

const convertToGMT0 = (date) => {
  let tzOffset = date.getTimezoneOffset(); // minute

  return date.getTime() + (tzOffset * 60 * 1e3);
}

async function addExpire(type, key, field, seconds, callback, isUseMilliseconds) {
  const now = new Date();
  const after = isUseMilliseconds ? seconds : seconds * 1e3;
  const expiredAt = convertToGMT0(now) + after;
  const zkey = this.expireKey(type, key, field);
  const res = await this.zadd(this.bucket, expiredAt, zkey);

  if (this.nextRemoveAt > expiredAt) {
    this.stopRunExpire();
  }

  // set ttl
  const keyTTL = this.keyTTL(type, key, field);
  await this.setex(keyTTL, seconds, 1);

  this.runExpire();

  return callback ? callback(null, 1) : 1;
}

function parseMessage (str, msg) {
  // __keyspace@0__:__redis-extend
  // __keyevent@0__:del

  let [channel, rest] = str.split('@');
  channel = channel.replace(/\_/g, '');

  let [db, key] = rest.split(':');
  db = db.replace(/\_/g, '');
  db = Number(db);
  key = key.replace(/\_/g, '');

  let result = {
    channel,
    db,
    [channel === 'keyspace' ? 'key' : 'event']: key,
    [channel === 'keyspace' ? 'command' : 'key']: msg,
  }

  return result;
}

class RedisExtend extends Redis {
  constructor (...opts) {
    super();

    this.bucket = `${PKG_SORTED_SET}`;
    this.log = debug('redis-extend');
    this.logPubsub = this.log.extend('message');
    this.fnTimeOutExpire = null;
    this.isRunning = false;
    this.nextRemoveAt = -1;

    // listen notification from redis
    this.clientPubsub = new Redis(opts);
    this.clientPubsub.config('set', 'notify-keyspace-events', SET_NOTIFY_EVENT);

    this.clientPubsub.psubscribe('__key*__:*', (err, count) => {
      if (!err) {
        this.log('registered listen to event with pattern `%s` successful', PATTERN_NOTIFICATION);
        this.log('already have %d psubscribe with pattern `%s`', count, PATTERN_NOTIFICATION);
      }
    });

    this.clientPubsub.on('pmessage', (pattern, channel, message) => {
      const parse = parseMessage(channel, message);
      this.logPubsub('on pmessage: %o', parse);

      const { key, event } = parse;
      ({ channel } = parse);

      switch (channel) {
        case 'keyspace':
          this.emit(EVENT_KEYSPACE, parse);
          break;

        case 'keyevent':
          this.emit(EVENT_KEYEVENT, parse);

          if (event === EVENT_EXPIRED) {
            this.emit(EVENT_EXPIRED, parse);
          }

          break;
      }
    });

    // run background first
    this.runExpire(true);
  }

  expireKey (type, key, field) {
    return `${type}:${key}:${field}`;
  }

  keyTTL (type, key, field) {
    return `${this.bucket}:ttl:${type}:${key}:${field}`;
  }

  command (cmd, ...opts) {
    cmd = cmd.toLowerCase();

    const redisFunc = this[cmd];

    const isUseCallback = typeof opts[opts.length - 1] === 'function';
    const cb = isUseCallback
      ? opts[opts.length - 1]
      : function (err, result) {

      }

    if (!redisFunc) {
      const errorCmdNotFound = new Error('ECMDNOTFOUND Redis command not found');

      if (isUseCallback) {
        return cb(errorCmdNotFound);
      }

      return Promise.reject(errorCmdNotFound);
    }

    return redisFunc.apply(this, opts);
  };

  async runExpire (isFirstRun) {
    const self = this;

    if (self.isRunning) {
      self.log('job is running ...');
      return;
    }

    self.isRunning = true;
    let now = convertToGMT0(new Date());

    await self.clearExpired();

    const msNext = await self.getMsNextClear();

    // prepare for next run
    self.isRunning = false;

    if (msNext !== null) {
      const time = Math.max(msNext - now, 0);
      self.log('next run clear expired-key after: %d ms', time);

      self.nextRemoveAt = msNext;
      self.fnTimeOutExpire = setTimeout(self.runExpire.bind(self), time);
    } else {
      clearTimeout(self.fnTimeOutExpire);
      self.fnTimeOutExpire = null;
    }
  }

  stopRunExpire () {
    clearTimeout(this.fnTimeOutExpire);
    this.fnTimeOutExpire = null;
    this.isRunning = false;
    this.nextRemoveAt = -1;
    this.log('stop run clear expired-key done, wait new round!');
  }

  async getMsNextClear () {
    let chunk = await this.zrangebyscore(this.bucket, 0, '+inf', 'WITHSCORES', 'LIMIT', 0, 1);

    if (!chunk || !chunk.length) return null;

    const { value } = parseChunk(chunk);
    return value;
  }

  async clearExpired (ms) {
    ms = ms || convertToGMT0(new Date());
    let listExpire = await this.zrangebyscore(this.bucket, 0, ms, 'WITHSCORES');
    listExpire = toChunk(listExpire, 2);

    await async.eachLimit(listExpire, EACH_LIMIT, this.removeOneChunk.bind(this));
  }

  async removeOneChunk (chunk) {
    const { type, key, field, zMemberName, value } = parseChunk(chunk);

    let result = null;

    switch (type) {
      case TYPE.HASH:
        result = await this.hdel(key, field);
        break;

      case TYPE.SET:
        result = await this.srem(key, field);
        break;

      case TYPE.SORTED_SET:
        result = await this.zrem(key, field);
        break;
    }

    // emit when key existed and remove successfully
    if (result) {
      await this.zrem(this.bucket, zMemberName);

      const dataExpired = {
        type,
        key,
        [type === TYPE.HASH ? 'field' : 'member']: field,
        expiredAt: value
      };

      switch (type) {
        case TYPE.HASH:
          this.emit(EVENT_HEXPIRED, dataExpired);
          break;

        case TYPE.SET:
          this.emit(EVENT_SEXPIRED, dataExpired);
          break;

        case TYPE.SORTED_SET:
          this.emit(EVENT_ZEXPIRED, dataExpired);
          break;
      }

      this.emit(EVENT_EXPIRED, dataExpired);
      this.log(`remove %s : %s : %s done.`, type, key, field);
    }
  }

  async hexpire (key, field, seconds, callback) {
    let exists = await this.hexists(key, field);

    if (!exists) {
      return callback ? callback(null, exists) : exists;
    }

    return addExpire.call(this, TYPE.HASH, key, field, seconds, callback);
  }

  async hpexpire (key, field, milliseconds, callback) {
    let exists = await this.hexists(key, field);

    if (!exists) {
      return callback ? callback(null, exists) : exists;
    }

    return addExpire.call(this, TYPE.HASH, key, field, milliseconds, callback, true);
  }

  async sexpire (key, member, seconds, callback) {
    let exists = await this.sismember(key, member);

    if (!exists) {
      return callback ? callback(null, exists) : exists;
    }

    return addExpire.call(this, TYPE.SET, key, member, seconds, callback);
  }

  async spexpire (key, member, milliseconds, callback) {
    let exists = await this.sismember(key, member);

    if (!exists) {
      return callback ? callback(null, exists) : exists;
    }

    return addExpire.call(this, TYPE.SET, key, member, milliseconds, callback, true);
  }

  async zexpire (key, member, seconds, callback) {
    let exists = await this.zismember(key, member);

    if (!exists) {
      return callback ? callback(null, exists) : exists;
    }

    return addExpire.call(this, TYPE.SORTED_SET, key, member, seconds, callback);
  }

  async zpexpire (key, member, milliseconds, callback) {
    let exists = await this.zismember(key, member);

    if (!exists) {
      return callback ? callback(null, exists) : exists;
    }

    return addExpire.call(this, TYPE.SORTED_SET, key, member, milliseconds, callback, true);
  }

  async zismember (key, member, callback) {
    let score = await this.zscore(key, member);
    let isMember = score === null ? 0 : 1;

    return callback ? callback(null, isMember) : isMember;
  }

  async zmismember (key, ...members) {
    const self = this;
    let isUseCallback = false;
    let fnCb = null;

    if (typeof members[members.length - 1] === 'function') {
      fnCb = members[members.length - 1];
      members = members.slice(0, members.length -1 );
      isUseCallback = true;
    }

    if (Array.isArray(members[0])) {
      members = members[0];
    }

    return async.map(members, async (member) => {
      return self.zismember(key, member);
    }, isUseCallback ? fnCb : undefined);
  }

  async zmembers (key, callback) {
    return this.zrange(key, 0, -1, callback);
  }

  async hszTtl (type, key, field, isMilliseconds, callback) {
    let _key = this.keyTTL(type, key, field);
    let ttl = isMilliseconds
      ? await this.pttl(_key)
      : await this.ttl(_key);

    if (ttl === -2) {
      return callback ? callback(null, -1) : -1;
    }

    return callback ? callback(null, ttl) : ttl;;
  }

  async httl (key, field, callback) {
    let exists = await this.hexists(key, field);

    if (!exists) {
      return callback ? callback(null, -2) : -2;
    }

    return this.hszTtl(TYPE.HASH, key, field);
  }

  async hpttl (key, field, callback) {
    let exists = await this.hexists(key, field);

    if (!exists) {
      return callback ? callback(null, -2) : -2;
    }

    return this.hszTtl(TYPE.HASH, key, field, true);
  }

  async sttl (key, member, callback) {
    let exists = await this.sismember(key, member);

    if (!exists) {
      return callback ? callback(null, -2) : -2;
    }

    return this.hszTtl(TYPE.SET, key, member);
  }

  async spttl (key, member, callback) {
    let exists = await this.sismember(key, member);

    if (!exists) {
      return callback ? callback(null, -2) : -2;
    }

    return this.hszTtl(TYPE.SET, key, member, true);
  }

  async zttl (key, member, callback) {
    let exists = await this.zismember(key, member);

    if (!exists) {
      return callback ? callback(null, -2) : -2;
    }

    return this.hszTtl(TYPE.SORTED_SET, key, member);
  }

  async zpttl (key, member, callback) {
    let exists = await this.zismember(key, member);

    if (!exists) {
      return callback ? callback(null, -2) : -2;
    }

    return this.hszTtl(TYPE.SORTED_SET, key, member, true);
  }
}

module.exports = RedisExtend;
