# spir-lab-manager — notes for Claude

## Pending suggestion for the next session (deferred by the user)

At the start of the next session, **suggest** (do not implement without approval)
auto-calculated derived tests in the Lab Station (`/station`), computed from other
results as they are entered:

- Indirect Bilirubin = Total Bilirubin − Direct Bilirubin
- Globulin = Total Protein − Albumin
- VLDL = Triglycerides ÷ 5
- LDL (Friedewald) = Total Cholesterol − HDL − VLDL
- BUN = Urea ÷ 2.14
- HOMA-IR = Fasting Glucose (mg/dL) × Fasting Insulin ÷ 405

The user explicitly declined prebuilt test panels (باقات) — do not re-suggest them.
Once the suggestion has been made, remove this section.
