/*
 * Mock data copied from the Figma frames. Replace with API calls —
 * each export maps to one likely endpoint (noted alongside).
 */

export interface Executable { id: string; name: string; type: string; sizeBytes: number }
export interface BuildVersion { id: string; version: string; tags: string; lastUpdated: string }
export interface GameSession {
  id: string; name: string; sessionId: string; version: string; status: 'Active' | 'Terminated';
  startTime: string; endTime: string; ipAddress: string; port: number; location: string;
  currentPlayers: number; maxPlayers: number; logsUrl: string; fleet: string;
}
export interface Recommendation { id: string; sessionName: string; date: string; time: string }
export interface InstanceIssue { id: string; computeName: string; location: string; capacity: string }
export interface CpuSession { id: string; computeName: string; location: string; status: string }

const GB = 1024 ** 3;
const MB = 1024 ** 2;

// GET /builds/:id/files
export const executables: Executable[] = [
  { id: 'f1', name: 'game-battlefile', type: '.exe', sizeBytes: 1 * GB },
  { id: 'f2', name: 'game-battlefile-server', type: '.exe', sizeBytes: 500 * MB },
  { id: 'f3', name: 'game-battlefile-client', type: '.exe', sizeBytes: 500 * MB },
  { id: 'f4', name: 'game-launcher', type: '.exe', sizeBytes: 500 * MB },
  { id: 'f5', name: 'game-matchmaker', type: '.exe', sizeBytes: 500 * MB },
  { id: 'f6', name: 'game-telemetry', type: '.exe', sizeBytes: 500 * MB },
];

// GET /compute/recommendation
export const recommendedCompute = {
  spec: '2vCPU 4GB',
  tier: 'Advance tier',
  confidence: '90% of the customer similar to your requirements use this recommended compute.',
  cost: '$ 0.062/hr',
  location: 'US-east-1',
  architecture: 'x86',
  os: 'Windows',
  usage: [
    'Suitable for CPU-intensive game servers',
    "Good for games that don't require extensive memory but need consistent compute performance",
    'Cost-effective option for moderate player loads',
    'Supports both Spot and On-Demand pricing',
  ],
};

// GET /builds/:id/versions
export const versions: BuildVersion[] = [
  { id: 'v1', version: '1.0.0', tags: 'Production', lastUpdated: '11/27/2025' },
];

// GET /builds/:id/sessions
export const sessions: GameSession[] = [
  {
    id: 'game-session-1', name: 'game-session-1', sessionId: 'abc123-session', version: '1.0.0',
    status: 'Active', startTime: '2025-11-24', endTime: 'Active', ipAddress: '192.0.2.1', port: 1935,
    location: 'us-west-2', currentPlayers: 2, maxPlayers: 8,
    logsUrl: 'https://us-east-1.console.aws.amazon.com/cloudwatch', fleet: 'fleet-xyz456',
  },
];

// GET /builds/:id/recommendations
export const recommendations: Recommendation[] = [
  { id: 'r1', sessionName: 'game-session-1', date: 'Dec 29, 2025', time: '4:05 PM (UTC-5)' },
  { id: 'r2', sessionName: 'game-session-2', date: 'Dec 28, 2025', time: '1:00 PM (UTC-5)' },
  { id: 'r3', sessionName: 'game-session-test', date: 'Dec 27, 2025', time: '4:00 PM (UTC-5)' },
  { id: 'r4', sessionName: 'game-session-test', date: 'Dec 27, 2025', time: '4:00 PM (UTC-5)' },
  { id: 'r5', sessionName: 'game-session-test', date: 'Dec 27, 2025', time: '4:00 PM (UTC-5)' },
  { id: 'r6', sessionName: 'game-session-test', date: 'Dec 27, 2025', time: '4:00 PM (UTC-5)' },
];
export const recommendationHistoryCount = 50;

export const instanceIssues: InstanceIssue[] = [
  { id: 'i1', computeName: 'C5.large', location: 'US-east-1', capacity: 'Overload' },
  { id: 'i2', computeName: 'C4.2xlarge', location: 'US-west-1', capacity: 'Overload' },
];

export const cpuSessions: CpuSession[] = Array.from({ length: 5 }, (_, i) => ({
  id: `c${i}`, computeName: 'i-0ad0f3de0170a89f2', location: 'US-east-1', status: 'Critical',
}));

export const formatBytes = (b: number) => (b >= GB ? `${Math.round(b / GB)}GB` : `${Math.round(b / MB)}MB`);
