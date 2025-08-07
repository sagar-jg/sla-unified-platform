#!/usr/bin/env node

/**
 * SLA Digital Platform QA Validation Script
 * 
 * Comprehensive validation tool to ensure 100% SLA Digital documentation compliance
 * Validates all 24 documented operators, adapter mappings, and API functionality
 * 
 * Usage: node scripts/qa-validation.js
 */

const fs = require('fs');
const path = require('path');

// ANSI color codes for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

// SLA Digital documented operators (24 total)
const SLA_DOCUMENTED_OPERATORS = [
  // Individual operators (12)
  'zain-kw', 'zain-sa', 'mobily-sa', 'etisalat-ae', 'ooredoo-kw', 'stc-kw',
  'mobile-ng', 'axiata-lk', 'viettel-mz', 'umobile-my', 'o2-uk', 'ee-uk',
  
  // Multi-country operators (12)  
  'zain-bh', 'zain-iq', 'zain-jo', 'zain-sd',
  'telenor-dk', 'telenor-digi', 'telenor-mm', 'telenor-no', 'telenor-se', 'telenor-rs',
  'voda-uk', 'vf-ie', 'three-uk', 'three-ie'
];

// Expected adapter mappings
const EXPECTED_ADAPTERS = {
  // Individual adapters
  'zain-kw': '../../adapters/zain-kw/ZainKuwaitAdapter',
  'zain-sa': '../../adapters/zain-sa/ZainSAAdapter',
  'mobily-sa': '../../adapters/mobily-sa/MobilySAAdapter',
  'etisalat-ae': '../../adapters/etisalat-ae/EtisalatAdapter',
  'ooredoo-kw': '../../adapters/ooredoo-kw/OoredooAdapter',
  'stc-kw': '../../adapters/stc-kw/STCKuwaitAdapter',
  'mobile-ng': '../../adapters/mobile-ng/NineMobileAdapter',
  'axiata-lk': '../../adapters/axiata-lk/AxiataAdapter',
  'viettel-mz': '../../adapters/viettel-mz/ViettelAdapter',
  'umobile-my': '../../adapters/umobile-my/UMobileAdapter',
  'o2-uk': '../../adapters/other/OtherOperatorsAdapter',
  'ee-uk': '../../adapters/other/OtherOperatorsAdapter',
  
  // Multi-country adapters
  'zain-bh': '../../adapters/zain-multi/ZainMultiAdapter',
  'zain-iq': '../../adapters/zain-multi/ZainMultiAdapter', 
  'zain-jo': '../../adapters/zain-multi/ZainMultiAdapter',
  'zain-sd': '../../adapters/zain-multi/ZainMultiAdapter',
  'telenor-dk': '../../adapters/telenor/TelenorAdapter',
  'telenor-digi': '../../adapters/telenor/TelenorAdapter',
  'telenor-mm': '../../adapters/telenor/TelenorAdapter',
  'telenor-no': '../../adapters/telenor/TelenorAdapter',
  'telenor-se': '../../adapters/telenor/TelenorAdapter',
  'telenor-rs': '../../adapters/telenor/TelenorAdapter',
  'voda-uk': '../../adapters/vodafone/VodafoneAdapter',
  'vf-ie': '../../adapters/vodafone/VodafoneAdapter',
  'three-uk': '../../adapters/three/ThreeAdapter',
  'three-ie': '../../adapters/three/ThreeAdapter'
};

class QAValidator {
  constructor() {
    this.results = {
      passed: 0,
      failed: 0,
      warnings: 0,
      issues: []
    };
    
    this.baseDir = path.resolve(__dirname, '../');
  }
  
  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = {
      'success': `${colors.green}✅`,
      'error': `${colors.red}❌`,
      'warning': `${colors.yellow}⚠️ `,
      'info': `${colors.blue}ℹ️ `,
      'phase': `${colors.cyan}${colors.bold}🔧`
    }[type] || colors.blue;
    
    console.log(`${prefix} ${message}${colors.reset}`);
  }
  
  async validateAdapterFiles() {
    this.log('Phase 1: Validating adapter file structure...', 'phase');
    
    let adapterErrors = [];
    
    for (const [operatorCode, expectedPath] of Object.entries(EXPECTED_ADAPTERS)) {
      // Convert require path to actual file path
      const filePath = path.join(this.baseDir, 'src', expectedPath.replace('../../', '') + '.js');
      
      if (fs.existsSync(filePath)) {
        this.log(`${operatorCode}: Adapter file exists`, 'success');
        this.results.passed++;
        
        // Validate file content
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          if (content.length < 100) {
            this.log(`${operatorCode}: Adapter file seems incomplete (${content.length} chars)`, 'warning');
            this.results.warnings++;
          }
        } catch (error) {
          this.log(`${operatorCode}: Cannot read adapter file - ${error.message}`, 'error');
          adapterErrors.push(`${operatorCode}: File read error`);
          this.results.failed++;
        }
      } else {
        this.log(`${operatorCode}: Missing adapter file at ${filePath}`, 'error');
        adapterErrors.push(`${operatorCode}: Missing file`);
        this.results.failed++;
      }
    }
    
    if (adapterErrors.length > 0) {
      this.results.issues.push({
        phase: 'Adapter Files',
        errors: adapterErrors
      });
    }
    
    return adapterErrors.length === 0;
  }
  
  async validateOperatorManager() {
    this.log('Phase 2: Validating OperatorManager mappings...', 'phase');
    
    const operatorManagerPath = path.join(this.baseDir, 'src/services/core/OperatorManager.js');
    
    if (!fs.existsSync(operatorManagerPath)) {
      this.log('OperatorManager.js not found!', 'error');
      this.results.failed++;
      return false;
    }
    
    const content = fs.readFileSync(operatorManagerPath, 'utf8');
    let mappingErrors = [];
    
    // Check if all documented operators are mapped
    for (const operatorCode of SLA_DOCUMENTED_OPERATORS) {
      const expectedPath = EXPECTED_ADAPTERS[operatorCode];
      
      if (content.includes(`'${operatorCode}'`) && content.includes(expectedPath)) {
        this.log(`${operatorCode}: Correctly mapped in OperatorManager`, 'success');
        this.results.passed++;
      } else if (content.includes(`'${operatorCode}'`)) {
        this.log(`${operatorCode}: Found in OperatorManager but path might be incorrect`, 'warning');
        this.results.warnings++;
        mappingErrors.push(`${operatorCode}: Potential path mismatch`);
      } else {
        this.log(`${operatorCode}: Missing from OperatorManager mappings`, 'error');
        this.results.failed++;
        mappingErrors.push(`${operatorCode}: Not mapped`);
      }
    }
    
    // Check for deprecated operators that should be removed
    const deprecatedOperators = ['unitel-mn']; // Operators not in SLA docs
    
    for (const deprecated of deprecatedOperators) {
      if (content.includes(`'${deprecated}'`)) {
        this.log(`${deprecated}: Deprecated operator still mapped (should be removed)`, 'warning');
        this.results.warnings++;
        mappingErrors.push(`${deprecated}: Should be removed (not in SLA docs)`);
      }
    }
    
    if (mappingErrors.length > 0) {
      this.results.issues.push({
        phase: 'OperatorManager Mappings',
        errors: mappingErrors
      });
    }
    
    return mappingErrors.length === 0;
  }
  
  async validateRoutes() {
    this.log('Phase 3: Validating API routes...', 'phase');
    
    const operatorRoutePath = path.join(this.baseDir, 'src/routes/api/v1/operators.js');
    
    if (!fs.existsSync(operatorRoutePath)) {
      this.log('Operator routes file not found!', 'error');
      this.results.failed++;
      return false;
    }
    
    const content = fs.readFileSync(operatorRoutePath, 'utf8');
    const requiredRoutes = [
      'router.get(\'/\'',
      'router.get(\'/statistics\'',
      'router.get(\'/:code\'',
      'router.get(\'/:code/status\'',
      'router.post(\'/:code/enable\'',
      'router.post(\'/:code/disable\''
    ];
    
    let routeErrors = [];
    
    for (const route of requiredRoutes) {
      if (content.includes(route)) {
        this.log(`Route ${route}: Implemented`, 'success');
        this.results.passed++;
      } else {
        this.log(`Route ${route}: Missing implementation`, 'error');
        routeErrors.push(`Missing route: ${route}`);
        this.results.failed++;
      }
    }
    
    if (routeErrors.length > 0) {
      this.results.issues.push({
        phase: 'API Routes',
        errors: routeErrors
      });
    }
    
    return routeErrors.length === 0;
  }
  
  async validatePackageJson() {
    this.log('Phase 4: Validating package.json dependencies...', 'phase');
    
    const packagePath = path.join(this.baseDir, 'package.json');
    
    if (!fs.existsSync(packagePath)) {
      this.log('package.json not found!', 'error');
      this.results.failed++;
      return false;
    }
    
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    const requiredDeps = [
      'express', 'axios', 'winston', 'redis', 'sequelize', 'mysql2',
      'dotenv', 'cors', 'helmet', 'express-rate-limit'
    ];
    
    let depErrors = [];
    
    for (const dep of requiredDeps) {
      if (packageJson.dependencies?.[dep] || packageJson.devDependencies?.[dep]) {
        this.log(`Dependency ${dep}: Found`, 'success');
        this.results.passed++;
      } else {
        this.log(`Dependency ${dep}: Missing`, 'warning');
        this.results.warnings++;
        depErrors.push(`Missing dependency: ${dep}`);
      }
    }
    
    if (depErrors.length > 0) {
      this.results.issues.push({
        phase: 'Dependencies',
        errors: depErrors
      });
    }
    
    return depErrors.length === 0;
  }
  
  generateComplianceReport() {
    this.log('Phase 5: Generating compliance report...', 'phase');
    
    const totalOperators = SLA_DOCUMENTED_OPERATORS.length;
    const implementedOperators = this.results.passed - this.results.failed;
    const compliancePercentage = Math.round((implementedOperators / totalOperators) * 100);
    
    const report = {
      timestamp: new Date().toISOString(),
      compliance: {
        totalDocumentedOperators: totalOperators,
        implementedOperators,
        compliancePercentage,
        status: compliancePercentage >= 100 ? 'FULLY_COMPLIANT' : 'PARTIALLY_COMPLIANT'
      },
      results: this.results,
      recommendations: []
    };
    
    if (this.results.failed > 0) {
      report.recommendations.push('Fix all failed validations before production deployment');
    }
    
    if (this.results.warnings > 0) {
      report.recommendations.push('Review warnings to ensure optimal implementation');
    }
    
    if (compliancePercentage < 100) {
      report.recommendations.push('Complete implementation of missing operators');
    }
    
    // Save report to file
    const reportPath = path.join(this.baseDir, 'qa-compliance-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    return report;
  }
  
  printSummary(report) {
    console.log('\\n' + '='.repeat(80));
    this.log('SLA DIGITAL PLATFORM QA VALIDATION SUMMARY', 'phase');
    console.log('='.repeat(80));
    
    console.log(`\\n${colors.blue}📊 COMPLIANCE STATUS:${colors.reset}`);
    console.log(`   Total SLA Documented Operators: ${colors.bold}${report.compliance.totalDocumentedOperators}${colors.reset}`);
    console.log(`   Implemented Operators: ${colors.bold}${report.compliance.implementedOperators}${colors.reset}`);
    console.log(`   Compliance Percentage: ${colors.bold}${colors.green}${report.compliance.compliancePercentage}%${colors.reset}`);
    console.log(`   Status: ${colors.bold}${report.compliance.status === 'FULLY_COMPLIANT' ? colors.green + '✅ FULLY COMPLIANT' : colors.yellow + '⚠️  PARTIALLY COMPLIANT'}${colors.reset}`);
    
    console.log(`\\n${colors.blue}📈 VALIDATION RESULTS:${colors.reset}`);
    console.log(`   ${colors.green}✅ Passed: ${this.results.passed}${colors.reset}`);
    console.log(`   ${colors.red}❌ Failed: ${this.results.failed}${colors.reset}`);
    console.log(`   ${colors.yellow}⚠️  Warnings: ${this.results.warnings}${colors.reset}`);
    
    if (this.results.issues.length > 0) {
      console.log(`\\n${colors.red}🔍 ISSUES FOUND:${colors.reset}`);
      for (const issue of this.results.issues) {
        console.log(`\\n   ${colors.red}${issue.phase}:${colors.reset}`);
        for (const error of issue.errors) {
          console.log(`     • ${error}`);
        }
      }
    }
    
    if (report.recommendations.length > 0) {
      console.log(`\\n${colors.yellow}💡 RECOMMENDATIONS:${colors.reset}`);
      for (const rec of report.recommendations) {
        console.log(`   • ${rec}`);
      }
    }
    
    console.log(`\\n${colors.cyan}📄 Report saved to: qa-compliance-report.json${colors.reset}`);
    console.log('='.repeat(80) + '\\n');
  }
  
  async runValidation() {
    this.log('Starting SLA Digital Platform QA Validation...', 'phase');
    this.log(`Validating ${SLA_DOCUMENTED_OPERATORS.length} documented operators`, 'info');
    
    const phases = [
      () => this.validateAdapterFiles(),
      () => this.validateOperatorManager(), 
      () => this.validateRoutes(),
      () => this.validatePackageJson()
    ];
    
    for (const phase of phases) {
      await phase();
      console.log(''); // Add spacing between phases
    }
    
    const report = this.generateComplianceReport();
    this.printSummary(report);
    
    // Exit with appropriate code
    const exitCode = this.results.failed > 0 ? 1 : 0;
    process.exit(exitCode);
  }
}

// Run validation if script is executed directly
if (require.main === module) {
  const validator = new QAValidator();
  validator.runValidation().catch(error => {
    console.error('Validation failed:', error);
    process.exit(1);
  });
}

module.exports = QAValidator;