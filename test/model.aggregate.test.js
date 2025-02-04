
/**
 * Test dependencies.
 */

'use strict';

const start = require('./common');

const Aggregate = require('../lib/aggregate');
const assert = require('assert');
const random = require('../lib/utils').random;

const mongoose = start.mongoose;
const Schema = mongoose.Schema;

/**
 * Setup.
 */

const userSchema = new Schema({
  name: String,
  age: Number
});

describe('model aggregate', function() {
  this.timeout(process.env.TRAVIS ? 8000 : 4500);

  const group = { $group: { _id: null, maxAge: { $max: '$age' } } };
  const project = { $project: { maxAge: 1, _id: 0 } };
  let db, A, maxAge;

  let mongo26_or_greater = false;

  before(async function() {
    db = start();
    A = db.model('Test', userSchema);

    const authors = 'guillermo nathan tj damian marco'.split(' ');
    const num = 10;
    const docs = [];
    maxAge = 0;


    for (let i = 0; i < num; ++i) {
      const age = Math.random() * 100 | 0;
      maxAge = Math.max(maxAge, age);
      docs.push({ author: authors[i % authors.length], age: age });
    }

    await A.create(docs);

    const version = await start.mongodVersion();

    mongo26_or_greater = version[0] > 2 || (version[0] === 2 && version[1] >= 6);

    if (!mongo26_or_greater) {
      console.log('not testing mongodb 2.6 features');
    }
  });

  after(function(done) {
    db.close(done);
  });

  describe('works', function() {
    it('when return promise', function(done) {
      A.aggregate([group, project]).then(function(res) {
        assert.ok(res);
        assert.equal(1, res.length);
        assert.ok('maxAge' in res[0]);
        assert.equal(maxAge, res[0].maxAge);
        done();
      });
    });

    it('with arrays', function(done) {
      A.aggregate([group, project], function(err, res) {
        assert.ifError(err);
        assert.ok(res);
        assert.equal(res.length, 1);
        assert.ok('maxAge' in res[0]);
        assert.equal(res[0].maxAge, maxAge);
        done();
      });
    });

    it('with Aggregate syntax', function(done) {
      A.aggregate()
        .group(group.$group)
        .project(project.$project)
        .exec(function(err, res) {
          assert.ifError(err);
          assert.ok(res);
          assert.equal(res.length, 1);
          assert.ok('maxAge' in res[0]);
          assert.equal(res[0].maxAge, maxAge);
          done();
        });
    });

    it('with Aggregate syntax if callback not provided', function(done) {
      const promise = A.aggregate()
        .group(group.$group)
        .project(project.$project)
        .exec();

      promise.then(function(res) {
        assert.ok(promise instanceof mongoose.Promise);
        assert.ok(res);
        assert.equal(res.length, 1);
        assert.ok('maxAge' in res[0]);
        assert.equal(maxAge, res[0].maxAge);
        done();
      });
    });

    it('when returning Aggregate', function() {
      assert(A.aggregate([project]) instanceof Aggregate);
    });

    it('throws when passing object (gh-6732)', function() {
      assert.throws(() => A.aggregate({}), /disallows passing a spread/);
    });

    it('can use helper for $out', function(done) {
      if (!mongo26_or_greater) {
        return done();
      }

      const outputCollection = 'aggregate_output_' + random();
      A.aggregate()
        .group(group.$group)
        .project(project.$project)
        .out(outputCollection)
        .exec(function(error) {
          assert.ifError(error);
          A.db.collection(outputCollection).find().toArray(function(error, documents) {
            assert.ifError(error);
            assert.equal(documents.length, 1);
            assert.ok('maxAge' in documents[0]);
            assert.equal(maxAge, documents[0].maxAge);
            done();
          });
        });
    });
  });
});
