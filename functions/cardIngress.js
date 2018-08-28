const {
  TRELLO_DEV_SECRET,
  TRELLO_USER_SECRET
} = process.env;

const trelloApi = require('trello-node-api')(TRELLO_DEV_SECRET, TRELLO_USER_SECRET),
      mailer = require('../lib/mail');

const actions = {
  async createCard (data) {
    let card = await trelloApi.card.search(data.action.data.card.id);
    console.log(card);
  }
};

module.exports = async function (req, res) {
  if (req.method === 'HEAD') {
    console.log('Got HEAD request, responding 200...');
    return res.status(200).end();
  }

  const { body } = req;

  if (!actions[body.action.type]) {
    return res.status(204).end();
  }

  console.log('body is', body.action);
  let mappingResult = await actions[body.action.type](body);

  res.status(200).send(mappingResult);
};
