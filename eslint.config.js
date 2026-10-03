const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  // .claude/worktrees enthält Arbeitskopien anderer Sitzungen, kein Projektcode.
  { ignores: ['dist/', '.expo/', 'node_modules/', '.claude/'] },
]);
