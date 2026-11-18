export const CLICHE_PHRASES = [
  "supercharge(d)?", "unleash the power", "unleash your", "unlock the power", "unlock the full potential",
  "unlock your potential", "next generation", "seamless experience", "seamlessly integrate", "elevate your",
  "game changer", "game changing", "transform the way", "transform your", "revolutionize", "revolutionise",
  "revolutionary", "take your .{1,30} to the next level", "take it to the next level", "cutting edge",
  "state of the art", "harness the power", "reimagine(d)?", "empower your", "empowering teams",
  "all in one platform", "the future of .{1,40} is here", "in today s fast paced", "fast paced world",
  "digital landscape", "ever evolving", "unparalleled", "best in class", "world class", "blazing fast",
  "lightning fast", "say goodbye to", "look no further", "one stop shop", "turbocharge", "streamline your",
  "mission critical", "innovative solutions", "end to end solution", "built for the future",
  "welcome to the future", "reach new heights", "deliver exceptional", "pushing the boundaries",
  "paradigm shift", "synergy", "10x your",
];

export const BUZZWORDS = [
  "leverage(d|s)?", "seamless(ly)?", "effortless(ly)?", "powerful", "robust", "innovative", "intuitive",
  "ai powered", "dive into", "delve", "holistic", "scalable", "comprehensive", "tailored", "streamline",
];

const PLACEHOLDER_PATTERNS: RegExp[] = [
  /\bAcme(?:\s+(?:Corp|Inc|Co|Corporation|Industries|Labs))?\b/g,
  /\b(?:John|Jane)\s+(?:Doe|Smith)\b/g,
  /\bLorem ipsum\b|\bdolor sit amet\b/gi,
  /\b(?:Your|My)\s+(?:Company|Brand|Business)(?:\s+(?:Name|Logo))?\b|\bCompany Name\b/g,
  /\b(?:Sarah (?:Johnson|Chen)|Michael Chen|Emily (?:Rodriguez|Davis)|Alex Johnson|David Kim|Jane Cooper|Cody Fisher|Jordan Smith)\b/g,
  /\b123 Main St/g,
  /\(555\)\s?\d{3}-\d{4}|\b555-\d{4}\b/g,
];


export interface PhraseSet {
  any: RegExp;
  each: RegExp[];
}

function combined(patterns: string[]): RegExp {
  return new RegExp(`\\b(?:${patterns.join("|")})\\b`, "g");
}

export const CLICHE_RE = combined(CLICHE_PHRASES);
export const BUZZWORD_RE = combined(BUZZWORDS);

const EMAIL_SOURCE = String.raw`@(?:example|company|email|domain|yourcompany)\.(?:com|io|org)\b`;

export const PLACEHOLDERS: PhraseSet = {
  any: new RegExp(PLACEHOLDER_PATTERNS.map((re) => re.source).join("|"), "i"),
  each: PLACEHOLDER_PATTERNS,
};

export const PLACEHOLDER_EMAILS: PhraseSet = {
  any: new RegExp(EMAIL_SOURCE),
  each: [new RegExp(EMAIL_SOURCE, "g")],
};
