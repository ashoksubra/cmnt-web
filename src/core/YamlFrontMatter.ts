/**
 * Optional modern "---" YAML-style front-matter header (see
 * CMNT-Notation-Studio-source/src/cmnt/core/YamlFrontMatter.java for the full
 * design). Iteration 1 stub: pass the text through unchanged. Classic
 * directive-style files (Tala:, DefaultSpeed:, Raagam:, ...) -- including
 * every fixture used so far -- have no "---" block and are completely
 * unaffected by this. Full front-matter -> classic-directive translation is
 * deferred to a later iteration; TODO(iteration): port parseBlock/translate.
 */
export function preprocess(text: string): string {
  return text;
}
