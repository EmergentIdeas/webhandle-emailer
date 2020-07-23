const https = require('https')

const filog = require('filter-log')
let log = filog('webhandle:webhandle-emailer')

let recaptchaRequest = (privateKey, token, callback) => {
	let data = 'secret=' + encodeURIComponent(privateKey) + '&response=' + encodeURIComponent(token)
	// const dataObj = {
	// 	secret: privateKey,
	// 	response: token
	// }
	// let data = JSON.stringify(dataObj)
	
	const options = {
		hostname: 'www.google.com',
		port: 443,
		path: '/recaptcha/api/siteverify',
		method: 'POST'
		, headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
			'Content-Length': data.length
		}
	}

	const req = https.request(options, (res) => {
		console.log(`statusCode: ${res.statusCode}`)

		res.on('data', (d) => {
			if(typeof d == 'string' || Buffer.isBuffer(d)) {
				try {
					d = JSON.parse(d)
				}
				catch(e) {
					callback(e)
				}
			}
			callback(null, d)
		})
	})

	req.on('error', (error) => {
		log.error(error)
		callback(error)
	})

	req.write(data)
	req.end()
}

module.exports = recaptchaRequest