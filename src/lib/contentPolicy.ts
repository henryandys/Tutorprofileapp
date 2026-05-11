// Banned words for bio content moderation.
// Checked as whole words (case-insensitive) to avoid false positives.
const BANNED_WORDS = [
  // Profanity
  'fuck', 'fucker', 'fucking', 'fucked', 'motherfucker', 'motherfucking',
  'shit', 'shitting', 'bullshit',
  'cunt', 'cunts',
  'ass', 'asshole', 'assholes', 'asses',
  'bitch', 'bitches', 'bitching',
  'bastard', 'bastards',
  'damn', 'damned',
  'cock', 'cocks', 'cocksucker',
  'dick', 'dicks',
  'pussy', 'pussies',
  'whore', 'whores',
  'slut', 'sluts',
  'prick', 'pricks',
  'twat', 'twats',
  'wanker', 'wankers',
  'fag', 'faggot', 'faggots',
  'dyke', 'dykes',
  'retard', 'retards', 'retarded',
  'moron', 'idiot', 'imbecile',
  // Racial / ethnic slurs
  'nigger', 'niggers', 'nigga', 'niggas',
  'chink', 'chinks',
  'spic', 'spics', 'spick', 'spicks',
  'kike', 'kikes',
  'gook', 'gooks',
  'wetback', 'wetbacks',
  'cracker', 'crackers',
  'honky', 'honkies',
  'towelhead', 'towelheads',
  'raghead', 'ragheads',
  'zipperhead',
  'beaner', 'beaners',
  'redskin', 'redskins',
  'squaw',
  'injun',
  'coon', 'coons',
  'jigaboo',
  'sambo',
  'pickaninny',
  'darkie', 'darkies',
  'paki', 'pakis',
  'hymie',
  'greaseball', 'greaseballs',
  'slope', 'slopes',
]

// Build word-boundary regexes once at module load.
const BANNED_REGEXES: Array<{ word: string; re: RegExp }> = BANNED_WORDS.map(w => ({
  word: w,
  re:   new RegExp(`\\b${w}\\b`, 'i'),
}))

/**
 * Checks text for banned words.
 * Returns the matched word if found, or null if clean.
 */
export function findBannedWord(text: string): string | null {
  for (const { word, re } of BANNED_REGEXES) {
    if (re.test(text)) return word
  }
  return null
}

export const CONTENT_POLICY_MESSAGE =
  'Our community guidelines prohibit offensive, hateful, or discriminatory language in profiles.'
