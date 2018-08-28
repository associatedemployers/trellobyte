const {
  TRELLO_DEV_SECRET,
  TRELLO_USER_SECRET
} = process.env;

const HIGH_PRIORITY_BOARD = '5b84634aded3440c680a9848';

const trelloApi = require('trello-node-api')(TRELLO_DEV_SECRET, TRELLO_USER_SECRET),
      mailer = require('../lib/mail'),
      Promise = require('bluebird'),
      descToEmail = require('../lib/description-to-email');

const actions = {
  async emailCard (data) {
    await new Promise(resolve => setTimeout(resolve, 5000));

    let card = await trelloApi.card.search(data.action.data.card.id);
    card.isHighPriority = card.labels && card.labels.find(l => l.name === 'high-priority');

    const email = descToEmail(card.desc);

    if (email) {
      await mailer.send('new-card-followup', {
        to: email,
        subject: 'Your issue has been received',
        data: { card }
      });
    }

    // If it's high-priority, move it there.
    if (card.isHighPriority) {
      await trelloApi.card.update(card.id, {
        idBoard: HIGH_PRIORITY_BOARD
      });
    }

    return {};
  }
};

module.exports = async function (req, res) {
  if (req.method === 'HEAD') {
    console.log('Got HEAD request, responding 200...');
    return res.status(200).end();
  }

  const { body } = req;

  console.log('body is', body.action);
  console.log('body stringify', JSON.stringify(body));

  if (!actions[body.action.type]) {
    return res.status(204).end();
  }

  let mappingResult = await actions[body.action.type](body);

  res.status(200).send(mappingResult);
};
