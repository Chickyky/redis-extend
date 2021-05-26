const RedisExtend = require('./redis-extend');

const redis = new RedisExtend(6379, 'localhost', {
  host: 'localhost',
  port: 6379,
  db: 15
});

console.clear();

const sleep = (ms) => {
  return new Promise((resolve, reject) => {
    return setTimeout(resolve, ms, null);
  });
}

const data = {
  hash: {
    key: 'jest_hash',
    field: 'jest_hash_field',
    value: 'jest_hash_value'
  },

  ['set']: {
    key: 'jest_set',
    member: 'jest_set_member'
  },

  zset: {
    key: 'jest_zset',
    member: 'jest_zset_member'
  }
}

const seconds = 1;
const milliseconds = 200;
const secDelta = 50;
const msDelta = 50;

const nestedObj = {
  a: 'aaaa:bbbb',
  b: new Date(2021, 7, 7),
  c: false,
  d: 1,
  e: {
    a: 'aaaa:bbbb',
    b: new Date(2021, 7, 7),
    c: true,
    d: 1,
    f: null,
    g: undefined,
    h: {
      a: 'aaaa:bbbb',
      b: new Date(2021, 7, 7),
      c: true,
      d: 1,
      f: null,
      g: undefined,
      h: ['aaa', 123, false, true, false, new Date(2021, 7, 7), null, undefined]
    }
  },
  f: null,
  g: undefined,
  h: ['aaa', 123, false, true, false, new Date(2021, 7, 7), null, undefined]
}

const array = ['aaa', 123, false, true, false, new Date(2021, 7, 7), null, undefined, {
  a: 'aaaa:bbbb',
  b: new Date(2021, 7, 7),
  c: false,
  d: 1
}];

beforeAll(async () => {
  console.log('beforeAll: flush db 15 ...');
  // Clears the database
  await redis.select(15);
  await redis.flushdb();

  console.log('flush db done!');
});

afterAll(async () => {
  console.log('afterAll: close connection ...');
  // Clears the database
  await redis.quit();
});

describe('Hash', () => {
  test('hexpire: expire field in hash by seconds', async () => {
    const { hash } = data;

    const hset = await redis.hset(hash.key, hash.field, hash.value);
    const hexpire = await redis.hexpire(hash.key, hash.field, seconds);

    expect(hset).toBe(1);
    expect(hexpire).toBe(1);

    await sleep(seconds * 1e3 + secDelta);

    const hget = await redis.hget(hash.key, hash.field);

    expect(hget).toBe(null);
  });

  test('hpexpire: expire field in hash by milliseconds', async () => {
    const { hash } = data;

    const hset = await redis.hset(hash.key, hash.field, hash.value);
    const hpexpire = await redis.hpexpire(hash.key, hash.field, milliseconds);

    expect(hset).toBe(1);
    expect(hpexpire).toBe(1);

    await sleep(milliseconds + msDelta);

    const hget = await redis.hget(hash.key, hash.field);

    expect(hget).toBe(null);
  });

  test('httl: return time-to-live in seconds of field in hash', async () => {
    const { hash } = data;

    const hset = await redis.hset(hash.key, hash.field, hash.value);
    const hexpire = await redis.hexpire(hash.key, hash.field, seconds);
    const httl = await redis.httl(hash.key, hash.field);

    expect(httl).toBe(seconds);
  })

  test('hpttl: return time-to-live in milliseconds of field in hash', async () => {
    const { hash } = data;

    const hset = await redis.hset(hash.key, 'field_hpttl', hash.value);
    const hpexpire = await redis.hpexpire(hash.key, 'field_hpttl', milliseconds);
    const hpttl = await redis.hpttl(hash.key, 'field_hpttl');

    expect(hpttl).toBeGreaterThanOrEqual(milliseconds - msDelta);
  })

  test('hpdel: delete all fields match pattern `field*` in hash `jest_hash_hpdel`', async () => {
    const arrLength = 10;
    const fields = Array.apply(null, Array(arrLength)).map((a, i) => `field_${i+1}`);
    const values = Array.apply(null, Array(arrLength)).map((a, i) => `value_${i+1}`);

    const args = [];
    for (let i = 0; i < arrLength; i++) {
      args.push(fields[i]);
      args.push(values[i]);
    }

    const hset = await redis.hset.apply(redis, ['jest_hash_hpdel', ...args]);

    expect(hset).toBe(arrLength);

    let hkeys = await redis.hkeys('jest_hash_hpdel');
    expect(hkeys).toHaveLength(arrLength);

    const hpdel = await redis.hpdel('jest_hash_hpdel', 'field*');
    expect(hpdel).toBe(arrLength);

    hkeys = await redis.hkeys('jest_hash_hpdel');
    expect(hkeys).toHaveLength(0);
  })
});

describe('Set', () => {
  test('sexpire: expire member in set by seconds', async () => {
    const { set } = data;

    const sadd = await redis.sadd(set.key, set.member);
    const sexpire = await redis.sexpire(set.key, set.member, seconds);

    expect(sadd).toBe(1);
    expect(sexpire).toBe(1);

    await sleep(seconds * 1e3 + secDelta);

    const sismember = await redis.sismember(set.key, set.member);

    expect(sismember).toBe(0);
  })

  test('spexpire: expire member in set by milliseconds', async () => {
    const { set } = data;

    const sadd = await redis.sadd(set.key, set.member);
    let spexpire = await redis.spexpire(set.key, set.member, milliseconds);

    expect(sadd).toBe(1);
    expect(spexpire).toBe(1);

    await sleep(milliseconds + msDelta);

    let sismember = await redis.sismember(set.key, set.member);

    expect(sismember).toBe(0);
  })

  test('sttl: return time-to-live in seconds of member in set', async () => {
    const { set } = data;

    const sadd = await redis.sadd(set.key, 'member_sttl');
    const sexpire = await redis.sexpire(set.key, 'member_sttl', seconds);
    const sttl = await redis.sttl(set.key, 'member_sttl');

    expect(sttl).toBe(seconds);
  })

  test('spttl: return time-to-live in milliseconds of member in set', async () => {
    const { set } = data;

    const sadd = await redis.sadd(set.key, 'member_spttl');
    const spexpire = await redis.spexpire(set.key, 'member_spttl', milliseconds);
    const spttl = await redis.spttl(set.key, 'member_spttl');

    expect(spttl).toBeGreaterThanOrEqual(milliseconds - msDelta);
  })

  /*test('sscanmembersStream: stream scan members in set', (done) => {
    const arrLength = 10;
    const expected = Array.apply(null, Array(arrLength)).map((a, i) => `smember_${i+1}`);

    redis.sadd.apply(redis, ['jest_stream', ...expected])
      .then(sadd => {
        expect(sadd).toBe(arrLength);

        let result = [];
        const stream = redis.sscanmembersStream('jest_stream', {
          count: 3
        });

        stream.on('data', (members) => {
          if (members && members.length) {
            result = [...result, ...members];
          }
        })

        stream.on('end', () => {
          expect(result).toHaveLength(arrLength);
          expect(result).toEqual(expect.arrayContaining(expected));

          done();
        })

        stream.on('error', (err) => {
          done(err);
        })
      })
  })*/

  test('spdel: delete all members match pattern `member*` in set `jest_set_spdel`', async () => {
    const arrLength = 10;
    const setName = 'jest_set_spdel';
    const members = Array.apply(null, Array(arrLength)).map((a, i) => `member_${i+1}`);

    const sadd = await redis.sadd.apply(redis, [setName, ...members]);

    expect(sadd).toBe(arrLength);

    let scard = await redis.scard(setName);
    expect(scard).toBe(arrLength);

    const spdel = await redis.spdel(setName, 'member*');
    expect(spdel).toBe(arrLength);

    scard = await redis.scard(setName);
    expect(scard).toBe(0);
  })
});

describe('Zset', () => {
  test('zexpire: expire member in zset by seconds', async () => {
    const { zset } = data;

    const zadd = await redis.zadd(zset.key, 1, zset.member);
    const zexpire = await redis.zexpire(zset.key, zset.member, seconds);

    expect(zadd).toBe(1);
    expect(zexpire).toBe(1);

    await sleep(seconds * 1e3 + secDelta);

    const zismember = await redis.zismember(zset.key, zset.member);

    expect(zismember).toBe(0);
  });

  test('zpexpire: expire member in zset by milliseconds', async () => {
    const { zset } = data;

    const zadd = await redis.zadd(zset.key, 1, zset.member);
    const zpexpire = await redis.zpexpire(zset.key, zset.member, milliseconds);

    expect(zadd).toBe(1);
    expect(zpexpire).toBe(1);

    await sleep(milliseconds + msDelta);

    const zismember = await redis.zismember(zset.key, zset.member);

    expect(zismember).toBe(0);
  });

  test('zismember: check a value is member of zset (like sismember)', async () => {
    const { zset } = data;
    const zadd = await redis.zadd(zset.key, 1, 'member_1');

    const zismember = await redis.zismember(zset.key, 'member_1');

    expect(zadd).toBe(1);
    expect(zismember).toBe(1);
  })

  test('zmismember: check multi values is member of zset (like smismember)', async () => {
    const { zset } = data;
    const expected = [1, 1, 0];
    const zadd = await redis.zadd(zset.key, 1, 'member_2', 1, 'member_3');

    const zmismember = await redis.zmismember(zset.key, 'member_2', 'member_3', 'member_4');

    expect(zadd).toBe(2);
    expect(zmismember).toHaveLength(3);
    expect(zmismember).toEqual(expected);
  })

  test('zmembers: return all member in zset (like smembers)', async () => {
    const expected = ['member_1', 'member_2', 'member_3'];
    const { zset } = data;
    const zadd = await redis.zadd('jest_zmembers', 1, 'member_1', 2, 'member_2', 3, 'member_3');
    const zmembers = await redis.zmembers('jest_zmembers');

    expect(zadd).toBe(3);
    expect(zmembers).toHaveLength(3);
    expect(zmembers).toEqual(expect.arrayContaining(expected));
  })

  test('zmembers (callback): return all member in zset (like smembers)', (done) => {
    const expected = ['member_1', 'member_2', 'member_3'];
    const { zset } = data;

    return redis.zadd('jest_zmembers', 1, 'member_1', 2, 'member_2', 3, 'member_3')
      .then(zadd => {
        redis.zmembers('jest_zmembers', (err, zmembers) => {
          expect(zmembers).toHaveLength(3);
          expect(zmembers).toEqual(expect.arrayContaining(expected));

          if (err) return done(err);
          return done();
        });
      });
  })

  test('zttl: return time-to-live in seconds of member in zset', async () => {
    const { zset } = data;

    const zadd = await redis.zadd(zset.key, 1, 'member_zttl');
    const zexpire = await redis.zexpire(zset.key, 'member_zttl', seconds);
    const zttl = await redis.zttl(zset.key, 'member_zttl');

    expect(zttl).toBe(seconds);
  })

  test('zpttl: return time-to-live in milliseconds of member in zset', async () => {
    const { zset } = data;

    const zadd = await redis.zadd(zset.key, 1, 'member_zpttl');
    const zexpire = await redis.zexpire(zset.key, 'member_zpttl', milliseconds);
    const zpttl = await redis.zpttl(zset.key, 'member_zpttl');

    expect(zpttl).toBeGreaterThanOrEqual(milliseconds - msDelta);
  })

  /*test('zscanmembersStream: stream scan members in zset', (done) => {
    const arrLength = 10;
    const expected = Array.apply(null, Array(arrLength)).map((a, i) => `zmember_${i+1}`);

    let args = expected.reduce((r, member) => {
      r.push(1);
      r.push(member);
      return r;
    }, []);

    redis.zadd.apply(redis, ['jest_zset_stream', ...args])
      .then(zadd => {
        expect(zadd).toBe(arrLength);

        let result = [];
        const stream = redis.zscanmembersStream('jest_zset_stream', {
          count: 3
        });

        stream.on('data', (members) => {
          if (members && members.length) {
            result = [...result, ...members];
          }
        })

        stream.on('end', () => {
          expect(result).toHaveLength(arrLength);
          expect(result).toEqual(expect.arrayContaining(expected));

          done();
        })

        stream.on('error', (err) => {
          done(err);
        })
      })
  })*/

  test('zpdel: delete all members match pattern `member*` in set `jest_zset_zpdel`', async () => {
    const arrLength = 10;
    const zsetName = 'jest_zset_zpdel';
    let members = Array.apply(null, Array(arrLength))
      .map((a, i) => `member_${i+1}`)
      .reduce((r, member) => {
        r.push(1);
        r.push(member);
        return r;
      }, []);

    const zadd = await redis.zadd.apply(redis, [zsetName, ...members]);

    expect(zadd).toBe(arrLength);

    let zcard = await redis.zcard(zsetName);
    expect(zcard).toBe(arrLength);

    const zpdel = await redis.zpdel(zsetName, 'member*');
    expect(zpdel).toBe(arrLength);

    zcard = await redis.zcard(zsetName);
    expect(zcard).toBe(0);
  })
});

describe('Other', () => {
  test('pdel (callback): reject pattern `*` (delete all keys)', (done) => {
    redis.pdel('*', (err, result) => {
      expect(result).toBe(-1);
      done(err);
    });
  })

  test('pdel: delete all keys with pattern `a*`', async () => {
    await redis.set('a1', 1);
    await redis.set('a2', 1);
    await redis.set('a3', 1);

    let aCount = await redis.keys('a*');
    expect(aCount).toHaveLength(3);

    const pdel = await redis.pdel('a*');
    expect(pdel).toBe(3);

    aCount = await redis.keys('a*');
    expect(aCount).toHaveLength(0);
  })

  test('pdel: reject pattern `*` (delete all keys)', async () => {
    const pdel = await redis.pdel('*');
    expect(pdel).toBe(-1);
  })

  test('pdel: delete key with pattern `jest_set*` and type `set`', async () => {
    await redis.sadd('jest_set_pdel_1', 'a1');
    await redis.sadd('jest_set_pdel_2', 'a1');
    await redis.sadd('jest_set_pdel_3', 'a1');

    await redis.set('jest_set_pdel_4', 'a1');
    await redis.set('jest_set_pdel_5', 'a1');

    let jestCount = await redis.keys('jest_set_pdel_*');
    expect(jestCount).toHaveLength(5);

    const pdel = await redis.pdel('jest_set_pdel_*', {
      type: redis.TYPE.SET
    });
    expect(pdel).toBe(3);

    jestCount = await redis.keys('jest_set_pdel_*');
    expect(jestCount).toHaveLength(2); // jest_set_pdel_4, jest_set_pdel_5 type is string not set
  })

  test('jset: set nested json object in hash', async () => {
    let jset = await redis.jset('jest_jset_nested_obj', nestedObj);

    expect(jset).toBeGreaterThanOrEqual(0);
  })

  test('jget: get nested json object', async () => {
    let jset = await redis.jset('jest_jset_nested_obj', nestedObj);
    let jget = await redis.jget('jest_jset_nested_obj');

    expect(jget).toMatchObject(nestedObj);
  })

  test('jget: get key not exists', async () => {
    let jget = await redis.jget('jest_xxxx');

    expect(jget).toBe(-1);
  })

  test('jset: set array in hash', async () => {
    let jset = await redis.jset('jest_jset_array', array);

    expect(jset).toBeGreaterThanOrEqual(0);
  })

  test('jget: get nested json object', async () => {
    let jset = await redis.jset('jest_jset_array', array);
    let jget = await redis.jget('jest_jset_array');

    expect(jget).toMatchObject(array);
  })
})











