# Governance Fairness Checks

The governance validator (`security/governance_validator.js`) enforces baseline fairness rules:

- Thresholds must be strictly increasing: `low < medium < high < critical`.
- Governance actions must declare a valid priority and a positive cooldown.
- Alert levels must align with the supported priority set.

These checks run automatically during server start-up and inside the policy self-healing harness (`scripts/policy_self_heal.js`). Validation issues are logged as warnings, enabling operators to correct configuration drift before deploying to production.
