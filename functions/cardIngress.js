const {
  TRELLO_DEV_SECRET,
  TRELLO_USER_SECRET
} = process.env;

const HIGH_PRIORITY_LIST = '5b8465f9501da987a5c88196',
      IN_PROGRESS_LIST = '5b84635bc6d06155ee1d4a1f',
      COMPLETED_LIST = '5b846360b1ffb31656b5b521';

const trelloApi = require('trello-node-api')(TRELLO_DEV_SECRET, TRELLO_USER_SECRET),
      mailer = require('../lib/mail'),
      Promise = require('bluebird'),
      descToEmail = require('../lib/description-to-email');

const actions = {
  async emailCard (data) {
    await new Promise(resolve => setTimeout(resolve, 5000));

    let card = await trelloApi.card.search(data.action.data.card.id);
    console.log(card);
    card.isHighPriority = card.labels && card.labels.find(l => l.name === 'high-priority');
    console.log(card);

    const email = descToEmail(card.desc);

    if (email) {
      await mailer.send('new-card-followup', {
        to: email,
        subject: `Your issue (#${card.shortLink}) has been received`,
        data: { card }
      });
    }

    // If it's high-priority, move it there.
    if (card.isHighPriority) {
      await trelloApi.card.update(card.id, {
        idList: HIGH_PRIORITY_LIST
      });
    }

    return {};
  },

  async updateCard (data) {
    let card = await trelloApi.card.search(data.action.data.card.id),
        actionData = data.action.data || {};

    const email = descToEmail(card.desc),
          { listAfter, listBefore } = actionData,
          listChanged = listAfter !== listBefore,
          updateType = listAfter === IN_PROGRESS_LIST ? 'in progress' : listAfter === COMPLETED_LIST ? 'completed' : null;

    // was moved to in progress or completed
    if (listChanged && updateType) {
      await mailer.send('card-update', {
        to: email,
        subject: `Your issue (#${card.shortLink}) was marked as ${updateType}`,
        data: { card, updateType }
      });
    }
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
