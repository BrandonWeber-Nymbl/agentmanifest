#!/usr/bin/env node

import { validateManifest } from './index';

const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function colorize(text: string, color: keyof typeof COLORS): string {
  return `${COLORS[color]}${text}${COLORS.reset}`;
}

function printBanner() {
  console.log(
    colorize('\n╔═══════════════════════════════════════════╗', 'cyan')
  );
  console.log(
    colorize('║   AgentManifest Validator v0.1          ║', 'cyan')
  );
  console.log(
    colorize('╚═══════════════════════════════════════════╝\n', 'cyan')
  );
}

function printUsage() {
  console.log('Usage:');
  console.log('  npx agentmanifest validate <url>');
  console.log('  agentmanifest validate <url>\n');
  console.log('Examples:');
  console.log('  npx agentmanifest validate https://api.example.com');
  console.log('  npx agentmanifest validate api.example.com\n');
}

function getSeverityIcon(severity: string): string {
  switch (severity) {
    case 'error':
      return '✖';
    case 'warning':
      return '⚠';
    case 'info':
      return '✓';
    default:
      return '·';
  }
}

function getSeverityColor(severity: string): keyof typeof COLORS {
  switch (severity) {
    case 'error':
      return 'red';
    case 'warning':
      return 'yellow';
    case 'info':
      return 'green';
    default:
      return 'reset';
  }
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    printBanner();
    printUsage();
    process.exit(0);
  }

  const command = args[0];
  const url = args[1];

  if (command !== 'validate') {
    console.error(colorize('Error: Unknown command', 'red'));
    printUsage();
    process.exit(1);
  }

  if (!url) {
    console.error(colorize('Error: URL is required', 'red'));
    printUsage();
    process.exit(1);
  }

  printBanner();
  console.log(colorize(`Validating: ${url}\n`, 'bright'));

  try {
    const result = await validateManifest(url);

    // Print checks
    console.log(colorize('Validation Checks:', 'bright'));
    console.log(colorize('─'.repeat(50), 'cyan'));

    for (const check of result.checks) {
      const icon = getSeverityIcon(check.severity);
      const color = getSeverityColor(check.severity);
      const status = check.passed ? 'PASS' : 'FAIL';

      console.log(
        `${colorize(icon, color)} ${colorize(
          `[${status}]`,
          color
        )} ${check.name}`
      );
      console.log(`  ${check.message}`);
    }

    console.log(colorize('\n─'.repeat(50), 'cyan'));

    // Print summary
    const errorCount = result.checks.filter(
      (c) => !c.passed && c.severity === 'error'
    ).length;
    const warningCount = result.checks.filter(
      (c) => !c.passed && c.severity === 'warning'
    ).length;

    console.log(colorize('\nValidation Summary:', 'bright'));
    console.log(colorize('─'.repeat(50), 'cyan'));
    console.log(`URL: ${result.url}`);
    console.log(`Spec Version: ${result.spec_version || 'unknown'}`);
    console.log(`Validated At: ${result.validated_at}`);
    console.log(
      `Status: ${colorize(
        result.passed ? 'PASSED ✓' : 'FAILED ✖',
        result.passed ? 'green' : 'red'
      )}`
    );

    if (errorCount > 0) {
      console.log(colorize(`Errors: ${errorCount}`, 'red'));
    }
    if (warningCount > 0) {
      console.log(colorize(`Warnings: ${warningCount}`, 'yellow'));
    }

    if (result.verification_token) {
      console.log(colorize('\n─'.repeat(50), 'cyan'));
      console.log(colorize('Verification Token:', 'green'));
      console.log(result.verification_token);
    }

    console.log(colorize('─'.repeat(50) + '\n', 'cyan'));

    // Exit with appropriate code
    process.exit(result.passed ? 0 : 1);
  } catch (error) {
    console.error(
      colorize(`\nFatal Error: ${(error as Error).message}`, 'red')
    );
    process.exit(1);
  }
}

main();
