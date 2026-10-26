import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeEmergencyContact,
  formatEmergencyContact,
  hasEmergencyContact,
  DEFAULT_EMERGENCY_CONTACT
} from '../src/utils/emergencyContact.js';

describe('Emergency Contact Normalization (normalizeEmergencyContact)', () => {
  describe('Empty, Missing, and Null Cases', () => {
    test('handles undefined', () => {
      assert.deepEqual(normalizeEmergencyContact(undefined), DEFAULT_EMERGENCY_CONTACT);
    });

    test('handles null', () => {
      assert.deepEqual(normalizeEmergencyContact(null), DEFAULT_EMERGENCY_CONTACT);
    });

    test('handles empty string', () => {
      assert.deepEqual(normalizeEmergencyContact(''), DEFAULT_EMERGENCY_CONTACT);
    });

    test('handles whitespace only', () => {
      assert.deepEqual(normalizeEmergencyContact('   '), DEFAULT_EMERGENCY_CONTACT);
    });

    test('handles empty array', () => {
      assert.deepEqual(normalizeEmergencyContact([]), DEFAULT_EMERGENCY_CONTACT);
    });

    test('handles empty object', () => {
      assert.deepEqual(normalizeEmergencyContact({}), DEFAULT_EMERGENCY_CONTACT);
    });
  });

  describe('Standard Object Cases', () => {
    test('preserves valid structured object', () => {
      const input = { name: 'Jane Doe', relation: 'Spouse', phone: '+1 (555) 019-2831' };
      assert.deepEqual(normalizeEmergencyContact(input), input);
    });

    test('trims whitespace in object properties', () => {
      const input = { name: '  Jane Doe  ', relation: ' Mother ', phone: ' 555-1234 ' };
      assert.deepEqual(normalizeEmergencyContact(input), {
        name: 'Jane Doe',
        relation: 'Mother',
        phone: '555-1234'
      });
    });

    test('handles alternative field names (contactName, relationship, phoneNumber)', () => {
      const input = { contactName: 'Bob Smith', relationship: 'Brother', phoneNumber: '555-8888' };
      assert.deepEqual(normalizeEmergencyContact(input), {
        name: 'Bob Smith',
        relation: 'Brother',
        phone: '555-8888'
      });
    });

    test('handles missing partial fields in object gracefully', () => {
      assert.deepEqual(normalizeEmergencyContact({ name: 'Jane Doe' }), {
        name: 'Jane Doe',
        relation: '',
        phone: ''
      });
      assert.deepEqual(normalizeEmergencyContact({ phone: '555-9999' }), {
        name: '',
        relation: '',
        phone: '555-9999'
      });
    });
  });

  describe('Legacy String Format Cases', () => {
    test('parses name and phone from standard string "Jane Doe 555-123-4567"', () => {
      const result = normalizeEmergencyContact('Jane Doe 555-123-4567');
      assert.equal(result.name, 'Jane Doe');
      assert.equal(result.phone, '555-123-4567');
      assert.equal(result.relation, '');
    });

    test('parses name, relation, and phone with parentheses "Jane Doe (Spouse) +1 555-019-2831"', () => {
      const result = normalizeEmergencyContact('Jane Doe (Spouse) +1 555-019-2831');
      assert.equal(result.name, 'Jane Doe');
      assert.equal(result.relation, 'Spouse');
      assert.equal(result.phone, '+1 555-019-2831');
    });

    test('parses comma-separated string "Jane Doe, Sister, 555-9999"', () => {
      const result = normalizeEmergencyContact('Jane Doe, Sister, 555-9999');
      assert.equal(result.name, 'Jane Doe');
      assert.equal(result.relation, 'Sister');
      assert.equal(result.phone, '555-9999');
    });

    test('parses string with only phone number "+1 (555) 902-1100"', () => {
      const result = normalizeEmergencyContact('+1 (555) 902-1100');
      assert.equal(result.name, '');
      assert.equal(result.phone, '+1 (555) 902-1100');
    });

    test('parses string with only name "Dr. John Watson"', () => {
      const result = normalizeEmergencyContact('Dr. John Watson');
      assert.equal(result.name, 'Dr. John Watson');
      assert.equal(result.phone, '');
      assert.equal(result.relation, '');
    });
  });

  describe('Array of Contacts (Multi-contact cases)', () => {
    test('normalizes first item when given an array of contacts', () => {
      const list = [
        { name: 'Primary Contact', relation: 'Spouse', phone: '555-1111' },
        { name: 'Secondary Contact', relation: 'Friend', phone: '555-2222' }
      ];
      assert.deepEqual(normalizeEmergencyContact(list), {
        name: 'Primary Contact',
        relation: 'Spouse',
        phone: '555-1111'
      });
    });

    test('handles array of legacy strings', () => {
      const list = ['Alice (Mother) 555-4321', 'Bob (Brother) 555-6789'];
      assert.deepEqual(normalizeEmergencyContact(list), {
        name: 'Alice',
        relation: 'Mother',
        phone: '555-4321'
      });
    });
  });

  describe('Formatting and Helper Functions', () => {
    test('formatEmergencyContact formats full contact into single line', () => {
      assert.equal(
        formatEmergencyContact({ name: 'Jane Doe', relation: 'Spouse', phone: '555-1234' }),
        'Jane Doe (Spouse) 555-1234'
      );
    });

    test('formatEmergencyContact handles contact without relation', () => {
      assert.equal(
        formatEmergencyContact({ name: 'Jane Doe', relation: '', phone: '555-1234' }),
        'Jane Doe 555-1234'
      );
    });

    test('hasEmergencyContact correctly identifies populated contact', () => {
      assert.equal(hasEmergencyContact({ name: 'Jane', phone: '' }), true);
      assert.equal(hasEmergencyContact({ name: '', phone: '555-1234' }), true);
      assert.equal(hasEmergencyContact({ name: '', relation: '', phone: '' }), false);
      assert.equal(hasEmergencyContact(null), false);
    });
  });
});
