// netlify/functions/login.js
export async function handler(event, context) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { username, password } = JSON.parse(event.body);

    // Hardcoded users (replace or expand)
    const users = [
      { username: 'walid', password: '7101991' },
      { username: 'omar', password: '1234' }
    ];

    const valid = users.some(u => u.username === username && u.password === password);

    if (valid) {
      return {
        statusCode: 200,
        body: JSON.stringify({ success: true })
      };
    } else {
      return {
        statusCode: 401,
        body: JSON.stringify({ success: false, message: 'اسم المستخدم أو كلمة المرور خاطئ' })
      };
    }
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ success: false, message: err.message }) };
  }
}
