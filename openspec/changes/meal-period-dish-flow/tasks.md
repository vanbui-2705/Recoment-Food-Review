## 1. Meal-period recommendation contract

- [x] 1.1 Add deterministic client mapping from local hour to breakfast, lunch or dinner and send it when loading/refreshing recommendations.
- [x] 1.2 Extend the recommendation-today backend contract and food service to filter catalog dishes by the requested meal period without mutating the saved profile.
- [x] 1.3 Add backend and frontend tests for meal-period request and filtering behavior.

## 2. Dish-first discovery flow

- [x] 2.1 Stop loading and rendering the independent nearby-restaurant list on the main discovery screen.
- [x] 2.2 Make every visible dish/recipe card open the restaurant search flow while preserving final-confirmation-only cooldown behavior.
- [x] 2.3 Keep dish images and honest personalization copy, and add desktop/mobile tests proving restaurants are absent before dish selection.

## 3. Verification and rollout

- [x] 3.1 Run backend typecheck/tests and frontend build/Playwright regression tests.
- [x] 3.2 Validate the OpenSpec change, rebuild Docker services and smoke test the flow through port 8081.
