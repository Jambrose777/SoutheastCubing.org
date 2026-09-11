// True if `comp`'s city is in one of the 6 states SECI tracks.
function isInSEState(comp) {
  return (
    !!comp.city &&
    (comp.city.includes(', Georgia') ||
      comp.city.includes(', Tennessee') ||
      comp.city.includes(', North Carolina') ||
      comp.city.includes(', South Carolina') ||
      comp.city.includes(', Alabama') ||
      comp.city.includes(', Florida'))
  );
}

module.exports = { isInSEState };
