import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { woundSchemaStatements } from '../db/wound-schema.ts';

const coreMigration = readFileSync(
  new URL('../drizzle/0000_young_vertigo.sql', import.meta.url),
  'utf8',
);
const woundMigration = readFileSync(
  new URL('../drizzle/0001_chilly_deathbird.sql', import.meta.url),
  'utf8',
);
const woundTables = ['wound_cases', 'wound_assessments', 'ai_inferences'] as const;

function initializeWounds(database: DatabaseSync) {
  for (const statement of woundSchemaStatements) database.exec(statement);
}

function schema(database: DatabaseSync, table: string) {
  const indexes = database.prepare(`PRAGMA index_list(${table})`).all();
  return {
    columns: database.prepare(`PRAGMA table_info(${table})`).all(),
    foreignKeys: database.prepare(`PRAGMA foreign_key_list(${table})`).all(),
    indexes: indexes
      .map(({ name, unique, origin, partial }) => ({
        name,
        unique,
        origin,
        partial,
        columns: database.prepare(`PRAGMA index_info(${String(name)})`).all(),
      }))
      .sort((left, right) => String(left.name).localeCompare(String(right.name))),
  };
}

void test('cold-start wound schema matches the existing migration, including indexes and foreign keys', () => {
  const coldStart = new DatabaseSync(':memory:');
  const migrated = new DatabaseSync(':memory:');
  try {
    coldStart.exec(coreMigration);
    migrated.exec(coreMigration);
    migrated.exec(woundMigration);
    initializeWounds(coldStart);
    for (const table of woundTables) {
      assert.deepEqual(schema(coldStart, table), schema(migrated, table), table);
      assert.deepEqual(coldStart.prepare(`SELECT * FROM ${table}`).all(), []);
    }
  } finally {
    coldStart.close();
    migrated.close();
  }
});

void test('repeated initialization preserves an existing migrated wound record and its schema', () => {
  const database = new DatabaseSync(':memory:');
  try {
    database.exec(coreMigration);
    database.exec(woundMigration);
    database.exec(`
      INSERT INTO app_users(id, auth_subject, display_name, created_at, updated_at)
        VALUES ('qa-user', 'qa-subject', 'Synthetic QA', '2026-09-12', '2026-09-12');
      INSERT INTO patients(id, display_name, created_at, updated_at)
        VALUES ('qa-patient', 'Synthetic QA', '2026-09-12', '2026-09-12');
      INSERT INTO wound_cases(id, patient_id, label, body_location, wound_type,
        status, created_by_user_id, created_at, updated_at)
        VALUES ('qa-wound', 'qa-patient', 'Preserved synthetic record', 'foot',
          'other', 'active', 'qa-user', '2026-09-12', '2026-09-12');
    `);
    const before = database.prepare('SELECT * FROM wound_cases').all();
    const schemasBefore = woundTables.map((table) => schema(database, table));
    initializeWounds(database);
    initializeWounds(database);
    assert.deepEqual(database.prepare('SELECT * FROM wound_cases').all(), before);
    assert.deepEqual(woundTables.map((table) => schema(database, table)), schemasBefore);
    assert.deepEqual(database.prepare('PRAGMA foreign_key_check').all(), []);
  } finally {
    database.close();
  }
});
