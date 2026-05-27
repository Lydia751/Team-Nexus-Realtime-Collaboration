
const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../src/app'); 
const User = require('../../src/models/User'); 
const jwt = require('jsonwebtoken');


// Test room cleanup
beforeEach(async () => {
  await User.deleteMany({});
});

describe('Certification API', () => {
  describe('POST /api/signup', () => {
    test('A new user should be created', async () => {
      const userData = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'Password123!'
      };

      const response = await request(app)
        .post('/api/signup')
        .send(userData)
        .expect(201);

      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('message', 'User created successfully');
      expect(response.body.user).toHaveProperty('email', userData.email);
      expect(response.body.user).toHaveProperty('name', userData.name);

      // Verify that the user is saved to the database
      const savedUser = await User.findOne({ email: userData.email });
      expect(savedUser).not.toBeNull();
      expect(savedUser.name).toBe(userData.name);
    });

    test('Strong passwords should be required', async () => {
      const userData = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'weak'
      };

      const response = await request(app)
        .post('/api/signup')
        .send(userData)
        .expect(400);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('Password must be');
    });
  });

  describe('POST /api/login', () => {
    beforeEach(async () => {
      // Create a test user for login testing
      const testUser = new User({
        name: 'Login User',
        email: 'login@example.com',
        password: await require('bcryptjs').hash('Password123!', 10)
      });
      await testUser.save();
    });

    test('The user should be logged in with the correct credentials', async () => {
      const loginData = {
        email: 'login@example.com',
        password: 'Password123!'
      };

      const response = await request(app)
        .post('/api/login')
        .send(loginData)
        .expect(200);

      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('message', 'Login successful');
      expect(response.body.user).toHaveProperty('email', loginData.email);
    });

    test('Login should be denied using incorrect password', async () => {
      const loginData = {
        email: 'login@example.com',
        password: 'WrongPassword123!'
      };

      const response = await request(app)
        .post('/api/login')
        .send(loginData)
        .expect(401);

      expect(response.body).toHaveProperty('message', 'Invalid email or password');
    });
  });
});