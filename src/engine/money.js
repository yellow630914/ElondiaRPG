// 貨幣：全大陸統一使用阿爾貝納發行的白鸛幣，金額一律以整數儲存（欄位名稱的 _cc 沿用舊名）。
// 世界書的價格是舊幣制（銅、銀、金、白金），換算見 data/rules/economy.json。
import economyJson from '@data/rules/economy.json';
export const CURRENCY = economyJson.currency;
/** 1234 → "1,234 白鸛" */
export function formatMoney(cc) {
    const n = Math.round(cc);
    const sign = n < 0 ? '-' : '';
    return `${sign}${String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')} ${CURRENCY.short}`;
}
/** 給 AI 的貨幣說明：只有一種貨幣，世界書的舊幣制要換算 */
export function currencyRule() {
    const legacy = Object.entries(CURRENCY.legacy).map(([k, v]) => `1 ${k} = ${v}`).join('、');
    return `貨幣只有阿爾貝納發行的${CURRENCY.name}（簡稱${CURRENCY.short}），金額都以${CURRENCY.name}計；不要寫銅幣、銀幣、金幣。世界書裡的舊幣制價格換算成${CURRENCY.name}：${legacy}。`;
}
