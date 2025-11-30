import '@testing-library/jest-dom';
import { TextEncoder, TextDecoder } from 'util';

// Add TextEncoder/TextDecoder for Stellar SDK
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Mock window.crypto for Node.js environment
if (typeof window !== 'undefined' && !window.crypto) {
  const crypto = require('crypto');
  window.crypto = {
    getRandomValues: (arr) => crypto.randomBytes(arr.length),
  };
}

// Mock localStorage for tests
const localStorageMock = {
  store: {},
  getItem: jest.fn((key) => localStorageMock.store[key] || null),
  setItem: jest.fn((key, value) => {
    localStorageMock.store[key] = value;
  }),
  removeItem: jest.fn((key) => {
    delete localStorageMock.store[key];
  }),
  clear: jest.fn(() => {
    localStorageMock.store = {};
  }),
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Reset localStorage mock before each test
beforeEach(() => {
  localStorageMock.store = {};
  jest.clearAllMocks();
});

// Mock fetch globally
global.fetch = jest.fn();

// Reset fetch mock before each test
beforeEach(() => {
  global.fetch.mockReset();
});

// Suppress console.error for cleaner test output (optional)
// Uncomment if needed:
// const originalError = console.error;
// beforeAll(() => {
//   console.error = jest.fn();
// });
// afterAll(() => {
//   console.error = originalError;
// });
