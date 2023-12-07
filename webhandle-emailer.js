const filog = require('filter-log')
let log = filog('webhandle:webhandle-emailer')

const moment = require('moment')
const striptags = require('striptags')
const path = require('path')
const nodemailer = require('nodemailer')

const grecaptchaRequest = require('./grecaptcha-request')
const stream = require('stream');

let example = {
	transport: {
		service: "gmail",
		auth: {
			user: "somename@gmail.com",
			pass: "somepass"
		}
	}
}



function cleanse(body, fields) {
	let o = Object.assign({}, body)
	Object.assign(o, fields)
	for (let key of Object.keys(o)) {
		if (typeof o[key] == 'string') {
			o[key] = striptags(o[key])
		}
		else if (Array.isArray(o[key])) {
			for (let i = 0; i < o[key].length; i++) {
				o[key][i] = striptags(o[key][i])
			}
		}
	}

	return o
}

function isValueTrue(context) {
	if (typeof context == 'undefined') {
		return false
	}

	if (context === null || context === undefined || context === false) {
		return false
	}

	if (typeof context == 'string') {
		if (context) {
			return true
		}
		return false
	}
	if (typeof context == 'object') {
		return true
	}
	if (typeof context == 'array') {
		return context.length > 0
	}

	return false
}

function addTemplates(tri) {
	tri.addTemplate('contact-forms/yesNo', function (context) {
		return isValueTrue(context) ? 'yes' : 'no'
	})
}




class Emailer {
	constructor(transportOptions) {
		if (transportOptions) {
			this.transportOptions = transportOptions
		}
		else {
			if (process.env.webhandleEmail) {
				if (typeof process.env.webhandleEmail == 'string') {
					try {
						this.transportOptions = JSON.parse(process.env.webhandleEmail)
					} catch (e) {
						log.error('Could not parse webhandleEmail options: ' + e.message)
					}
				}
			} else {
				log.error('No transport information at process.env.webhandleEmail. Info should look like %s' + JSON.stringify(example, null, "\t"))
			}
		}
		this.transportDef = this.transportOptions.transport
		this.transport = nodemailer.createTransport(this.transportDef)
	}

	findFirstNotNullValue(candidates, fArgs) {
		for (let candidate of candidates) {
			if (candidate) {
				if (typeof candidate === 'string') {
					return candidate
				}
				if (typeof candidate === 'function') {
					return candidate(...fArgs)
				}
			}
		}
		return null
	}

	/**
	 * 
	 * @param {object} message The message to send
	 * @param {string} [message.to] String of destination addresses. Use a string of comma separated values for
	 * multiple recipients
	 * @param {string} [message.replyTo] Add a different reply to other than the sender
	 * @param {string|function} [message.from] The from address. Frequently left black where the sending service requires a specific address.
	 * @param {string|function} message.subject The subject to use or a function which creates the subject
	 * @param {string} [message.emailTemplate] The name of the template to use
	 * @param {object} [message.data] The data to render with the template
	 * @param {string} [message.messageHTML] The text of the message to send. Use this or emailTemplate
	 * @param {array} [message.attachments] 
	 * @param {object} [options]
	 * @param {function} [options.cleanse]
	 * @param {function} [options.processFields]
	 * @param {function} [options.preRenderProcessor]
	 * @param {function} [options.addTemplates]
	 * @param {function} [options.preSendProcessor]
	 * @returns 
	 */
	async sendEmail(message, options = {}) {

		let transport = this.transport
		let transportDef = this.transportDef
		let self = this
		let tri = webhandle.tripartite
		return new Promise((resolve, reject) => {
			let dat = (options.cleanse || this.cleanse)(message.data || {}, {})
			if (options.processFields) {
				let ret = options.processFields(dat)
				if (ret) {
					dat = ret
				}
			}

			let mailOptions = {
				subject: this.findFirstNotNullValue([message.subject, 'Contact from the website'], [message, options])
				, from: this.findFirstNotNullValue([message.from, transportDef.auth.user], [message, options])
				, to: this.findFirstNotNullValue([message.to, this.transportOptions.destDefault], [message, options])
				, replyTo: this.findFirstNotNullValue([message.replyTo], [message, options])
			}
			if (message.attachments) {
				mailOptions.attachments = this.findFirstNotNullValue([message.attachments], [message, options])
			}

			if (options.preRenderProcessor) {
				options.preRenderProcessor(mailOptions, message, options, dat)
			}

			if (options.addTemplates) {
				options.addTemplates(tri)
			}

			if (message.emailTemplate) {
				tri.loadTemplate(message.emailTemplate, (template) => {
					mailOptions.html = template(dat)
					sendWithContent()
				})
			}
			else {
				mailOptions.html = message.messageHTML
				sendWithContent()
			}

			function sendWithContent() {
				if (options.preSendProcessor) {
					options.preSendProcessor(mailOptions, req, options)
				}

				if (transport) {
					transport.sendMail(mailOptions, function (error, info) {
						try {
							if (error) {
								log.error('Could not send email: %s\n%s', error.message, error.stack)
								log.error({
									message: 'Email lost',
									response: info.response,
									contents: mailOptions,
									formParms: dat
								})
								reject(error)
							} else {
								log.info({
									message: 'Email sent',
									response: info.response,
									contents: mailOptions,
									formParms: dat
								})
								resolve()
							}
						} catch (e) {
							console.log(e)
						}

					})
				}
				else {
					let msg = 'No transport is defined.'
					log.error(msg)
					reject(new Error(msg))
				}
			}
		})
	}

	createFormHandler(options) {
		let transport = this.transport
		let transportDef = this.transportDef
		let self = this
		options.requiredGrecaptchaScore = options.requiredGrecaptchaScore || .5


		return function (req, res, next) {
			let dat
			if (options.cleanse) {
				dat = options.cleanse(req.body, req.fields)
			}
			else {
				dat = self.cleanse(req.body, req.fields)
			}

			if (options.processFields) {
				let ret = options.processFields(dat, req, res)
				if (ret) {
					dat = ret
				}
			}

			function handleUserResponse(req, res, next) {
				if (options.skipResponse) {
					next()
				}
				else if (options.redirectUrl) {
					res.redirect(options.redirectUrl)
				}
				else if (options.respondent) {
					options.respondent(req, res, next)
				}
				else {
					res.end()
				}
			}

			function handleGRecaptchaCheck(req, res, next) {
				if (options.grecaptchaPrivate) {
					grecaptchaRequest(options.grecaptchaPrivate, dat.grt, (err, answer) => {
						if (answer.success && answer.score >= options.requiredGrecaptchaScore) {
							runEmailSend()
						}
						else {
							handleUserResponse(req, res, next)
						}
					})
				}
				else {
					runEmailSend()
				}
			}

			function runEmailSend() {

				if (options.addTemplates) {
					options.addTemplates(res.tri)
				}
				res.tri.loadTemplate(options.emailTemplate || 'contact-email', (template) => {
					try {
						let mailOptions = {
							from: transportDef.auth.user
						}

						if (!options.subject) {
							mailOptions.subject = 'Contact from the website'
						}
						else if (typeof options.subject == 'function') {
							mailOptions.subject = options.subject(req, res)
						}
						else {
							mailOptions.subject = options.subject
						}

						if (!options.from) {

						}
						if (typeof options.from == 'function') {
							mailOptions.from = options.from(req, res)
						}
						else {
							mailOptions.from = options.from
						}


						if (typeof options.to == 'function') {
							mailOptions.to = options.to(req, res)
						} else {
							mailOptions.to = options.to
						}

						if (dat.email || options.replyTo) {
							mailOptions.replyTo = options.replyTo || dat.email
						}

						if (options.attachments && typeof options.attachments == 'function') {
							mailOptions.attachments = options.attachments(req, res)
						}
						else if (options.attachments && options.attachments.length) {
							mailOptions.attachments = options.attachments
						}
						if (options.preRenderProcessor) {
							options.preRenderProcessor(mailOptions, req, options, dat)
						}
						function sendContents() {
							if (options.preSendProcessor) {
								options.preSendProcessor(mailOptions, req, options)
							}

							if (transport) {
								transport.sendMail(mailOptions, function (error, info) {
									try {
										if (error) {
											log.error('Could not send email: %s\n%s', error.message, error.stack)
											log.info({
												message: 'Email lost',
												response: info.response,
												contents: mailOptions,
												formParms: dat
											})
										} else {
											log.info({
												message: 'Email sent',
												response: info.response,
												contents: mailOptions,
												formParms: dat
											})
										}
									} catch (e) {
										console.log(e)
									}
								})
							} else {
								log.error('No transport is defined.')
							}

							handleUserResponse(req, res, next)
						}
						mailOptions.html = ''

						let emailRenderStream = new stream.Writable();
						emailRenderStream._write = function (chunk, encoding, done) {
							mailOptions.html += chunk.toString()
							done()
						};
						template(dat, emailRenderStream, function () {
							sendContents()
						})


					} catch (ex) {
						console.log(ex)
					}

				})
			}

			// if we're supposed to use a vrf, check the vrf. If it's not right, log it and redirect them to the
			// success page.
			if (!options.noVrf && (dat.vrf != (options.vrf || '12'))) {
				log.error('Verification could did not match. ' + dat.vrf + ' did not equal ' + (options.vrf || '12'))
				handleUserResponse(req, res, next)
				return
			}

			if (options.spamCheck) {
				options.spamCheck(req, res, (err) => {
					if (!err) {
						handleGRecaptchaCheck(req, res, next)
					}
					else {
						handleUserResponse(req, res, next)
					}
				})
			}
			else {
				handleGRecaptchaCheck(req, res, next)
			}
		}
	}

	cleanse(body, fields) {
		return cleanse(body, fields)
	}
}
module.exports = Emailer