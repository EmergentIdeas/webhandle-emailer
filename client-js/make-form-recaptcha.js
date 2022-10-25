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
	let $ = window.jQuery
	let $form = $(formSelector)
	$.getScript('https://www.google.com/recaptcha/api.js?render=' + googlePublicId)
	function onSubmit(e) {
		let self = this
		if(grecaptcha && googlePublicId) {
			if(recaptchaNeeded) {
				e.preventDefault()
				grecaptcha.ready(function () {
					grecaptcha.execute(googlePublicId, { action: 'submit' }).then(function (token) {
						if(token) {
							recaptchaNeeded = false
							$form.append('<input type="hidden" name="grt" />')
							$('input[name=grt]').val(token)
							$form.off('submit', onSubmit)
							setTimeout(function() {
								$form.trigger('submit')
							}, 100)
						}
					}).catch(function(err) {
						console.log(err)
					})
				})
			}
		}
	}

	$form.on('submit', onSubmit)
}
