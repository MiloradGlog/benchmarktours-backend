#!/usr/bin/env bash
# Smoke test for GDPR data subject rights:
#  (H-7) authenticated user data export completeness
#  (H-4) admin-only public/anonymous survey respondent export + erasure
#
# Requires: dev server (BASE, default :3001 per backend/.env), docker db container benchmarktours-db.
set -uo pipefail

BASE="${BASE:-http://localhost:3001}"   # dev server port (see backend/.env PORT)
DB="docker exec benchmarktours-db psql -U postgres -d benchmarktours"
U1_ID="5ad525ef-b7d6-487b-b8d3-4974979497d1"   # user1@test.com
PUB_EMAIL="dsar-public-tester@example.com"

FAILED=0
pass() { echo "PASS: $1"; }
fail() { echo "FAIL: $1"; FAILED=1; }

login() { # email password -> token
  curl -s -X POST "$BASE/api/auth/login" -H 'Content-Type: application/json' \
    -d "{\"email\":\"$1\",\"password\":\"$2\"}" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p'
}

echo "=== Seeding fixtures ==="
# Push token for user1 (idempotent on token unique)
$DB -q -c "INSERT INTO device_push_tokens (user_id, token, platform)
  VALUES ('$U1_ID', 'ExponentPushToken[gdpr-smoke-test]', 'ios')
  ON CONFLICT (token) DO NOTHING;" >/dev/null
# Message report by user1 (idempotent per message+reporter)
$DB -q -c "INSERT INTO message_reports (message_id, reporter_id, reason)
  VALUES (16, '$U1_ID', 'gdpr-smoke-test-reason')
  ON CONFLICT (message_id, reporter_id) DO NOTHING;" >/dev/null
# Activity review by user1
$DB -q -c "INSERT INTO activity_reviews (user_id, activity_id, rating, review_text)
  VALUES ('$U1_ID', 1, 5, 'gdpr-smoke-review')
  ON CONFLICT (user_id, activity_id) DO NOTHING;" >/dev/null
# Message reaction by user1
$DB -q -c "INSERT INTO message_reactions (message_id, user_id, reaction)
  VALUES (16, '$U1_ID', '👍')
  ON CONFLICT (message_id, user_id, reaction) DO NOTHING;" >/dev/null
# Shopping comment by user1
$DB -q -c "INSERT INTO shopping_item_comments (item_id, user_id, text)
  VALUES (2, '$U1_ID', 'gdpr-smoke-comment');" >/dev/null

# Public/anonymous survey response keyed by email.
# Need a survey to reference; create a throwaway one if none exists.
SURVEY_ID=$($DB -qtA -c "SELECT id FROM surveys ORDER BY id LIMIT 1;")
if [ -z "$SURVEY_ID" ]; then
  SURVEY_ID=$($DB -qtA -c "INSERT INTO surveys (title, type, status)
    VALUES ('GDPR Smoke Survey', 'CUSTOM', 'ACTIVE') RETURNING id;")
fi
# Clean any leftover public response for this email, then insert fresh
$DB -q -c "DELETE FROM survey_responses WHERE user_id IS NULL AND LOWER(respondent_email)=LOWER('$PUB_EMAIL');" >/dev/null
PUB_RESP_ID=$($DB -qtA -c "INSERT INTO survey_responses (survey_id, user_id, respondent_email, respondent_name, is_anonymous, is_complete, submitted_at)
  VALUES ($SURVEY_ID, NULL, '$PUB_EMAIL', 'Public Tester', TRUE, TRUE, NOW()) RETURNING id;")
# A child question-response (no question needed; question_id can be null? no, NOT NULL)
QID=$($DB -qtA -c "SELECT id FROM survey_questions WHERE survey_id=$SURVEY_ID ORDER BY id LIMIT 1;")
if [ -z "$QID" ]; then
  QID=$($DB -qtA -c "INSERT INTO survey_questions (survey_id, question_text, question_type, order_index)
    VALUES ($SURVEY_ID, 'Smoke question?', 'TEXT', 1) RETURNING id;")
fi
$DB -q -c "INSERT INTO survey_question_responses (response_id, question_id, text_response)
  VALUES ($PUB_RESP_ID, $QID, 'public answer');" >/dev/null
echo "Seeded survey_id=$SURVEY_ID public_response_id=$PUB_RESP_ID"

echo "=== Auth ==="
U1_TOKEN=$(login "user1@test.com" "User123!")
ADMIN_TOKEN=$(login "admin@test.com" "Admin123!")
[ -n "$U1_TOKEN" ] && pass "user1 login" || fail "user1 login"
[ -n "$ADMIN_TOKEN" ] && pass "admin login" || fail "admin login"

echo "=== (a) H-7 export completeness ==="
EXPORT=$(curl -s -w '\n%{http_code}' "$BASE/api/users/me/export" -H "Authorization: Bearer $U1_TOKEN")
CODE=$(echo "$EXPORT" | tail -1)
BODY=$(echo "$EXPORT" | sed '$d')
[ "$CODE" = "200" ] && pass "export returns 200" || fail "export status=$CODE"

for key in survey_responses activity_reviews message_reactions device_push_tokens shopping_comments message_reports; do
  if echo "$BODY" | grep -q "\"$key\""; then pass "export contains key: $key"; else fail "export missing key: $key"; fi
done

# Presence is real: seeded values must appear
echo "$BODY" | grep -q "ExponentPushToken\[gdpr-smoke-test\]" && pass "push token row present" || fail "push token row missing"
echo "$BODY" | grep -q "gdpr-smoke-test-reason" && pass "message_report reason present" || fail "message_report reason missing"
echo "$BODY" | grep -q "gdpr-smoke-review" && pass "activity_review row present" || fail "activity_review row missing"
echo "$BODY" | grep -q "gdpr-smoke-comment" && pass "shopping_comment row present" || fail "shopping_comment row missing"

echo "=== (b) no other user's email leaks ==="
for other in user2@test.com guide@test.com admin@test.com; do
  N=$(echo "$BODY" | grep -c "$other")
  [ "$N" -eq 0 ] && pass "no leak of $other" || fail "found $other ($N times)"
done

echo "=== (c) admin public-survey GET/DELETE/GET ==="
G1=$(curl -s "$BASE/api/admin/public-survey-data?email=$PUB_EMAIL" -H "Authorization: Bearer $ADMIN_TOKEN")
echo "$G1" | grep -q "$PUB_EMAIL" && pass "admin GET returns seeded public response" || fail "admin GET missing seeded response"
echo "$G1" | grep -q "public answer" && pass "admin GET includes child answer" || fail "admin GET missing child answer"

DEL=$(curl -s -X DELETE "$BASE/api/admin/public-survey-data?email=$PUB_EMAIL" -H "Authorization: Bearer $ADMIN_TOKEN")
echo "DELETE response: $DEL"
echo "$DEL" | grep -q '"deleted":1' && pass "admin DELETE removes 1 response" || fail "admin DELETE unexpected: $DEL"

G2=$(curl -s "$BASE/api/admin/public-survey-data?email=$PUB_EMAIL" -H "Authorization: Bearer $ADMIN_TOKEN")
if echo "$G2" | grep -q "$PUB_EMAIL"; then fail "public response still present after delete"; else pass "admin GET empty after delete"; fi
# Confirm cascade removed child rows
CHILD=$($DB -qtA -c "SELECT count(*) FROM survey_question_responses WHERE response_id=$PUB_RESP_ID;")
[ "$CHILD" = "0" ] && pass "cascade removed child question responses" || fail "child rows remain ($CHILD)"

# Missing email -> 400
MC=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/admin/public-survey-data" -H "Authorization: Bearer $ADMIN_TOKEN")
[ "$MC" = "400" ] && pass "missing email -> 400" || fail "missing email status=$MC"

echo "=== (d) non-admin gets 403 on admin endpoints ==="
NC1=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/admin/public-survey-data?email=$PUB_EMAIL" -H "Authorization: Bearer $U1_TOKEN")
NC2=$(curl -s -o /dev/null -w '%{http_code}' -X DELETE "$BASE/api/admin/public-survey-data?email=$PUB_EMAIL" -H "Authorization: Bearer $U1_TOKEN")
[ "$NC1" = "403" ] && pass "non-admin GET -> 403" || fail "non-admin GET status=$NC1"
[ "$NC2" = "403" ] && pass "non-admin DELETE -> 403" || fail "non-admin DELETE status=$NC2"

echo "=== Cleanup seeded fixtures ==="
$DB -q -c "DELETE FROM device_push_tokens WHERE token='ExponentPushToken[gdpr-smoke-test]';
  DELETE FROM message_reports WHERE reporter_id='$U1_ID' AND reason='gdpr-smoke-test-reason';
  DELETE FROM activity_reviews WHERE user_id='$U1_ID' AND review_text='gdpr-smoke-review';
  DELETE FROM message_reactions WHERE user_id='$U1_ID' AND reaction='👍' AND message_id=16;
  DELETE FROM shopping_item_comments WHERE user_id='$U1_ID' AND text='gdpr-smoke-comment';" >/dev/null

echo
if [ "$FAILED" -eq 0 ]; then echo "ALL PASS"; exit 0; else echo "SOME FAILED"; exit 1; fi
