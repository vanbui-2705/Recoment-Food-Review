ALTER TABLE discovery_settings DROP CONSTRAINT discovery_settings_bounds;
ALTER TABLE discovery_settings ADD CONSTRAINT discovery_settings_bounds CHECK (
  budget BETWEEN 1000 AND 100000000 AND radius BETWEEN 3000 AND 4000 AND
  ((latitude IS NULL AND longitude IS NULL) OR
   (latitude IS NOT NULL AND longitude IS NOT NULL AND latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180))
);
ALTER TABLE recommendation_requests ADD CONSTRAINT recommendation_processing_state CHECK (
  processing_state IN ('IN_PROGRESS', 'COMPLETED', 'FAILED') AND
  ((processing_state = 'IN_PROGRESS' AND lease_until IS NOT NULL AND lease_token IS NOT NULL) OR
   (processing_state IN ('COMPLETED', 'FAILED') AND lease_until IS NULL AND lease_token IS NULL))
);
ALTER TABLE recommendation_results ADD CONSTRAINT recommendation_offer_price CHECK (price IS NULL OR price BETWEEN 0 AND 100000000);
CREATE INDEX recommendation_requests_processing_state_lease_until_idx ON recommendation_requests(processing_state, lease_until);
CREATE UNIQUE INDEX recommendation_results_request_id_offer_id_key ON recommendation_results(request_id, offer_id);
