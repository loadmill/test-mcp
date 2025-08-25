export interface TestStep {
    prompt?: string;
    assert?: string;
}

export interface TestFile {
    description: string;
    steps: TestStep[];
}

export interface TestResult {
    testFile: string;
    description: string;
    steps: StepResult[];
    passed: boolean;
    duration: number;
}

export interface StepResult {
    stepIndex: number;
    stepType: "prompt" | "assert";
    input: string;
    response: string;
    success: boolean;
    error?: string;
    duration: number;
    assertionResult?: {
        passed: boolean;
        reasoning: string;
    };
}
