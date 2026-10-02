async function assertCaptcha(token) {
  const secret = process.env.RECAPTCHA_SECRET_KEY;
  if (!secret) {
    const error = new Error('Captcha is not configured on the server');
    error.status = 503;
    throw error;
  }
  if (!token) {
    const error = new Error('Complete the captcha');
    error.status = 400;
    throw error;
  }

  const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ secret, response: token }),
  });
  const data = await response.json();
  if (!data.success) {
    const error = new Error('Captcha check failed. Try again.');
    error.status = 400;
    throw error;
  }
}

module.exports = assertCaptcha;
