'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const T = require('../js/trails.js');
const D = require('../js/data.js');
// The site's catalog.js, one level above the cabinet (kids-ai-cabinet/ inside the site). The cabinet repo on its own
// has no catalog: then a tiny stand-in with the same shape is used, so the tests still run.
let CATALOG;
try { CATALOG = require('../../catalog.js'); } catch (e) {
  const COURSES = [[6, 8, 'explorers', 20], [9, 11, 'inventors', 21], [12, 14, 'creators', 22], [15, 17, 'pros', 24]].map(([a, b, t, n]) => (
    { id: 'ai-' + t, title: 'Trail ' + t, ages: [a, b], lessons: n, url: 'ai-trails/?track=' + t }));
  CATALOG = {
    COURSES, courseAges: (c) => 'Ages ' + c.ages[0] + '-' + c.ages[1],
    coursesForAge: (age) => COURSES.filter((c) => c.ages[0] <= age && age <= c.ages[1])
  };
}

const TRACKS = ['explorers', 'inventors', 'creators', 'pros'];
const store = (obj) => ({ getItem: (k) => (k in obj ? obj[k] : null) });
const group = (age) => D.AGE_GROUPS.find((g) => age >= g.min && age <= g.max).id;

describe('trail per age', () => {
  test('ages 6-17 each get the right track, link and catalog course', () => {
    for (let age = 6; age <= 17; age++) {
      const track = TRACKS[D.AGE_GROUPS.findIndex((g) => g.id === group(age))];
      const v = T.view(group(age), CATALOG, store({}), '../');
      assert.equal(v.track, track, 'age ' + age);
      assert.equal(v.href, '../ai-trails/?track=' + track);
      assert.equal(v.course.id, CATALOG.coursesForAge(age)[0].id);
      assert.equal(v.lessons, v.course.lessons);
      assert.ok(v.line && v.line.length < 160, 'kid line is short');
    }
  });
  test('old group id 14-17 reads as Pros; unknown id gives nothing', () => {
    assert.equal(T.view('14-17', CATALOG, store({}), '').track, 'pros');
    assert.equal(T.view('', CATALOG, store({}), ''), null);
  });
  test('without the catalog the card still has a working link', () => {
    const v = T.view('9-11', null, store({}), '../');
    assert.equal(v.href, '../ai-trails/?track=inventors');
    assert.equal(v.progress.total, 0);
  });
  test('kid lines promise no live AI chat or videos', () => {
    for (const line of Object.values(T.KID_LINE)) assert.doesNotMatch(line, /\b(chat|video|live)/i);
  });
});

describe('progress from the trail state', () => {
  test('nothing saved, broken JSON or no storage = 0', () => {
    assert.equal(T.progress(store({}), 'inventors', 21).done, 0);
    assert.equal(T.progress(store({ 'sevalumo-trail-inventors': '{oops' }), 'inventors', 21).done, 0);
    assert.equal(T.progress({ getItem() { throw new Error('blocked'); } }, 'inventors', 21).done, 0);
  });
  test('counts passed lessons, skips unpassed and mini-boss/boss stations', () => {
    const s = { lessons: { i11: { stars: 3 }, i12: { stars: 1 }, i13: { stars: 0 }, i1x: { stars: 2 }, boss: { stars: 3 } } };
    const p = T.progress(store({ 'sevalumo-trail-inventors': JSON.stringify(s) }), 'inventors', 21);
    assert.deepEqual(p, { done: 2, total: 21, percent: 10 });
  });
  test('reads the key of its own track only', () => {
    const st = store({ 'sevalumo-trail-pros': JSON.stringify({ lessons: { p1: { stars: 2 } } }) });
    assert.equal(T.progress(st, 'creators', 22).done, 0);
    assert.equal(T.progress(st, 'pros', 24).done, 1);
  });
  test('view: Play at 0, Continue with progress, finished at all lessons', () => {
    const mk = (n) => { const l = {}; for (let i = 0; i < n; i++) l['e' + i] = { stars: 1 }; return store({ 'sevalumo-trail-explorers': JSON.stringify({ lessons: l }) }); };
    assert.equal(T.view('6-8', CATALOG, mk(0), '').started, false);
    const mid = T.view('6-8', CATALOG, mk(5), '');
    assert.equal(mid.started, true); assert.equal(mid.progress.done, 5); assert.equal(mid.finished, false);
    assert.equal(T.view('6-8', CATALOG, mk(20), '').finished, true);
    assert.equal(T.view('6-8', CATALOG, mk(99), '').progress.done, 20, 'capped at the course total');
  });
});

describe('age row and page', () => {
  test('four links to the four trails, only the own group marked', () => {
    for (const g of D.AGE_GROUPS) {
      const row = T.allGroups(D.AGE_GROUPS, g.id, '../');
      assert.deepEqual(row.map((r) => r.href), TRACKS.map((t) => '../ai-trails/?track=' + t));
      assert.deepEqual(row.filter((r) => r.own).map((r) => r.id), [g.id]);
    }
    assert.equal(T.allGroups(D.AGE_GROUPS, '14-17', '').filter((r) => r.own)[0].id, '15-17');
  });
  test('the old per-course cards are gone: one trail card, no site-course markup, no old catalog name', () => {
    const app = fs.readFileSync(path.join(__dirname, '../js/app.js'), 'utf8');
    assert.doesNotMatch(app, /site-course|siteCourses|BLOOP_CATALOG/);
    assert.equal((app.match(/class="trail"/g) || []).length, 1);
    assert.match(app, /SEVALUMO_CATALOG/);
  });
  test('catalog has exactly one course per age group, so a group never shows two trail cards', () => {
    for (let age = 6; age <= 17; age++) assert.equal(CATALOG.coursesForAge(age).length, 1);
  });
});
