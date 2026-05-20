import { createDefaultPreset } from "ts-jest";

const tsJestTransformCfg = createDefaultPreset().transform;

/** @type {import("jest").Config} **/
export default {
  testEnvironment: "node",
  transform: {
    ...tsJestTransformCfg,
  },
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
    "^cloudflare:workers$": "<rootDir>/src/__mocks__/cloudflare-workers.js",
    "^@tsndr/cloudflare-worker-jwt$": "<rootDir>/src/__mocks__/jwt.js",
    "^reconnecting-websocket$": "<rootDir>/src/__mocks__/reconnecting-websocket.js",
  },
};
