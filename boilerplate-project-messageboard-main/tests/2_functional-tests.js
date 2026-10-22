const chaiHttp = require('chai-http');
const chai = require('chai');
const assert = chai.assert;
const server = require('../server');

chai.use(chaiHttp);

suite('Functional Tests', function() {

  const board = 'functest';
  let threadId1, threadId2, replyId;

  suite('API ROUTING FOR /api/threads/:board', function() {

    test('Creating a new thread: POST /api/threads/{board}', function(done) {
      chai.request(server)
        .post('/api/threads/' + board)
        .redirects(0)
        .send({ text: 'Test thread 1', delete_password: 'pass1' })
        .end(function(err, res) {
          assert.oneOf(res.status, [200, 302]);
          chai.request(server)
            .post('/api/threads/' + board)
            .redirects(0)
            .send({ text: 'Test thread 2', delete_password: 'pass2' })
            .end(function() { done(); });
        });
    });

    test('Viewing the 10 most recent threads with 3 replies each: GET /api/threads/{board}', function(done) {
      chai.request(server)
        .get('/api/threads/' + board)
        .end(function(err, res) {
          assert.equal(res.status, 200);
          assert.isArray(res.body);
          assert.isAtMost(res.body.length, 10);
          const t = res.body[0];
          assert.property(t, '_id');
          assert.property(t, 'text');
          assert.property(t, 'created_on');
          assert.property(t, 'bumped_on');
          assert.property(t, 'replies');
          assert.notProperty(t, 'reported');
          assert.notProperty(t, 'delete_password');
          assert.isAtMost(t.replies.length, 3);
          threadId1 = res.body[0]._id;
          threadId2 = res.body[1]._id;
          done();
        });
    });

    test('Deleting a thread with the incorrect password: DELETE /api/threads/{board}', function(done) {
      chai.request(server)
        .delete('/api/threads/' + board)
        .send({ thread_id: threadId1, delete_password: 'wrong' })
        .end(function(err, res) {
          assert.equal(res.text, 'incorrect password');
          done();
        });
    });

    test('Deleting a thread with the correct password: DELETE /api/threads/{board}', function(done) {
      // threadId2 is the older of the two ("Test thread 1", password pass1)
      chai.request(server)
        .delete('/api/threads/' + board)
        .send({ thread_id: threadId2, delete_password: 'pass1' })
        .end(function(err, res) {
          assert.equal(res.text, 'success');
          done();
        });
    });

    test('Reporting a thread: PUT /api/threads/{board}', function(done) {
      chai.request(server)
        .put('/api/threads/' + board)
        .send({ thread_id: threadId1 })
        .end(function(err, res) {
          assert.equal(res.text, 'reported');
          done();
        });
    });

  });

  suite('API ROUTING FOR /api/replies/:board', function() {

    test('Creating a new reply: POST /api/replies/{board}', function(done) {
      chai.request(server)
        .post('/api/replies/' + board)
        .redirects(0)
        .send({ thread_id: threadId1, text: 'Test reply', delete_password: 'rpass' })
        .end(function(err, res) {
          assert.oneOf(res.status, [200, 302]);
          done();
        });
    });

    test('Viewing a single thread with all replies: GET /api/replies/{board}', function(done) {
      chai.request(server)
        .get('/api/replies/' + board)
        .query({ thread_id: threadId1 })
        .end(function(err, res) {
          assert.equal(res.status, 200);
          assert.equal(res.body._id, threadId1);
          assert.isArray(res.body.replies);
          assert.isAtLeast(res.body.replies.length, 1);
          assert.notProperty(res.body, 'reported');
          assert.notProperty(res.body, 'delete_password');
          assert.notProperty(res.body.replies[0], 'reported');
          assert.notProperty(res.body.replies[0], 'delete_password');
          replyId = res.body.replies[res.body.replies.length - 1]._id;
          done();
        });
    });

    test('Deleting a reply with the incorrect password: DELETE /api/replies/{board}', function(done) {
      chai.request(server)
        .delete('/api/replies/' + board)
        .send({ thread_id: threadId1, reply_id: replyId, delete_password: 'wrong' })
        .end(function(err, res) {
          assert.equal(res.text, 'incorrect password');
          done();
        });
    });

    test('Deleting a reply with the correct password: DELETE /api/replies/{board}', function(done) {
      chai.request(server)
        .delete('/api/replies/' + board)
        .send({ thread_id: threadId1, reply_id: replyId, delete_password: 'rpass' })
        .end(function(err, res) {
          assert.equal(res.text, 'success');
          done();
        });
    });

    test('Reporting a reply: PUT /api/replies/{board}', function(done) {
      chai.request(server)
        .put('/api/replies/' + board)
        .send({ thread_id: threadId1, reply_id: replyId })
        .end(function(err, res) {
          assert.equal(res.text, 'reported');
          done();
        });
    });

  });

});
