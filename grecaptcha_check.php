<?php
if (!function_exists('grecaptcha_check')) {
	function grecaptcha_check($privateKey, $token)
	{
		$ch = curl_init("https://www.google.com/recaptcha/api/siteverify");

		curl_setopt($ch, CURLOPT_HEADER, 0);
		curl_setopt($ch, CURLOPT_POST, 1);
		curl_setopt(
			$ch,
			CURLOPT_POSTFIELDS,
			http_build_query(array('secret' => $privateKey, 'response' => $token))
		);

		curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
		$result = curl_exec($ch);
		if (curl_error($ch)) {
			echo "error" . curl_error($ch);
		}
		// echo $result;
		curl_close($ch);
		return $result;
	}
}