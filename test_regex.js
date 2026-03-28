// Test regex patterns for reestimate
const tests = [
  'reestimate "Test new bot"',
  're-estimate "Test new bot"',
  'send back "Test new bot" for re-estimate',
  'send "Test new bot" back for re-estimate',
];

for (const lower of tests) {
  console.log('\nInput:', lower);
  console.log('  re-estimat regex:', /\bre[\s-]?estimat\w*/i.test(lower));
  console.log('  send..back regex:', /\bsend\b.{0,60}\bback\b/i.test(lower));
  console.log('  return regex:', /\b(return\s+(for|to)|revert|revision)\b/i.test(lower));
  console.log('  create regex:', /\b(create|add|new)\b/i.test(lower));
  const combined = (/\bre[\s-]?estimat\w*/i.test(lower) || /\bsend\b.{0,60}\bback\b/i.test(lower) || /\b(return\s+(for|to)|revert|revision)\b/i.test(lower)) && !(/\b(create|add|new)\b/i.test(lower));
  console.log('  FINAL match:', combined);
}
