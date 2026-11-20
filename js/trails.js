'use strict';

// AI Trails in the cabinet: pure logic (no DOM). Which trail belongs to which age group, the kid line per age,
// the links and the progress read from the trail's own saved state. app.js draws it.
// The trail runs on the school site (ai-trails/) and keeps its state in the same browser storage under
// 'sevalumo-trail-<track>' (ai-trails/core.js progressKey): { lessons: { <lessonId>: { stars, ... } }, ... }.
var Trails = (function () {
  var TRACKS = { '6-8': 'explorers', '9-11': 'inventors', '12-14': 'creators', '15-17': 'pros' };
  var LEGACY = { '14-17': '15-17' };

  // What the kid reads on the card. Short, no promise of live AI chat or videos.
  var KID_LINE = {
    explorers: 'Come and play in Helper Town with Sevi! Everything is read out loud, so you do not need to type. A grown-up can play too.',
    inventors: 'Run experiments in Sevi’s lab. Find out how AI learns, why it can be wrong, and how to ask it clearly.',
    creators: 'See how AI really works under the hood. Try it, break it, and learn to check what it tells you.',
    pros: 'Use AI as a study partner, not a ghostwriter. Real skills for school and your own projects.'
  };

  function trackFor(groupId) { return TRACKS[LEGACY[groupId] || groupId] || null; }
  function trailUrl(track, siteUrl) { return (siteUrl || '') + 'ai-trails/?track=' + track; }

  // Check, mini-boss and boss stations are not counted as lessons (the catalog counts the same way).
  var TEST_ID = /^(boss|mb\d+|m\d+|i\dx)$/;

  // storage: anything with getItem (localStorage or a stub). total: lessons of the course from the catalog.
  function progress(storage, track, total) {
    var done = 0;
    try {
      var s = JSON.parse(storage.getItem('sevalumo-trail-' + track));
      var l = s && s.lessons;
      if (l && typeof l === 'object') {
        Object.keys(l).forEach(function (id) {
          if (!TEST_ID.test(id) && l[id] && l[id].stars > 0) done++;
        });
      }
    } catch (e) { /* no storage or broken JSON: nothing done */ }
    if (total) done = Math.min(done, total);
    return { done: done, total: total || 0, percent: total ? Math.round(done / total * 100) : 0 };
  }

  // The trail card for one age group. catalog = SEVALUMO_CATALOG (may be missing: offline or not deployed yet).
  function view(groupId, catalog, storage, siteUrl) {
    var track = trackFor(groupId);
    if (!track) return null;
    var course = null;
    if (catalog) {
      course = catalog.COURSES.filter(function (c) { return c.url === 'ai-trails/?track=' + track; })[0] || null;
    }
    var p = progress(storage, track, course ? course.lessons : 0);
    return {
      track: track,
      course: course,
      title: course ? course.title : 'AI Trail',
      ages: course ? catalog.courseAges(course) : '',
      lessons: course ? course.lessons : 0,
      line: KID_LINE[track],
      href: trailUrl(track, siteUrl),
      progress: p,
      started: p.done > 0,
      finished: p.total > 0 && p.done >= p.total
    };
  }

  // The four age groups as links; the child's own is marked. groups = AGE_GROUPS of data.js.
  function allGroups(groups, ownId, siteUrl) {
    var own = LEGACY[ownId] || ownId;
    return groups.map(function (g) {
      var track = trackFor(g.id);
      return { id: g.id, name: g.name, ages: g.min + '-' + g.max, track: track, href: trailUrl(track, siteUrl), own: g.id === own };
    });
  }

  var api = { TRACKS: TRACKS, KID_LINE: KID_LINE, trackFor: trackFor, trailUrl: trailUrl, progress: progress, view: view, allGroups: allGroups };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  return api;
})();
