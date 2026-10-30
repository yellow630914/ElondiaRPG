// @vitest-environment jsdom
// 世界編輯器的來回測試（說明見 editorRoundTrip.ts）
import { CASES, roundTripSuite, storyNodeSuite } from './editorRoundTrip'

roundTripSuite(...Object.keys(CASES))
storyNodeSuite()
