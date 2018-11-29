const {
  TRELLO_DEV_SECRET,
  TRELLO_USER_SECRET
} = process.env;

const HIGH_PRIORITY_LIST = '5b8465f9501da987a5c88196',
      IN_PROGRESS_LIST = '5b84635bc6d06155ee1d4a1f',
      COMPLETED_LIST = '5b846360b1ffb31656b5b521';

const trelloApi = require('trello-node-api')(TRELLO_DEV_SECRET, TRELLO_USER_SECRET),
      Trello = require('trello'),
      altTrelloApi = new Trello(TRELLO_DEV_SECRET, TRELLO_USER_SECRET),
      mailer = require('../lib/mail'),
      Promise = require('bluebird'),
      moment = require('moment'),
      descToEmail = require('../lib/description-to-email');

console.log(altTrelloApi);

const combineDupe = async (card) => {
  if (!card.desc || card.desc.indexOf('~cid: ') < 0) {
    return;
  }

  let cid = (/###.*~cid: ([\d\w]*)/gi.exec(card.desc) || [])[1];

  if (!cid) {
    return;
  }

  let original = await trelloApi.card.search(cid);

  if (!original) {
    return;
  }

  // delete the new card
  await trelloApi.card.del(card.id);

  // add comment on original
  await altTrelloApi.addCommentToCard(original.id, `Reply from creator on ${moment().format('M/D/YY h:mma')}: ${card.desc.split('### If replying').shift().replace(/From:(?:\n|\t|\r|.)+Subject:.*/i, '')}`);

  return true;
};

const actions = {
  async emailCard (data) {
    await new Promise(resolve => setTimeout(resolve, 5000));

    let card = await trelloApi.card.search(data.action.data.card.id),
        dupe = await combineDupe(card);

    if (dupe) {
      return {};
    }

    card.isHighPriority = card.labels && card.labels.find(l => l.name === 'high-priority');

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
          listChanged = (listAfter || {}).id !== (listBefore || {}).id,
          updateType = (listAfter || {}).id === IN_PROGRESS_LIST ? 'in progress' : (listAfter || {}).id === COMPLETED_LIST ? 'completed' : null;

    let closingRemark;

    if (updateType === 'completed') {
      let comment = await altTrelloApi.makeRequest(
        'get',
        `/1/cards/${card.id}/actions`,
        {
          filter: 'commentCard',
          limit: 1
        }
      );

      if (comment && comment[0] && comment[0].data && (comment[0].data.text || '').indexOf('/cr') > -1) {
        closingRemark = {
          text: comment[0].data.text,
          member: ((comment.memberCreator || {}).fullName || '').split(' ').shift()
        };
      }
    }

    // was moved to in progress or completed
    if (listChanged && updateType) {
      await mailer.send('card-update', {
        to: email,
        subject: `Your issue (#${card.shortLink}) was marked as ${updateType}`,
        data: { card, updateType, closingRemark, isClosed: updateType === 'completed' }
      });
    }

    return {};
  },

  async commentCard (data) {
    let card = await trelloApi.card.search(data.action.data.card.id),
        actionData = data.action.data || {};

    const email = descToEmail(card.desc),
          { text } = actionData,
          commenter = (((data.action || {}).memberCreator || {}).fullName || '').split(' ').shift();

    // reply enabled for comment
    if (text && text.indexOf('/r') > -1) {
      await mailer.send('card-update', {
        to: email,
        subject: `A new reply to your issue (#${card.shortLink})${commenter ? ' from ' + commenter : ''}`,
        data: { card, comment: text.replace('/r', ''), commenter }
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
