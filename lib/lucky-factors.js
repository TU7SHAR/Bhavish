// Lucky factors (gemstone, colour, numbers, day) by Ascendant-lord sign index.
// Extracted from report-generation.js so the free Lucky-Factors tool and the
// paid report use the SAME table and can never disagree.

export const SIGN_LUCKY = {
  1: { gem: "Red Coral", color: "Red", lucky: "9, 1, 3", day: "Tuesday" },
  2: { gem: "Diamond", color: "White", lucky: "6, 2, 7", day: "Friday" },
  3: { gem: "Emerald", color: "Green", lucky: "5, 3, 8", day: "Wednesday" },
  4: { gem: "Pearl", color: "White/Silver", lucky: "2, 7, 9", day: "Monday" },
  5: { gem: "Ruby", color: "Gold/Orange", lucky: "1, 4, 9", day: "Sunday" },
  6: { gem: "Emerald", color: "Green", lucky: "5, 3, 6", day: "Wednesday" },
  7: { gem: "Diamond", color: "White/Pink", lucky: "6, 7, 2", day: "Friday" },
  8: { gem: "Red Coral", color: "Dark Red", lucky: "9, 1, 8", day: "Tuesday" },
  9: { gem: "Yellow Sapphire", color: "Yellow", lucky: "3, 9, 5", day: "Thursday" },
  10: { gem: "Blue Sapphire", color: "Blue/Black", lucky: "8, 4, 6", day: "Saturday" },
  11: { gem: "Blue Sapphire", color: "Blue", lucky: "8, 4, 7", day: "Saturday" },
  12: { gem: "Yellow Sapphire", color: "Yellow", lucky: "3, 9, 7", day: "Thursday" },
};

export function luckyFactorsForAscendant(ascSignIndex) {
  return SIGN_LUCKY[ascSignIndex] || SIGN_LUCKY[1];
}
