export const EMOJI_SEQ =
  /(?:\p{Emoji_Presentation}|\p{Extended_Pictographic}️|\p{Regional_Indicator}{2}|[#*0-9]️?⃣)(?:\p{Emoji_Modifier}|️|‍(?:\p{Emoji_Presentation}|\p{Extended_Pictographic})️?)*/gu;

export interface EmojiRun {
  text: string;
  index: number;
}

const MAYBE_EMOJI_RE = /[^\x00-\x7f]/;

export function emojiRuns(text: string): EmojiRun[] {
  const runs: EmojiRun[] = [];
  if (!MAYBE_EMOJI_RE.test(text)) return runs;
  for (const match of text.matchAll(EMOJI_SEQ)) {
    const index = match.index as number;
    const last = runs[runs.length - 1];
    if (last) {
      const gap = text.slice(last.index + last.text.length, index);
      if (gap === "" || gap === " ") {
        last.text = text.slice(last.index, index + match[0].length);
        continue;
      }
    }
    runs.push({ text: match[0], index });
  }
  return runs;
}
