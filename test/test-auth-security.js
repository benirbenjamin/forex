const assert = require('assert');
const { registerUser, loginUser, verifyEmail } = require('../lib/auth');
const db = require('../lib/db');

async function testAuth() {
  console.log('🔒 Testing Authentication & Verification Security...');
  await db.initDatabase();

  // 1. Register a new user (unverified by default)
  const reg = await registerUser({
    fullName: 'Test Unverified',
    email: 'unverified.trader@example.com',
    phone: '+250789999001',
    password: 'Password123!',
    confirmPassword: 'Password123!',
    deviceFingerprint: 'fp_test_unverified_99'
  });
  console.log('✅ Registered unverified user:', reg.user.email);

  // 2. Attempt login with unverified user -> MUST FAIL with 403 / unverified: true
  let loginBlocked = false;
  try {
    await loginUser({
      email: 'unverified.trader@example.com',
      password: 'Password123!',
      deviceFingerprint: 'fp_test_unverified_99'
    });
  } catch (err) {
    if (err.statusCode === 403 && err.unverified === true) {
      loginBlocked = true;
      console.log('✅ Unverified login properly blocked with 403:', err.message);
    } else {
      console.error('Unexpected error on unverified login:', err);
    }
  }
  assert(loginBlocked, 'Unverified users must be strictly blocked from logging in!');

  // 3. Verify user with verification code
  const code = reg.verificationCode;
  const verified = await verifyEmail('unverified.trader@example.com', code);
  assert(verified.verified, 'Email verification must succeed with correct code');
  console.log('✅ Email successfully verified with code:', code);

  // 4. Now login -> MUST SUCCEED
  const userLogin = await loginUser({
    email: 'unverified.trader@example.com',
    password: 'Password123!',
    deviceFingerprint: 'fp_test_unverified_99'
  });
  assert(userLogin.token, 'Verified user must receive JWT token');
  console.log('✅ Verified user logged in successfully, role:', userLogin.user.role);

  // 5. Test Admin Login: benirabok@gmail.com
  const superAdminLogin = await loginUser({
    email: 'benirabok@gmail.com',
    password: '1202!birthDATE',
    deviceFingerprint: 'admin_fp_1'
  });
  assert(superAdminLogin.user.role === 'superadmin', 'benirabok@gmail.com must have role superadmin');
  console.log('✅ benirabok@gmail.com logged in successfully with role: superadmin');

  // 6. Test Admin Login: omarrukwaya@gmail.com
  const adminLogin = await loginUser({
    email: 'omarrukwaya@gmail.com',
    password: 'Onlineboss1#$',
    deviceFingerprint: 'admin_fp_2'
  });
  assert(adminLogin.user.role === 'admin', 'omarrukwaya@gmail.com must have role admin');
  console.log('✅ omarrukwaya@gmail.com logged in successfully with role: admin');

  // 7. Wrong password test
  let wrongPassCaught = false;
  try {
    await loginUser({
      email: 'benirabok@gmail.com',
      password: 'wrongPassword123!',
      deviceFingerprint: 'admin_fp_1'
    });
  } catch (err) {
    wrongPassCaught = true;
    console.log('✅ Wrong password correctly rejected:', err.message);
  }
  assert(wrongPassCaught, 'Wrong password must be rejected');

  console.log('\n🎉 ALL AUTHENTICATION & SECURITY TESTS PASSED!\n');
  process.exit(0);
}

testAuth().catch(err => {
  console.error('❌ Auth test failed:', err);
  process.exit(1);
});
