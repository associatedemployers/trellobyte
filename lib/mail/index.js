var Promise = require('bluebird'),
    fs      = require('fs'),
    _       = require('lodash');

var path           = require('path'),
    emailTemplates = require('email-templates'),
    nodemailer     = require('nodemailer'),
    templatesDir   = path.resolve(__dirname, 'templates'),
    partialsDir    = path.resolve(__dirname, 'templates/_partials'),
    helpersDir     = path.resolve(__dirname, 'templates/_helpers'),
    Handlebars     = require('handlebars');

class Mailer {
  /**
   * Mailman Constructor
   * @param  {Object} options Mail options
   * @return {Object} Mailman
   */
  constructor (options = {}) {
    this.sender = {
      from: options.sender && options.sender.name && options.sender.email ? options.sender.name + ' <' + options.sender.email + '>' : 'IT Issue Tracking <techsupport@aehr.org>'
    };

    this.sender.replyTo = options.replyTo || this.sender.from;
    this.__templatesDir = options.templatesDir || templatesDir;
    this.__transportConfig = options.configuration;
    this.__transport = options.transport || require(process.env.MAILTRANSPORT || 'nodemailer-sendgrid-transport');
    this.__partials = {};

    if (process.env.MAILAPIKEY) {
      if ( !_.isObject(this.__transportConfig) ) {
        this.__transportConfig = {
          auth: {}
        };
      }

      if ( !_.isObject(this.__transportConfig.auth) ) {
        this.__transportConfig.auth = {};
      }

      this.__transportConfig.auth.api_key = process.env.MAILAPIKEY; // eslint-disable-line
    }

    var partials = fs.readdirSync(partialsDir);

    partials.forEach(filename => {
      let template = fs.readFileSync(path.resolve(partialsDir, filename), 'utf8'),
          name     = filename.split('.')[0];

      Handlebars.registerPartial(name, template);
    });

    var helpers = fs.readdirSync(helpersDir);

    helpers.forEach(filename => {
      let helper = require(path.resolve(helpersDir, filename)),
          name   = filename.split('.')[0];

      Handlebars.registerHelper(name, helper);
    });

    return;
  }

  /**
   * Mailman Send
   * @param  {String} templateName Name of template in mail-templates directory
   * @param  {Object} options      Options for mail
   * @return {Promise}             Resolves to Mailer Response
   */
  async send (templateName, options) {
    let to      = options.to,
        subject = options.subject,
        vars    = options.data;

    if (process.env.allowEmails !== 'true') {
      console.log('Please set env var "allowEmails" to true to send emails.');
      return Promise.resolve();
    }

    console.log('Mail :: Rendering content for email with template:', templateName);

    let rendered = await this.__render(templateName, vars);

    console.log('Mail :: Rendered content. Sending mail...');
    console.log('Mail :: Using auth', this.__transportConfig ? JSON.stringify(this.__transportConfig.auth) : 'None');

    var postalService = nodemailer.createTransport(this.__transport(this.__transportConfig));

    postalService.on('log', msg => {
      if (process.env.DEBUG) {
        console.log(msg);
      }
    });

    let res = await postalService.sendMail(Object.assign({}, options, {
      from: this.sender.from,
      to: to,
      subject: subject,
      html: rendered.html,
      text: rendered.text
    }));

    console.log('Mail :: Sent mail!');

    return res;
  }

  /**
   * Mailman Send Multiple
   * @param  {String} templateName Name of template in mail-templates directory
   * @param  {Object} options      Options for all mail
   * @param  {Array}  messages     Message option objects
   * @return {Promise}             Resolves to Mailer responses
   */
  async sendMultiple (templateName, options, messages) {
    return await Promise.map(messages, (msgOpt) => {
      let _opts = options;

      if (msgOpt.data) {
        Object.assign(_opts.data || {}, msgOpt.data);
        delete msgOpt.data;
      }

      return this.send(msgOpt.template || templateName, Object.assign({}, _opts, msgOpt));
    });
  }

  /**
   * Mailman __getTemplates
   * @private
   * @return {Object} email-templates template class
   */
  async __getTemplates () {
    if (this.__templates) {
      return this.__templates;
    }

    return await new Promise(resolve => {
      emailTemplates(this.__templatesDir, {
        partials: this.__partials
      }, (err, templates) => {
        this.__templates = templates;
        resolve(templates);
      });
    });
  }

  /**
   * Mailman __render
   * @private
   * @param  {String} templateName Name of template
   * @param  {Object} vars         Template Locals
   * @return {Object}              Containing rendered html & text
   */
  async __render (templateName, vars) {
    let templates = await this.__getTemplates();

    return await new Promise((resolve, reject) =>
      templates(templateName, vars, (err, html, text) =>
        err ? reject(err) : resolve({ html, text })
      )
    );
  }
}

module.exports = new Mailer();
