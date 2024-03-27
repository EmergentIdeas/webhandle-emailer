/**
 * 
 * Configures forms to use Google Recaptcha by:
 * 1. Adding a hidden parameter which will contain information from google
 * 2. Adding onsubmit listners to catch submissions and contact google
 * for its assessment before the form is submitted to the server.
 * 
 * @param {string} googlePublicId The public google recaptcha key for this site
 * @param {string} formSelector The selector used to determine which forms receive recaptcha
 * 
 * @return null
 */
module.exports = function(googlePublicId, formSelector = '.google-recaptcha-form') {
	
	
	let recaptchaNeeded = true
	let forms = document.querySelectorAll(formSelector)

	if(forms && forms.length > 0) {
		let script = document.createElement('script')
		script.src = 'https://www.google.com/recaptcha/api.js?render=' + googlePublicId
		document.querySelector('head').appendChild(script)
	}

	function onSubmit(e) {
		let form = e.target
		if(grecaptcha && googlePublicId) {
			if(recaptchaNeeded) {
				e.preventDefault()
				grecaptcha.ready(function () {
					grecaptcha.execute(googlePublicId, { action: 'submit' }).then(function (token) {
						if(token) {
							recaptchaNeeded = false
							form.insertAdjacentHTML('beforeend', `<input type="hidden" name="grt" value="${token}" />`)
							form.removeEventListener('submit', onSubmit)
							setTimeout(function() {
								if(form.requestSubmit) {
									form.requestSubmit()
								}
								else {
									form.submit()
								}
							}, 100)
						}
					}).catch(function(err) {
						console.log(err)
					})
				})
			}
		}
	}

	for(let form of forms) {
		form.addEventListener('submit', onSubmit)
	}
}
