#!/usr/bin/env node
'use strict';
/**
 * Lane E1: converts the owner's input file (docs/v3/inputs/REQ_CATEGORY_MASTER_45_FAMILIES.md) into the committed data file backend-api/data/category-master-45.json.
 * Deterministic: the same input always gives the same bytes. Vocabulary: Family (45) > Category (1,213 unique) > Service (lane E4).
 *   node scripts/gen-category-master-45.js          writes data/category-master-45.json
 *   node scripts/gen-category-master-45.js --check  exits 1 if the committed file differs from what the input gives
 * The pure parser is in scripts/lib/category-master-45-lib.js so the tests can use it.
 */
const fs = require('fs');
const path = require('path');
const { parseInput, buildMaster } = require('./lib/category-master-45-lib');

const INPUT = path.resolve(__dirname, '..', '..', 'docs', 'v3', 'inputs', 'REQ_CATEGORY_MASTER_45_FAMILIES.md');
const OUT = path.resolve(__dirname, '..', 'data', 'category-master-45.json');
const text = JSON.stringify(buildMaster(parseInput(fs.readFileSync(INPUT, 'utf8'))), null, 1) + '\n';
if (process.argv.includes('--check')) {
  const same = fs.existsSync(OUT) && fs.readFileSync(OUT, 'utf8') === text;
  console.log(same ? 'category-master-45.json is up to date.' : 'category-master-45.json DIFFERS from the input file.');
  process.exitCode = same ? 0 : 1;
} else { fs.writeFileSync(OUT, text); console.log(`wrote ${path.relative(process.cwd(), OUT)}`); }
