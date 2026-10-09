-- Adds a cumulative spend cap to missions.
--
-- Before this, max_amount was enforced per-request only, so an agent could spend
-- unlimited money in under-the-limit chunks (e.g. 3x $24 against a "$25" mission).
-- total_budget caps the sum of all completed spend for the mission's lifetime.

alter table missions
  add column if not exists total_budget numeric(12, 2);

-- Existing missions had no cumulative cap; treat their per-request cap as the
-- total so they stop being unbounded.
update missions set total_budget = max_amount where total_budget is null;

alter table missions
  alter column total_budget set not null;

-- Spend is summed from this column, so it must be indexed for the budget check.
create index if not exists requests_mission_paypal_status_idx
  on requests(mission_id, paypal_status);
