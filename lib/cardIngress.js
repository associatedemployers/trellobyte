const { TRELLO_DEV_SECRET, TRELLO_USER_SECRET } = process.env,
      trelloApi = require('trello-node-api')(TRELLO_DEV_SECRET, TRELLO_USER_SECRET);

module.exports = function (req, res) {
  if (req.method === 'HEAD') {
    console.log('Got HEAD request, responding 200...');
    return res.status(200).end();
  }

  console.log('HEY!', req, res);
  return res.status(200).end();
};
