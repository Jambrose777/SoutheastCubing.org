// Derives Planner status from a competition's WCA link and announcement fields.
function derivePlannerStatus(comp) {
  if (!comp.wca_competition_id) return 'potential';
  return comp.is_announced ? 'announced' : 'planning';
}

module.exports = { derivePlannerStatus };