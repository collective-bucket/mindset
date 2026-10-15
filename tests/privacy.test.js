const assert = require("assert");
const privacy = require("../public/assets/privacy.js");

function kinds(text) {
  return privacy.scan(text).map((item) => item.kind);
}

assert.deepStrictEqual(kinds("Write to me at jane.doe@example.com tonight."), ["email"]);
assert.deepStrictEqual(kinds("Call 0532 123 45 67 or +90 532 123 45 67."), ["phone", "phone"]);
assert.deepStrictEqual(kinds("My number is 10000000146."), ["tckn"]);
assert.deepStrictEqual(kinds("Not an ID: 12345678901."), []);
assert.deepStrictEqual(kinds("IBAN TR33 0006 1005 1978 6457 8413 26 please"), ["iban"]);
assert.deepStrictEqual(kinds("GB82 WEST 1234 5698 7654 32"), ["iban"]);
assert.deepStrictEqual(kinds("Card 4111 1111 1111 1111"), ["card"]);
assert.deepStrictEqual(kinds("Card 4111 1111 1111 1112"), []);
assert.deepStrictEqual(kinds("See https://example.com/me and my.site.io"), ["url", "url"]);
assert.deepStrictEqual(kinds("Find me as @ertugrul_k on there."), ["handle"]);
assert.deepStrictEqual(kinds("Ahmet Yılmaz taught me this."), ["name"]);
assert.deepStrictEqual(kinds("I keep my word and I do not lie."), []);
assert.deepStrictEqual(kinds("Roma bir günde inşa edilmedi. 2024 yılında 3 kez taşındım."), []);

assert.strictEqual(privacy.tcknValid("10000000146"), true);
assert.strictEqual(privacy.tcknValid("10000000145"), false);
assert.strictEqual(privacy.luhn("4111111111111111"), true);
assert.strictEqual(privacy.ibanValid("TR330006100519786457841326"), true);

const fields = privacy.scanFields({
  personalCode: "I keep my word.",
  selfNarrative: "Mail me: a@b.co",
  currentPosition: "Ask Ayşe Kaya."
});
assert.deepStrictEqual(Object.keys(fields).sort(), ["currentPosition", "selfNarrative"]);
assert.strictEqual(privacy.blocks(fields), true);
assert.strictEqual(privacy.blocks(fields.currentPosition), false);

console.log("privacy.test.js passed");
