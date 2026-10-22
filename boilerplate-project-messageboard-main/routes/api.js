'use strict';
const mongoose = require('mongoose');

const replySchema = new mongoose.Schema({
  text: String,
  created_on: { type: Date, default: Date.now },
  delete_password: String,
  reported: { type: Boolean, default: false }
});

const threadSchema = new mongoose.Schema({
  board: { type: String, index: true },
  text: String,
  created_on: { type: Date, default: Date.now },
  bumped_on: { type: Date, default: Date.now },
  reported: { type: Boolean, default: false },
  delete_password: String,
  replies: [replySchema]
});

const Thread = mongoose.models.Thread || mongoose.model('Thread', threadSchema);

// Strip private fields before sending to client
function clean(thread, limitReplies) {
  let replies = thread.replies.map(r => ({
    _id: r._id,
    text: r.text,
    created_on: r.created_on
  }));
  if (limitReplies) {
    replies = replies
      .sort((a, b) => new Date(b.created_on) - new Date(a.created_on))
      .slice(0, limitReplies)
      .reverse();
  }
  return {
    _id: thread._id,
    text: thread.text,
    created_on: thread.created_on,
    bumped_on: thread.bumped_on,
    replycount: thread.replies.length,
    replies
  };
}

module.exports = function (app) {

  app.route('/api/threads/:board')
    .post(async (req, res) => {
      try {
        const { text, delete_password } = req.body;
        const board = req.params.board;
        const now = new Date();
        const thread = await Thread.create({
          board, text, delete_password,
          created_on: now, bumped_on: now,
          reported: false, replies: []
        });
        // Redirect to board page (also works for the FCC tests via JSON clients)
        return res.redirect('/b/' + board + '/');
      } catch (err) {
        return res.status(500).send('error');
      }
    })
    .get(async (req, res) => {
      try {
        const threads = await Thread.find({ board: req.params.board })
          .sort({ bumped_on: -1 })
          .limit(10);
        return res.json(threads.map(t => clean(t, 3)));
      } catch (err) {
        return res.status(500).send('error');
      }
    })
    .delete(async (req, res) => {
      try {
        const { thread_id, delete_password } = req.body;
        const thread = await Thread.findOne({ _id: thread_id, board: req.params.board });
        if (!thread || thread.delete_password !== delete_password) {
          return res.send('incorrect password');
        }
        await Thread.deleteOne({ _id: thread_id });
        return res.send('success');
      } catch (err) {
        return res.send('incorrect password');
      }
    })
    .put(async (req, res) => {
      try {
        const id = req.body.thread_id || req.body.report_id;
        await Thread.updateOne({ _id: id, board: req.params.board }, { reported: true });
        return res.send('reported');
      } catch (err) {
        return res.send('error');
      }
    });

  app.route('/api/replies/:board')
    .post(async (req, res) => {
      try {
        const { thread_id, text, delete_password } = req.body;
        const board = req.params.board;
        const now = new Date();
        const thread = await Thread.findOneAndUpdate(
          { _id: thread_id, board },
          {
            $set: { bumped_on: now },
            $push: { replies: { text, delete_password, created_on: now, reported: false } }
          },
          { new: true }
        );
        if (!thread) return res.send('thread not found');
        return res.redirect('/b/' + board + '/' + thread_id);
      } catch (err) {
        return res.status(500).send('error');
      }
    })
    .get(async (req, res) => {
      try {
        const thread = await Thread.findOne({ _id: req.query.thread_id, board: req.params.board });
        if (!thread) return res.json({ error: 'thread not found' });
        return res.json(clean(thread));
      } catch (err) {
        return res.json({ error: 'thread not found' });
      }
    })
    .delete(async (req, res) => {
      try {
        const { thread_id, reply_id, delete_password } = req.body;
        const thread = await Thread.findOne({ _id: thread_id, board: req.params.board });
        if (!thread) return res.send('incorrect password');
        const reply = thread.replies.id(reply_id);
        if (!reply || reply.delete_password !== delete_password) {
          return res.send('incorrect password');
        }
        reply.text = '[deleted]';
        await thread.save();
        return res.send('success');
      } catch (err) {
        return res.send('incorrect password');
      }
    })
    .put(async (req, res) => {
      try {
        const { thread_id, reply_id } = req.body;
        const thread = await Thread.findOne({ _id: thread_id, board: req.params.board });
        if (!thread) return res.send('error');
        const reply = thread.replies.id(reply_id);
        if (!reply) return res.send('error');
        reply.reported = true;
        await thread.save();
        return res.send('reported');
      } catch (err) {
        return res.send('error');
      }
    });

};
