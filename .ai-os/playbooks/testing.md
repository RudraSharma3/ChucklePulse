# Testing Playbook

Follow this playbook to design, execute, and verify automated tests and validate system changes under the **Tester** role.

---

## 1. Test Planning & Falsification Strategy

1. Read the task goal, acceptance criteria, and implementation diff.
2. Formulate test hypotheses to deliberately falsify the changes (find where it breaks).
3. Identify:
   - Happy paths (nominal cases)
   - Edge cases (null/empty inputs, boundary values, concurrent access, timeouts)
   - Error paths (invalid inputs, network drops, permission errors)
   - Regression risks (unrelated modules that could be impacted)

## 2. Implement Automated Tests

1. Place tests in established test directories following project naming conventions.
2. Structure tests clearly using Arrange-Act-Assert (AAA):
   - **Arrange**: Set up fixtures, mocks, or initial state cleanly.
   - **Act**: Execute the specific behavior under test.
   - **Assert**: Validate outputs, state changes, and error codes explicitly.
3. Keep tests isolated, deterministic, and fast.

## 3. Run and Verify Suite

1. Run the targeted test suite first to confirm behavior.
2. Run the full test suite, linter, and static analysis tools.
3. Check code coverage for modified lines if coverage tooling is configured.

## 4. Report Test Results

1. Summarize:
   - Commands executed
   - Test outcomes (passed, failed, skipped)
   - Edge cases tested
   - Remaining unverified areas or environments
