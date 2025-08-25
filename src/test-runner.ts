import fs from "fs";
import path from "path";
import YAML from "yaml";
import { MCPClient } from "./mcp-client.js";
import { TestFile, TestResult, StepResult } from "./test-types.js";

export class TestRunner {
    private mcpClient: MCPClient;

    constructor(mcpClient: MCPClient) {
        this.mcpClient = mcpClient;
    }

    async findTestFiles(testsDir: string = "tests"): Promise<string[]> {
        if (!fs.existsSync(testsDir)) {
            throw new Error(`Tests directory not found: ${testsDir}`);
        }

        const files = fs.readdirSync(testsDir);
        return files
            .filter(file => file.endsWith('.test.yaml'))
            .map(file => path.join(testsDir, file));
    }

    async loadTestFile(filePath: string): Promise<TestFile> {
        const content = fs.readFileSync(filePath, 'utf-8');
        try {
            const parsed = YAML.parse(content);
            return parsed as TestFile;
        } catch (error) {
            throw new Error(`Failed to parse YAML file ${filePath}: ${error}`);
        }
    }

    async runTest(filePath: string): Promise<TestResult> {
        const startTime = Date.now();
        const testFile = await this.loadTestFile(filePath);
        
        console.log(`\n📋 Running test: ${testFile.description}`);
        console.log(`📁 File: ${filePath}`);
        console.log(`🔢 Steps: ${testFile.steps.length}`);
        console.log("─".repeat(50));

        const stepResults: StepResult[] = [];
        let allStepsPassed = true;

        for (let i = 0; i < testFile.steps.length; i++) {
            const step = testFile.steps[i];
            const stepStartTime = Date.now();
            
            if (step.prompt) {
                // Handle prompt steps
                console.log(`\n💬 Step ${i + 1}: ${step.prompt}`);
                
                try {
                    const response = await this.mcpClient.processQuery(step.prompt);
                    const stepDuration = Date.now() - stepStartTime;
                    
                    console.log(`✅ Response (${stepDuration}ms):`);
                    console.log(response);
                    
                    stepResults.push({
                        stepIndex: i,
                        stepType: 'prompt',
                        input: step.prompt,
                        response,
                        success: true,
                        duration: stepDuration
                    });
                } catch (error) {
                    const stepDuration = Date.now() - stepStartTime;
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    
                    console.log(`❌ Error (${stepDuration}ms): ${errorMessage}`);
                    
                    stepResults.push({
                        stepIndex: i,
                        stepType: 'prompt',
                        input: step.prompt,
                        response: "",
                        success: false,
                        error: errorMessage,
                        duration: stepDuration
                    });
                    
                    allStepsPassed = false;
                }
            } else if (step.assert) {
                // Handle assertion steps
                console.log(`\n🔍 Step ${i + 1} (Assertion): ${step.assert}`);
                
                try {
                    const assertionResult = await this.mcpClient.evaluateAssertion(step.assert);
                    const stepDuration = Date.now() - stepStartTime;
                    
                    if (assertionResult.passed) {
                        console.log(`✅ Assertion PASSED (${stepDuration}ms):`);
                        console.log(`   Reasoning: ${assertionResult.reasoning}`);
                    } else {
                        console.log(`❌ Assertion FAILED (${stepDuration}ms):`);
                        console.log(`   Reasoning: ${assertionResult.reasoning}`);
                        allStepsPassed = false;
                    }
                    
                    stepResults.push({
                        stepIndex: i,
                        stepType: 'assert',
                        input: step.assert,
                        response: assertionResult.reasoning,
                        success: assertionResult.passed,
                        duration: stepDuration,
                        assertionResult
                    });
                } catch (error) {
                    const stepDuration = Date.now() - stepStartTime;
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    
                    console.log(`❌ Assertion Error (${stepDuration}ms): ${errorMessage}`);
                    
                    stepResults.push({
                        stepIndex: i,
                        stepType: 'assert',
                        input: step.assert,
                        response: "",
                        success: false,
                        error: errorMessage,
                        duration: stepDuration
                    });
                    
                    allStepsPassed = false;
                }
            } else {
                // Invalid step
                console.log(`❌ Step ${i + 1}: Invalid step - must have either 'prompt' or 'assert'`);
                stepResults.push({
                    stepIndex: i,
                    stepType: 'prompt',
                    input: 'Invalid step',
                    response: "",
                    success: false,
                    error: "Step must have either 'prompt' or 'assert' field",
                    duration: 0
                });
                allStepsPassed = false;
            }
        }

        const totalDuration = Date.now() - startTime;
        
        console.log("\n" + "─".repeat(50));
        console.log(`${allStepsPassed ? "✅ PASSED" : "❌ FAILED"} - ${testFile.description} (${totalDuration}ms)`);

        return {
            testFile: filePath,
            description: testFile.description,
            steps: stepResults,
            passed: allStepsPassed,
            duration: totalDuration
        };
    }

    async runAllTests(testsDir: string = "tests"): Promise<TestResult[]> {
        const testFiles = await this.findTestFiles(testsDir);
        
        if (testFiles.length === 0) {
            console.log(`No test files found in ${testsDir}`);
            return [];
        }

        console.log(`🚀 Found ${testFiles.length} test file(s)`);
        
        const results: TestResult[] = [];
        
        for (const testFile of testFiles) {
            try {
                const result = await this.runTest(testFile);
                results.push(result);
            } catch (error) {
                console.error(`❌ Failed to run test ${testFile}:`, error);
                results.push({
                    testFile,
                    description: "Failed to load test",
                    steps: [],
                    passed: false,
                    duration: 0
                });
            }
        }

        // Summary
        const passedTests = results.filter(r => r.passed).length;
        const totalTests = results.length;
        
        console.log("\n" + "=".repeat(60));
        console.log(`📊 TEST SUMMARY`);
        console.log(`Passed: ${passedTests}/${totalTests}`);
        console.log(`Failed: ${totalTests - passedTests}/${totalTests}`);
        console.log("=".repeat(60));

        return results;
    }
}