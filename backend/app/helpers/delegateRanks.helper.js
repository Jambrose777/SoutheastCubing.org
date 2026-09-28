// WCA's delegate_status values map one-to-one onto our rank enum, except
// they carry a "_delegate" suffix we drop. `temporary` has no WCA
// equivalent at all.
const WCA_STATUS_TO_RANK = {
  trainee_delegate: 'trainee',
  junior_delegate: 'junior',
  delegate: 'delegate',
  senior_delegate: 'senior',
  regional_delegate: 'regional',
};

// The personal-rank track's own WCA status strings - trainee/junior/
// delegate are mutually exclusive (WCA reports at most one at a time),
// unlike Regional/Senior which can be concurrently open alongside a
// personal rank.
const PERSONAL_RANK_STATUSES = ['trainee_delegate', 'junior_delegate', 'delegate'];

// The same track, in our own rank-enum vocabulary - derived from
// PERSONAL_RANK_STATUSES/WCA_STATUS_TO_RANK above rather than a second,
// separately-maintained list, so the two can never drift apart.
const PERSONAL_RANKS = PERSONAL_RANK_STATUSES.map((status) => WCA_STATUS_TO_RANK[status]);

module.exports = { WCA_STATUS_TO_RANK, PERSONAL_RANK_STATUSES, PERSONAL_RANKS };
