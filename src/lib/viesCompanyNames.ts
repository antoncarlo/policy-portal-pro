// Company names as the documents print them and as the Excel lists them, compared
// without case, spacing, punctuation or legal form: "CLARITON INNOVATION CO., LIMITED"
// and "Clariton Innovation Co., Ltd" are the same company, and so are
// "Guang Zhou Chao Ran Xin Xi Ke Ji You Xian Gong Si" and "Guangzhou Chao Ran Xin Xi Ke Ji Co.Ltd".
// Pure functions, used by the page and by the final check on the server.

// Legal form at the end of the name: Latin (Co., Ltd / Limited), pinyin (You Xian Gong Si) or Chinese (有限公司).
const LEGAL_FORM = /(?:(?:gufen)?youxian(?:zeren)?gongsi|(?:co|company)?(?:ltd|limited)|(?:股份)?有限(?:责任|責任)?公司)$/u;
const HAN = /\p{Script=Han}/u;

/** Comparison key of a company name; "" when what is left is too short to identify a company. */
export const companyNameKey = (value: unknown) => {
  const core = String(value ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .replace(LEGAL_FORM, "");
  return core.length >= (HAN.test(core) ? 2 : 4) ? core : "";
};

/** True when one of the names read in the documents is one of the company's names in the Excel. */
export const companyNameMatches = (expected: unknown[], found: unknown[]) => {
  const keys = new Set(expected.map(companyNameKey).filter(Boolean));
  return found.some((name) => keys.has(companyNameKey(name)));
};
