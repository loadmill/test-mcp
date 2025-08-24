export interface TestStep {
    prompt: string;
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
    prompt: string;
    response: string;
    success: boolean;
    error?: string;
    duration: number;
}